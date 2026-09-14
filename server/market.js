import { createHash } from "node:crypto";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function number(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function plainProviderText(value) {
  const entities = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  };
  return String(value || "").replace(
    /&(amp|quot|apos|lt|gt|nbsp);/g,
    (_, name) => entities[name],
  );
}
export function ticker(value) {
  const s = String(value || "").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.-]{0,24}\.[A-Z0-9]{1,12}$/.test(s))
    throw new ApiError(
      400,
      "INVALID_SYMBOL",
      "Use a valid exchange-qualified symbol.",
    );
  return s;
}
const iso = (v) => {
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
export function quote(row, symbol) {
  return {
    symbol: row.code || symbol,
    price: number(row.close),
    change: number(row.change),
    changePercent: number(row.change_p),
    open: number(row.open),
    high: number(row.high),
    low: number(row.low),
    previousClose: number(row.previousClose),
    volume: number(row.volume),
    asOf: number(row.timestamp) > 0 ? iso(Number(row.timestamp) * 1000) : null,
  };
}
export function fundamentals(raw, symbol) {
  const g = raw.General || {},
    h = raw.Highlights || {},
    a = raw.AnalystRatings || {};
  const financials = {};
  for (const [key, fields] of Object.entries({
    Income_Statement: [
      "totalRevenue",
      "grossProfit",
      "operatingIncome",
      "netIncome",
      "ebitda",
    ],
    Balance_Sheet: [
      "totalAssets",
      "totalLiab",
      "totalStockholderEquity",
      "cash",
      "netDebt",
    ],
    Cash_Flow: [
      "totalCashFromOperatingActivities",
      "capitalExpenditures",
      "freeCashFlow",
      "dividendsPaid",
    ],
  })) {
    financials[key] = {
      currency:
        raw.Financials?.[key]?.currency_symbol || g.CurrencyCode || null,
    };
    for (const period of ["yearly", "quarterly"])
      financials[key][period] = Object.values(
        raw.Financials?.[key]?.[period] || {},
      )
        .sort((x, y) => String(y.date).localeCompare(String(x.date)))
        .slice(0, 8)
        .map((r) => ({
          date: r.date,
          filingDate: r.filing_date || null,
          ...Object.fromEntries(fields.map((f) => [f, number(r[f])])),
        }));
  }
  return {
    symbol,
    name: g.Name || symbol,
    exchange: g.Exchange || null,
    currency: g.CurrencyCode || null,
    country: g.CountryName || null,
    sector: g.Sector || null,
    industry: g.Industry || null,
    description: g.Description || null,
    website: safeUrl(g.WebURL),
    updatedAt: g.UpdatedAt || null,
    employees: number(g.FullTimeEmployees),
    ipoDate: g.IPODate || null,
    cik: /^\d+$/.test(String(g.CIK)) ? String(g.CIK) : null,
    metrics: Object.fromEntries(
      [
        "MarketCapitalization",
        "PERatio",
        "PEGRatio",
        "EarningsShare",
        "DividendYield",
        "ProfitMargin",
        "ReturnOnEquityTTM",
        "RevenueTTM",
        "QuarterlyRevenueGrowthYOY",
        "QuarterlyEarningsGrowthYOY",
      ].map((k) => [k, number(h[k])]),
    ),
    technicals: Object.fromEntries(
      ["52WeekHigh", "52WeekLow", "50DayMA", "200DayMA", "Beta"].map((k) => [
        k,
        number(raw.Technicals?.[k]),
      ]),
    ),
    analysts: Object.fromEntries(
      [
        "Rating",
        "TargetPrice",
        "StrongBuy",
        "Buy",
        "Hold",
        "Sell",
        "StrongSell",
      ].map((k) => [k, number(a[k])]),
    ),
    financials,
  };
}

export function createMarket({
  key,
  exchanges = ["US"],
  store,
  fetcher = fetch,
  budget = 120,
}) {
  const pending = new Map();
  const namespace = createHash("sha256")
    .update(key || "unconfigured")
    .digest("hex")
    .slice(0, 12);
  const allowed = new Set(exchanges);
  function checkSymbol(s) {
    const v = ticker(s);
    if (!allowed.has(v.split(".").at(-1)))
      throw new ApiError(
        400,
        "MARKET_DISABLED",
        "This exchange is not enabled on the platform.",
      );
    return v;
  }
  async function get(path, params = {}, ttl = 60) {
    if (!key)
      throw new ApiError(
        503,
        "DATA_NOT_CONFIGURED",
        "Market data is not connected yet. Please check back shortly.",
      );
    const query = new URLSearchParams({ ...params, fmt: "json" });
    const id = `market:${namespace}:${path}?${query}`;
    const cached = await store.get(id);
    if (cached) return { ...cached, meta: { ...cached.meta, cached: true } };
    if (pending.has(id)) return pending.get(id);
    const work = (async () => {
      if (await store.get(`cooldown:${namespace}`))
        throw new ApiError(
          503,
          "PROVIDER_BUSY",
          "The market-data service is temporarily unavailable. Please retry shortly.",
        );
      if ((await store.increment(`budget:${namespace}`, 60)) > budget)
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "Market-data request limit reached. Please retry in a minute.",
        );
      query.set("api_token", key);
      let response;
      try {
        response = await fetcher(`https://eodhd.com/api/${path}?${query}`, {
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
      } catch {
        throw new ApiError(
          502,
          "PROVIDER_UNAVAILABLE",
          "The data provider did not respond. Please try again.",
        );
      }
      if (!response.ok) {
        if ([429, 500, 502, 503, 504].includes(response.status))
          await store.set(`cooldown:${namespace}`, true, 15);
        throw new ApiError(
          response.status === 404 ? 404 : 503,
          [401, 403].includes(response.status)
            ? "DATA_ENTITLEMENT"
            : "PROVIDER_UNAVAILABLE",
          response.status === 404
            ? "No provider data was found for this symbol."
            : [401, 403].includes(response.status)
              ? "This dataset is not available under the current data subscription."
              : "The data provider is temporarily unavailable. Please retry shortly.",
        );
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new ApiError(
          502,
          "INVALID_PROVIDER_DATA",
          "The provider returned an unreadable response.",
        );
      }
      if (!data || data.error || data.message)
        throw new ApiError(
          502,
          "INVALID_PROVIDER_DATA",
          "The provider could not return this dataset.",
        );
      const valid = path.startsWith("v1.1/fundamentals/")
        ? data.General &&
          typeof data.General === "object" &&
          (data.General.Code || data.General.Name)
        : path === "screener"
          ? Array.isArray(data.data)
          : path.startsWith("real-time/")
            ? (Array.isArray(data) ? data : [data]).every(
                (row) =>
                  row &&
                  typeof row.code === "string" &&
                  Object.hasOwn(row, "close"),
              )
            : Array.isArray(data);
      if (!valid)
        throw new ApiError(
          502,
          "INVALID_PROVIDER_DATA",
          "The provider returned an unexpected dataset. Please retry.",
        );
      const result = {
        data,
        meta: {
          provider: "EODHD",
          retrievedAt: new Date().toISOString(),
          cached: false,
          mode: key.toLowerCase() === "demo" ? "provider-demo" : "licensed",
          freshness: "delayed",
          delayMinutes: "15–20",
        },
      };
      await store.set(id, result, ttl);
      return result;
    })();
    pending.set(id, work);
    try {
      return await work;
    } finally {
      pending.delete(id);
    }
  }
  const list = (r) => {
    if (!Array.isArray(r.data))
      throw new ApiError(
        502,
        "INVALID_PROVIDER_DATA",
        "The provider returned an unexpected dataset.",
      );
    return r;
  };
  return {
    checkSymbol,
    async exchanges() {
      const result = list(await get("exchanges-list/", {}, 86400));
      return {
        ...result,
        data: result.data
          .filter((r) => allowed.has(r.Code))
          .map((r) => ({
            code: r.Code,
            name: r.Name,
            country: r.Country,
            currency: r.Currency,
          })),
      };
    },
    async search(q, exchange) {
      if (!q || q.length > 80)
        throw new ApiError(
          400,
          "INVALID_SEARCH",
          "Enter a company name or stock symbol (up to 80 characters).",
        );
      if (!allowed.has(exchange))
        throw new ApiError(
          400,
          "MARKET_DISABLED",
          "This exchange is not enabled.",
        );
      const r = list(
        await get(
          `search/${encodeURIComponent(q)}`,
          { exchange, type: "stock", limit: "30" },
          300,
        ),
      );
      return {
        ...r,
        meta: { ...r.meta, freshness: "end-of-day" },
        data: r.data.map((x) => ({
          symbol: `${x.Code}.${x.Exchange}`,
          name: x.Name,
          exchange: x.Exchange,
          currency: x.Currency,
          country: x.Country,
          price: number(x.previousClose),
          asOf: x.previousCloseDate || null,
          changePercent: null,
          marketCap: null,
          sector: null,
        })),
      };
    },
    async screener({
      exchange,
      sector,
      industry,
      country,
      offset = 0,
      sort = "market_capitalization.desc",
    }) {
      if (!allowed.has(exchange))
        throw new ApiError(
          400,
          "MARKET_DISABLED",
          "This exchange is not enabled.",
        );
      const filters = [["exchange", "=", exchange]];
      for (const [field, value] of Object.entries({ sector, industry }))
        if (value) filters.push([field, "match", value]);
      // The screener has no company-country filter. Use the exchange's country
      // explicitly, rather than silently passing an unsupported provider filter.
      if (country) {
        const countries = list(await get("exchanges-list/", {}, 86400));
        const match = countries.data.find((x) => x.Code === exchange);
        if (
          !match ||
          String(match.Country).toLowerCase() !== country.toLowerCase()
        )
          return {
            data: [],
            hasMore: false,
            meta: { provider: "EODHD", freshness: "end-of-day" },
          };
      }
      const r = await get(
        "screener",
        {
          filters: JSON.stringify(filters),
          sort,
          limit: "20",
          offset: String(offset),
        },
        300,
      );
      const rows = r.data.data;
      if (!Array.isArray(rows))
        throw new ApiError(
          502,
          "INVALID_PROVIDER_DATA",
          "The provider returned an unexpected stock list.",
        );
      return {
        ...r,
        meta: { ...r.meta, freshness: "end-of-day" },
        hasMore: rows.length === 20,
        data: rows.map((x) => ({
          symbol: `${x.code}.${exchange}`,
          name: x.name,
          exchange: x.exchange,
          currency: x.currency_symbol || x.currency || null,
          sector: x.sector,
          country: x.country,
          industry: x.industry,
          price: number(x.adjusted_close),
          changePercent: number(x.refund_1d_p),
          marketCap: number(x.market_capitalization),
          asOf: x.last_day_data_date || null,
        })),
      };
    },
    async quotes(symbols) {
      const values = [...new Set(symbols.map(checkSymbol))];
      if (!values.length || values.length > 20)
        throw new ApiError(
          400,
          "INVALID_SYMBOLS",
          "Request between 1 and 20 symbols.",
        );
      const r = await get(
        `real-time/${encodeURIComponent(values[0])}`,
        values.length > 1 ? { s: values.slice(1).join(",") } : {},
        60,
      );
      return {
        ...r,
        data: (Array.isArray(r.data) ? r.data : [r.data]).map((x) =>
          quote(x, values[0]),
        ),
      };
    },
    async detail(s) {
      const symbol = checkSymbol(s);
      const r = await get(
        `v1.1/fundamentals/${encodeURIComponent(symbol)}`,
        {},
        21600,
      );
      if (!r.data.General)
        throw new ApiError(
          404,
          "NOT_FOUND",
          "Company information is unavailable for this symbol.",
        );
      return {
        ...r,
        meta: { ...r.meta, freshness: "company-reporting" },
        data: fundamentals(r.data, symbol),
      };
    },
    async history(s, range = "1Y") {
      const symbol = checkSymbol(s),
        days = { "1M": 31, "3M": 93, "6M": 186, "1Y": 366, "5Y": 1827 }[range];
      if (!days)
        throw new ApiError(
          400,
          "INVALID_RANGE",
          "Choose a supported chart range.",
        );
      const from = new Date(Date.now() - days * 86400000)
        .toISOString()
        .slice(0, 10);
      const r = list(
        await get(
          `eod/${encodeURIComponent(symbol)}`,
          { from, period: "d", order: "a" },
          3600,
        ),
      );
      return {
        ...r,
        meta: { ...r.meta, freshness: "end-of-day" },
        data: r.data
          .filter(
            (x) =>
              /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
              number(x.adjusted_close) !== null,
          )
          .map((x) => ({
            date: x.date,
            close: number(x.adjusted_close),
            volume: number(x.volume),
          })),
      };
    },
    async news({ symbol, topic, offset = 0 }) {
      const p = { limit: "20", offset: String(offset) };
      if (symbol) p.s = checkSymbol(symbol);
      else if (topic) p.t = topic;
      const r = list(await get("news", p, 300));
      return {
        ...r,
        meta: { ...r.meta, freshness: "publisher-timestamp" },
        hasMore: r.data.length === 20,
        data: r.data
          .map((x) => ({
            title: plainProviderText(x.title),
            date: x.date,
            url: safeUrl(plainProviderText(x.link)),
            symbols: Array.isArray(x.symbols) ? x.symbols : [],
            tags: Array.isArray(x.tags) ? x.tags : [],
            sentiment: number(x.sentiment?.polarity),
          }))
          .filter((x) => x.url && x.title),
      };
    },
  };
}

import { createHash } from 'node:crypto';
import { ApiError, number, ticker, fundamentals } from './market.js';

// Identifiers observed in the reference's public directory on 2026-09-19.
// All names, prices and history come from the API, never from the reference.
export const RESEARCH_SYMBOLS = ['AMD', 'APPF', 'ARLO', 'AVGO', 'AZZ', 'BCC', 'BHE'];

export function createMarketstack({ key, store, fetcher = fetch, cacheSeconds = 604800, monthlyBudget = 80 }) {
  const namespace = createHash('sha256').update(key || 'unconfigured').digest('hex').slice(0, 12);
  const pending = new Map();
  const ttl = Math.max(86400, Number(cacheSeconds) || 604800);
  const budget = Math.max(1, Math.min(100, Number(monthlyBudget) || 80));
  const meta = { provider: 'Marketstack', freshness: 'end-of-day', mode: 'free', refreshHours: ttl / 3600 };
  function checkSymbol(value) {
    const s = ticker(value);
    if (!RESEARCH_SYMBOLS.some(x => `${x}.US` === s))
      throw new ApiError(404, 'SYMBOL_NOT_COVERED', 'This symbol is outside the current seven-stock research collection.');
    return s;
  }
  function checkExchange(exchange) {
    if (exchange !== 'US') throw new ApiError(400, 'MARKET_DISABLED', 'Only the US research collection is enabled.');
  }
  async function series(value) {
    const symbol = checkSymbol(value);
    if (!key) throw new ApiError(503, 'DATA_NOT_CONFIGURED', 'Market data is not connected yet.');
    const id = `marketstack:${namespace}:${symbol}`;
    const saved = await store.get(id);
    if (saved) return { ...saved, meta: { ...saved.meta, cached: true } };
    if (pending.has(id)) return pending.get(id);
    const work = (async () => {
      if (await store.get(`cooldown:marketstack:${namespace}`))
        throw new ApiError(503, 'PROVIDER_BUSY', 'Marketstack is temporarily unavailable. Please try again later.');
      const now = new Date();
      const month = now.toISOString().slice(0, 7);
      const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
      const count = await store.increment(`budget:marketstack:${namespace}:${month}`, Math.ceil((reset - now.getTime()) / 1000));
      if (count > budget) throw new ApiError(429, 'MONTHLY_QUOTA', 'The monthly data allowance has been reached. Previously cached stocks remain available.');
      const from = new Date(now.getTime() - 364 * 86400000).toISOString().slice(0, 10);
      const query = new URLSearchParams({ access_key: key, symbols: symbol.slice(0, -3), date_from: from, limit: '1000', sort: 'DESC' });
      let response, body;
      try {
        response = await fetcher(`https://api.marketstack.com/v2/eod?${query}`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
        body = await response.json();
      } catch {
        await store.set(`cooldown:marketstack:${namespace}`, true, 60);
        throw new ApiError(502, 'PROVIDER_UNAVAILABLE', 'Marketstack did not return a readable response.');
      }
      if (!response.ok || body?.error) {
        await store.set(`cooldown:marketstack:${namespace}`, true, response.status === 429 ? 3600 : 60);
        const code = body?.error?.code;
        if (code === 'usage_limit_reached') throw new ApiError(429, 'MONTHLY_QUOTA', 'The Marketstack monthly allowance has been reached.');
        throw new ApiError(503, [401,403].includes(response.status) ? 'DATA_ENTITLEMENT' : 'PROVIDER_UNAVAILABLE', 'Marketstack could not supply this dataset under the configured account.');
      }
      if (!Array.isArray(body?.data)) throw new ApiError(502, 'INVALID_PROVIDER_DATA', 'Marketstack returned an unexpected dataset.');
      const rows = body.data.filter(r => r && r.symbol === symbol.slice(0,-3) && ['XNAS','XNYS','XASE'].includes(r.exchange) && Number.isFinite(Date.parse(r.date)) && number(r.close) !== null && number(r.adj_close) !== null)
        .sort((a,b) => Date.parse(b.date) - Date.parse(a.date));
      if (!rows.length) throw new ApiError(404, 'NOT_FOUND', 'No daily prices were returned for this stock.');
      const result = { data: rows, meta: { ...meta, retrievedAt: new Date().toISOString(), cached: false } };
      await store.set(id, result, ttl);
      return result;
    })();
    pending.set(id, work);
    try { return await work; } finally { pending.delete(id); }
  }
  function quote(result, symbol) {
    const [r, previous] = result.data;
    const ratio = number(previous?.adj_close) > 0 ? number(r.adj_close) / number(previous.adj_close) : null;
    const previousClose = ratio > 0 ? number(r.close) / ratio : null;
    return { symbol, price: number(r.close), previousClose, change: previousClose === null ? null : number(r.close) - previousClose,
      changePercent: ratio === null ? null : (ratio - 1) * 100,
      open: number(r.open), high: number(r.high), low: number(r.low), volume: number(r.volume), asOf: r.date,
      name: r.name || symbol, exchange: r.exchange_code || r.exchange, currency: r.price_currency || null, marketCap: null, sector: null };
  }
  async function directory() {
    const data = []; const metadata = [];
    // Sequential upstream work respects the small plan; cache hits are immediate.
    for (const raw of RESEARCH_SYMBOLS) {
      const symbol = `${raw}.US`, r = await series(symbol);
      data.push(quote(r, symbol)); metadata.push(r.meta);
    }
    return { data, meta: { ...meta, cached: metadata.every(m => m.cached), retrievedAt: metadata.map(m => m.retrievedAt).sort()[0] } };
  }
  return {
    checkSymbol,
    status: { provider: 'Marketstack', quoteType: 'end-of-day', delayMinutes: null, refreshHours: ttl / 3600,
      symbols: RESEARCH_SYMBOLS.map(s => `${s}.US`), capabilities: { financials: false, analysts: false, news: false, sectorFilters: false, maxHistory: '1Y' } },
    async exchanges() { return { data: [{ code:'US', name:'US stocks', country:'USA', currency:'USD' }], meta }; },
    async search(q, exchange) {
      checkExchange(exchange);
      if (!q || q.length > 80) throw new ApiError(400, 'INVALID_SEARCH', 'Enter a company name or symbol.');
      const r = await directory(), query = q.toLowerCase();
      return { ...r, data: r.data.filter(x => `${x.name} ${x.symbol}`.toLowerCase().includes(query)) };
    },
    async screener({ exchange, sector, industry, country, sort, offset = 0 }) {
      checkExchange(exchange);
      if (sector || industry || country) throw new ApiError(400, 'UNSUPPORTED_FILTER', 'Sector, industry and country screening is not available in this feed.');
      const r = await directory();
      const field = sort?.startsWith('adjusted_close') ? 'price' : sort?.startsWith('refund_1d_p') ? 'changePercent' : null;
      if (field) r.data.sort((a,b) => (number(a[field]) - number(b[field])) * (sort.endsWith('.desc') ? -1 : 1));
      return { ...r, data:r.data.slice(offset, offset + 20), hasMore:false };
    },
    async quotes(values) {
      if (!values.length || values.length > 20) throw new ApiError(400, 'INVALID_SYMBOLS', 'Request between 1 and 20 symbols.');
      const symbols = [...new Set(values.map(checkSymbol))]; const data = []; let resultMeta = meta;
      for (const symbol of symbols) { const r = await series(symbol); data.push(quote(r,symbol)); resultMeta = r.meta; }
      return { data, meta: resultMeta };
    },
    async detail(value) {
      const symbol = checkSymbol(value), r = await series(symbol), first = r.data[0];
      const data = fundamentals({ General: { Name:first.name, Exchange:first.exchange_code || first.exchange, CurrencyCode:first.price_currency, UpdatedAt:first.date } }, symbol);
      const high = r.data.map(x => number(x.adj_high)).filter(x => x !== null);
      const low = r.data.map(x => number(x.adj_low)).filter(x => x !== null);
      data.technicals['52WeekHigh'] = high.length ? Math.max(...high) : null;
      data.technicals['52WeekLow'] = low.length ? Math.min(...low) : null;
      for (const days of [50,200]) data.technicals[`${days}DayMA`] = r.data.length >= days ? r.data.slice(0,days).reduce((sum,x) => sum + number(x.adj_close),0) / days : null;
      data.priceReport = { ...quote(r,symbol), sessions:r.data.length, from:r.data.at(-1).date, to:first.date };
      data.coverage = 'price-history';
      return { data, meta: r.meta };
    },
    async history(value, range = '1Y') {
      const days = { '1M':31,'3M':93,'6M':186,'1Y':366 }[range];
      if (!days) throw new ApiError(400, 'DATA_ENTITLEMENT', 'This connection supports up to one year of daily history.');
      const r = await series(value), from = Date.now() - days * 86400000;
      return { ...r, data:r.data.filter(x => Date.parse(x.date) >= from).map(x => ({ date:x.date.slice(0,10), close:number(x.adj_close), volume:number(x.volume) })).reverse() };
    },
    async news() { throw new ApiError(400, 'DATA_ENTITLEMENT', 'A financial-news provider is not connected.'); },
  };
}

import {
  L,
  escape as e,
  fmt,
  compact,
  pct,
  color,
  date,
  time,
  icon,
  loading,
  empty,
  errorState,
  api,
  source,
  searchForm,
  investCta,
  pager,
  downloadCsv,
  toast,
  isNumber,
} from "./market-ui.js";
import { Watchlists } from "./watchlists.js";

const main = document.getElementById("main");
const params = new URLSearchParams(location.search);
const route =
  location.pathname.replace(/^\/index\.html$/, "/").replace(/\/$/, "") || "/";
const state = {
  offset: Number(params.get("offset")) || 0,
  status: null,
  exchange: params.get("exchange") || "US",
  marketRows: [],
  news: [],
  sentiment: "all",
  savedOnly: false,
  company: null,
  range: "1Y",
  period: "yearly",
  controller: null,
  version: 0,
};
const lists = new Watchlists(window.sbClient);
const COPY = {
  researchPlatform: ["Stock research & analysis", "أبحاث وتحليلات الأسهم"],
  mainWebsite: [
    "Visit the main BIN EISA website ↗",
    "زيارة موقع بن عيسى الرئيسي ↗",
  ],
  stocks: ["Stocks", "الأسهم"],
  reports: ["Reports", "التقارير"],
  news: ["News", "الأخبار"],
  search: ["Search", "البحث"],
  watchlist: ["Watchlist", "قائمة المراقبة"],
  privateStocks: ["Private stocks", "الأسهم الخاصة"],
  signIn: ["Sign in", "تسجيل الدخول"],
  invest: ["INVEST NOW ↗", "استثمر الآن ↗"],
  overview: ["Overview", "نظرة عامة"],
  account: ["Account", "الحساب"],
};
const stockUrl = (s) => `/stocks/${encodeURIComponent(s)}`;
const reportUrl = (s) => `/reports/${encodeURIComponent(s)}`;
const symbol = route.split("/")[2];
let activeRefresh = null;
const requestVersions = new Map();
function translateShell() {
  document.querySelectorAll("[data-copy]").forEach((el) => {
    const value = COPY[el.dataset.copy];
    if (value) el.textContent = L(...value);
  });
  document.getElementById("stock-language").textContent = L("عربي", "EN");
  if (lists.user) {
    const a = document.getElementById("authLink");
    a.textContent = L("My account", "حسابي");
    a.href = "/account/";
  }
  document.querySelectorAll(".desktop-nav a,.mobile-nav a").forEach((a) => {
    if (
      route === new URL(a.href).pathname ||
      (route.startsWith(new URL(a.href).pathname + "/") &&
        new URL(a.href).pathname !== "/")
    )
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
document
  .getElementById("stock-language")
  .addEventListener("click", () =>
    window.setLang(window.currentLang === "ar" ? "en" : "ar"),
  );
function heading(title, description, action = "") {
  return `<div class="page-heading"><div><span class="eyebrow">BIN EISA / ${L("RESEARCH WORKSPACE", "مساحة البحث")}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
function star(s, kind = "watchlist") {
  const saved = lists.has(s, kind);
  return `<button class="star-button" data-save="${e(s)}" data-kind="${kind}" aria-pressed="${saved}" aria-label="${e(L(`${saved ? "Remove" : "Save"} ${s} ${saved ? "from" : "to"} ${kind === "private" ? "private stocks" : "watchlist"}`, `${saved ? "إزالة" : "حفظ"} ${s} ${kind === "private" ? "في الأسهم الخاصة" : "في قائمة المراقبة"}`))}">${saved ? "★" : "☆"}</button>`;
}
function syncSaveButtons() {
  main.querySelectorAll("[data-save]").forEach((button) => {
    const kind = button.dataset.kind || "watchlist";
    const saved = lists.has(button.dataset.save, kind);
    button.setAttribute("aria-pressed", String(saved));
    if (button.classList.contains("star-button")) {
      button.textContent = saved ? "★" : "☆";
      button.setAttribute(
        "aria-label",
        `${saved ? L("Remove", "إزالة") : L("Save", "حفظ")} ${button.dataset.save}`,
      );
    } else if (!route.includes("watchlist")) {
      button.textContent =
        kind === "private"
          ? saved
            ? L("✓ Saved privately", "✓ محفوظ بشكل خاص")
            : L("Save privately", "حفظ خاص")
          : saved
            ? L("★ Watching", "★ قيد المتابعة")
            : L("☆ Watchlist", "☆ قائمة المراقبة");
    }
  });
}
function table(rows, meta) {
  if (!rows.length)
    return empty(
      L("No matching stocks", "لا توجد أسهم مطابقة"),
      L(
        "Try another company, symbol or combination of filters.",
        "جرّب شركة أو رمزاً أو معايير تصفية أخرى.",
      ),
    );
  return `<div class="table-scroll" role="region" aria-label="${L("Stock results; scroll horizontally for more columns", "نتائج الأسهم؛ مرر أفقياً لعرض المزيد")}" tabindex="0"><table class="stock-table"><thead><tr><th><span aria-label="${L("Save", "حفظ")}">☆</span></th><th>${L("Company / symbol", "الشركة / الرمز")}</th><th>${L("Price", "السعر")}</th><th>${L("Change %", "التغير %")}</th><th>${L("Market cap", "القيمة السوقية")}</th><th>${L("Sector", "القطاع")}</th><th>${L("As of", "التحديث")}</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${star(r.symbol)}</td><td class="company-cell"><a href="${stockUrl(r.symbol)}" class="company-link"><span class="ticker-monogram">${e(r.symbol.split(".")[0].slice(0, 3))}</span><span><b>${e(r.symbol.split(".")[0])}</b><small>${e(r.name)}</small></span></a></td><td class="numeric">${fmt(r.price)} <small class="muted">${e(r.currency || "")}</small></td><td class="numeric ${color(r.changePercent)}">${pct(r.changePercent)}</td><td class="numeric">${compact(r.marketCap)}</td><td><span class="tag">${e(r.sector || r.exchange || "—")}</span></td><td class="muted">${e(date(r.asOf))}</td></tr>`).join("")}</tbody></table></div>${source(meta)}`;
}
function saveError(err) {
  if (err.code === "AUTH_REQUIRED") {
    toast(
      L("Sign in to save private stocks.", "سجّل الدخول لحفظ الأسهم الخاصة."),
    );
    location.assign("/auth/login?next=/private-watchlist");
    return;
  }
  toast(err.message);
}
async function requestInto(id, work, render) {
  const el = document.getElementById(id);
  if (!el) return;
  const requestVersion = (requestVersions.get(id) || 0) + 1;
  requestVersions.set(id, requestVersion);
  el.innerHTML = loading();
  const version = state.version;
  try {
    const result = await work();
    if (
      version !== state.version ||
      requestVersions.get(id) !== requestVersion ||
      !el.isConnected
    )
      return;
    el.innerHTML = render(result);
  } catch (err) {
    if (
      err.name === "AbortError" ||
      version !== state.version ||
      requestVersions.get(id) !== requestVersion ||
      !el.isConnected
    )
      return;
    el.innerHTML = errorState(err);
  }
}

function home() {
  document.title = L(
    "BIN EISA Stocks — Research with perspective",
    "أسهم بن عيسى — رؤية أوسع للبحث",
  );
  main.innerHTML = `<section class="home-hero"><div class="hero-copy"><span class="eyebrow">${L("A CLEARER VIEW OF THE MARKETS", "رؤية أوضح للأسواق")}</span><h1 class="hero-title">${L("Research with<br><em>perspective.</em>", "ابحث اليوم.<br><em>برؤية أوسع.</em>")}</h1><p>${L("Understand the companies. Follow the numbers. Bring your next investment decision into focus.", "تعرّف على الشركات. تابع الأرقام. كوّن رؤية أوضح لقرارك الاستثماري القادم.")}</p><div class="actions"><a class="button gold" href="/stocks">${L("Explore stocks", "استكشف الأسهم")} →</a><a class="text-link" href="https://bineisa.com/">${L("INVEST NOW", "استثمر الآن")} ↗</a></div></div><div class="hero-search"><span class="eyebrow">${L("YOUR RESEARCH STARTS HERE", "بحثك يبدأ هنا")}</span><h2>${L("Find your next company.", "اعثر على شركتك القادمة.")}</h2><p>${L("Search by company name or exchange symbol.", "ابحث باسم الشركة أو رمز السهم في البورصة.")}</p>${searchForm()}<p class="search-hint">${L("Company profiles, financials and price history.", "ملفات الشركات وبياناتها المالية وسجل الأسعار.")} <a href="/data-sources">${L("View data coverage ↗", "تغطية البيانات ↗")}</a></p></div></section><div class="market-strip"><span><span class="status-dot"></span>${state.status?.configured ? L("EODHD data connection configured", "تم إعداد اتصال EODHD") : L("Market data connection pending", "اتصال بيانات السوق قيد الإعداد")}</span><div class="strip-links"><span>${L("Quotes delayed 15–20 min", "الأسعار متأخرة 15–20 دقيقة")}</span><a href="/data-sources">${L("Data transparency ↗", "شفافية البيانات ↗")}</a></div></div>${state.status?.demo ? `<p class="demo-banner">${L("Provider demo connection — limited symbol access. Not a production data feed.", "اتصال تجريبي للمزود — رموز محدودة. ليس مصدر بيانات للإنتاج.")}</p>` : ""}<div class="workspace-grid"><section><div class="section-head"><div><h2>${L("Market overview", "نظرة على السوق")}</h2><p>${L("Discover companies. Start with the fundamentals.", "اكتشف الشركات وابدأ بأساسياتها.")}</p></div><a class="text-link" href="/stocks">${L("All stocks", "جميع الأسهم")} →</a></div><div class="panel"><div class="panel-head"><h3>${L("Leading companies", "الشركات الكبرى")}</h3><span class="tag">${e(state.exchange)} · ${L("By market cap", "حسب القيمة السوقية")}</span></div><div id="home-market"></div></div></section><aside class="side-stack"><div class="panel panel-pad"><span class="eyebrow">${L("YOUR PERSONAL VIEW", "رؤيتك الخاصة")}</span><h3>${L("Keep opportunities close.", "تابع الفرص عن قرب.")}</h3><p>${L("Build a watchlist of the companies you want to understand better.", "أنشئ قائمة بالشركات التي ترغب في فهمها بشكل أفضل.")}</p><a class="button" href="/watchlist">${L("Open my watchlist", "قائمة المراقبة")} →</a></div><div class="side-invest"><span class="eyebrow">BIN EISA</span><h3>${L("From research<br>to opportunity.", "من البحث<br>إلى الفرصة.")}</h3><p>${L("Meet the businesses behind the BIN EISA name.", "تعرّف على الأعمال التي تقف وراء اسم بن عيسى.")}</p><a class="button gold" href="https://bineisa.com/">${L("INVEST NOW", "استثمر الآن")} ↗</a></div></aside></div><div class="quick-links"><a href="/reports">${icon("report")}<span><b>${L("Read the fundamentals", "اقرأ الأساسيات")}</b><small>${L("Company financial reports", "التقارير المالية للشركات")}</small></span><span class="arrow">↗</span></a><a href="/news">${icon("news")}<span><b>${L("Follow the story", "تابع المستجدات")}</b><small>${L("The latest market headlines", "أحدث عناوين أخبار السوق")}</small></span><span class="arrow">↗</span></a><a href="/private-watchlist">${icon("lock")}<span><b>${L("Make room for your ideas", "مساحة لأفكارك")}</b><small>${L("Private stocks & research notes", "أسهم خاصة وملاحظات بحثية")}</small></span><span class="arrow">↗</span></a></div>${investCta()}`;
  activeRefresh = () =>
    requestInto(
      "home-market",
      () => api("stocks", { exchange: state.exchange }),
      (r) => table(r.data.slice(0, 8), r.meta),
    );
  activeRefresh();
}

function filters() {
  const sectors = [
    "Technology",
    "Healthcare",
    "Financial Services",
    "Consumer Cyclical",
    "Consumer Defensive",
    "Industrials",
    "Energy",
    "Utilities",
    "Real Estate",
    "Basic Materials",
    "Communication Services",
  ];
  return `<form id="filters" class="filters"><div class="filter-field"><label for="exchange">${L("Market", "السوق")}</label><select name="exchange" id="exchange"><option value="${e(state.exchange)}">${e(state.exchange)}</option></select></div><div class="filter-field"><label for="sector">${L("Sector", "القطاع")}</label><select name="sector" id="sector"><option value="">${L("All sectors", "جميع القطاعات")}</option>${sectors.map((s) => `<option ${params.get("sector") === s ? "selected" : ""}>${e(s)}</option>`).join("")}</select></div><div class="filter-field"><label for="industry">${L("Industry", "الصناعة")}</label><input id="industry" name="industry" maxlength="80" value="${e(params.get("industry"))}" placeholder="${L("All industries", "جميع الصناعات")}"></div><div class="filter-field"><label for="country">${L("Listing country", "بلد الإدراج")}</label><input id="country" name="country" maxlength="80" value="${e(params.get("country"))}" placeholder="${L("All countries", "جميع البلدان")}"></div><div class="filter-field"><label for="sort">${L("Sort by", "الترتيب")}</label><select id="sort" name="sort">${[
    [
      "market_capitalization.desc",
      L("Market cap: high to low", "القيمة السوقية: تنازلي"),
    ],
    [
      "market_capitalization.asc",
      L("Market cap: low to high", "القيمة السوقية: تصاعدي"),
    ],
    [
      "refund_1d_p.desc",
      L("Daily change: high to low", "التغير اليومي: تنازلي"),
    ],
    [
      "refund_1d_p.asc",
      L("Daily change: low to high", "التغير اليومي: تصاعدي"),
    ],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${params.get("sort") === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select></div><button class="button gold" type="submit">${L("Apply filters", "تطبيق")}</button><a class="button" href="${route}">${L("Reset", "إعادة تعيين")}</a></form>`;
}
async function loadExchanges() {
  try {
    const r = await api("exchanges");
    const select = document.getElementById("exchange");
    if (select && r.data.length)
      select.innerHTML = r.data
        .map(
          (x) =>
            `<option value="${e(x.code)}" ${x.code === state.exchange ? "selected" : ""}>${e(x.name)} (${e(x.code)})</option>`,
        )
        .join("");
  } catch {
    /* The selected configured market remains visible; the main data panel shows the error. */
  }
}
function reportCards(rows, meta) {
  if (!rows.length)
    return empty(
      L("No company reports found", "لا توجد تقارير للشركات"),
      L("Try a different market or sector.", "جرّب سوقاً أو قطاعاً آخر."),
    );
  return `<div class="article-grid">${rows.map((r) => `<article class="article-card"><div class="article-meta"><span class="tag">${e(r.sector || r.exchange)}</span><span>${e(r.symbol)}</span></div><h2><a href="${reportUrl(r.symbol)}">${e(r.name)}</a></h2><p>${L("Income statements, balance sheets, cash flows and provider analyst estimates, where available.", "قوائم الدخل والميزانيات والتدفقات النقدية وتقديرات المحللين المتوفرة من المزود.")}</p><div class="article-tags"><span class="tag">${L("Financial report", "تقرير مالي")}</span></div><div class="article-actions"><span class="muted">${L("Company fundamentals", "أساسيات الشركة")}</span><a class="text-link" href="${reportUrl(r.symbol)}">${L("Read report", "قراءة التقرير")} ↗</a></div></article>`).join("")}</div>${source(meta)}`;
}
function stockList(reports = false) {
  document.title = reports
    ? "Financial reports — BIN EISA Stocks"
    : "Stocks — BIN EISA Stocks";
  main.innerHTML =
    heading(
      reports
        ? L("Company reports", "تقارير الشركات")
        : L("Explore the markets.", "استكشف الأسواق."),
      reports
        ? L(
            "Read company financials and provider analysis. Every figure comes from the connected data feed.",
            "اقرأ البيانات المالية وتحليلات المزود. كل رقم يأتي من مصدر البيانات المتصل.",
          )
        : L(
            "Find companies, compare the fundamentals and build your own perspective.",
            "ابحث عن الشركات وقارن أساسياتها وكوّن رؤيتك الخاصة.",
          ),
      searchForm(),
    ) +
    filters() +
    `<div class="result-toolbar"><span>${reports ? L("Financial statements & analyst estimates", "قوائم مالية وتقديرات المحللين") : L("Stock screener · prices in the provider’s quote currency", "تصفية الأسهم · الأسعار بعملة المزود")}</span><a href="/data-sources">${L("End-of-day data ⓘ", "بيانات نهاية اليوم ⓘ")}</a></div><div id="results" ${reports ? "" : 'class="panel"'}></div><div class="research-note">${L("Missing figures are shown as —. Market data is sourced from EODHD; no prices or company financials are entered manually.", "البيانات غير المتوفرة تظهر بعلامة —. مصدر بيانات السوق هو EODHD؛ لا يتم إدخال الأسعار أو البيانات المالية يدوياً.")}</div>${investCta()}`;
  loadExchanges();
  document.getElementById("filters").addEventListener("submit", (event) => {
    event.preventDefault();
    for (const [k, v] of new FormData(event.currentTarget)) params.set(k, v);
    params.delete("offset");
    location.search = params.toString();
  });
  activeRefresh = () =>
    requestInto(
      "results",
      () =>
        api("stocks", {
          exchange: state.exchange,
          sector: params.get("sector"),
          industry: params.get("industry"),
          country: params.get("country"),
          sort: params.get("sort"),
          offset: state.offset,
        }),
      (r) => {
        state.marketRows = r.data;
        return (
          (reports ? reportCards(r.data, r.meta) : table(r.data, r.meta)) +
          pager(state.offset, r.hasMore)
        );
      },
    );
  activeRefresh();
}
function searchPage() {
  const q = (params.get("q") || "").trim();
  document.title = "Search — BIN EISA Stocks";
  main.innerHTML =
    heading(
      L("A company worth understanding.", "شركة تستحق أن تعرفها."),
      L(
        "Search using a company name, ticker symbol or ISIN.",
        "ابحث باستخدام اسم الشركة أو رمز السهم أو ISIN.",
      ),
    ) +
    `<div class="methodology">${searchForm(q)}<div class="filters"><div class="filter-field"><label for="exchange">${L("Search market", "سوق البحث")}</label><select id="exchange"><option value="${e(state.exchange)}">${e(state.exchange)}</option></select></div></div></div><div id="search-results" class="panel"></div>`;
  loadExchanges();
  document.getElementById("exchange").addEventListener("change", (ev) => {
    params.set("exchange", ev.target.value);
    location.search = params;
  });
  main.querySelector(".search-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    params.set("q", new FormData(ev.currentTarget).get("q"));
    params.set("exchange", state.exchange);
    location.search = params;
  });
  activeRefresh = () =>
    q
      ? requestInto(
          "search-results",
          () => api("search", { q, exchange: state.exchange }),
          (r) => table(r.data, r.meta),
        )
      : (document.getElementById("search-results").innerHTML = empty(
          L("Start with a name or symbol", "ابدأ باسم أو رمز"),
          L(
            "Search the provider’s stock directory to find a company.",
            "ابحث في دليل أسهم المزود للعثور على شركة.",
          ),
        ));
  activeRefresh();
}

function savedNews() {
  try {
    const v = JSON.parse(localStorage.getItem("bineisa-news-v1") || "[]");
    return Array.isArray(v) ? v.slice(0, 100) : [];
  } catch {
    return [];
  }
}
function newsCards(rows) {
  const saved = savedNews();
  const filtered = rows.filter(
    (r) =>
      state.sentiment === "all" ||
      (state.sentiment === "positive"
        ? r.sentiment > 0.1
        : state.sentiment === "negative"
          ? r.sentiment < -0.1
          : isNumber(r.sentiment) && r.sentiment >= -0.1 && r.sentiment <= 0.1),
  );
  if (!filtered.length)
    return empty(
      L("No headlines in this selection", "لا توجد أخبار في هذا الاختيار"),
      L(
        "Change the filter or move to the next page.",
        "غيّر التصفية أو انتقل إلى الصفحة التالية.",
      ),
    );
  return `<div class="article-grid">${filtered
    .map(
      (r) =>
        `<article class="article-card"><div class="article-meta"><span class="tag">${e(r.tags[0] || L("Market news", "أخبار السوق"))}</span><time>${e(date(r.date))}</time></div><h2><a href="${e(r.url)}" target="_blank" rel="noopener noreferrer">${e(r.title)}</a></h2><p>${e(new URL(r.url).hostname)}</p><div class="article-tags">${r.symbols
          .slice(0, 3)
          .filter((s) => s.endsWith("." + state.exchange))
          .map((s) => `<a class="tag" href="${stockUrl(s)}">${e(s)}</a>`)
          .join(
            "",
          )}<span class="tag ${color(r.sentiment)}">${!isNumber(r.sentiment) ? L("Unrated", "غير مصنف") : r.sentiment > 0.1 ? L("Positive", "إيجابي") : r.sentiment < -0.1 ? L("Negative", "سلبي") : L("Neutral", "محايد")}</span></div><div class="article-actions"><a class="text-link" href="${e(r.url)}" target="_blank" rel="noopener noreferrer">${L("Read at source", "اقرأ لدى المصدر")} ↗</a><div><button data-save-news="${e(r.url)}" aria-pressed="${saved.some((x) => x.url === r.url)}">${saved.some((x) => x.url === r.url) ? "★" : "☆"} ${L("Save", "حفظ")}</button><button data-share="${e(r.url)}">${L("Share", "مشاركة")} ↗</button></div></div></article>`,
    )
    .join("")}</div>`;
}
function newsPage() {
  document.title = "Market news — BIN EISA Stocks";
  main.innerHTML =
    heading(
      L("The story behind the numbers.", "القصة وراء الأرقام."),
      L(
        "Market headlines, company developments and provider sentiment. Read the full story at the original source.",
        "أخبار الأسواق ومستجدات الشركات وتصنيفات المزود. اقرأ الخبر كاملاً لدى مصدره الأصلي.",
      ),
    ) +
    `<form id="news-filters" class="filters"><div class="filter-field"><label for="news-symbol">${L("Stock symbol (optional)", "رمز السهم (اختياري)")}</label><input id="news-symbol" name="symbol" value="${e(params.get("symbol"))}" placeholder="AAPL.US" maxlength="40"></div><div class="filter-field"><label for="news-topic">${L("Topic (optional)", "الموضوع (اختياري)")}</label><input id="news-topic" name="topic" value="${e(params.get("topic"))}" placeholder="${L("Earnings, technology…", "أرباح، تكنولوجيا…")}" maxlength="80"></div><button class="button gold">${L("Find news", "ابحث عن الأخبار")}</button></form><div class="news-filter-row"><div class="segmented" aria-label="${L("Filter sentiment on this page", "تصفية التصنيفات في هذه الصفحة")}">${[
      ["all", L("All headlines", "جميع الأخبار")],
      ["positive", L("Positive", "إيجابي")],
      ["neutral", L("Neutral", "محايد")],
      ["negative", L("Negative", "سلبي")],
    ]
      .map(
        ([v, t]) =>
          `<button data-sentiment="${v}" aria-pressed="${state.sentiment === v}">${t}</button>`,
      )
      .join(
        "",
      )}</div><button class="button compact" data-saved-news aria-pressed="${state.savedOnly}">${L("Saved on this device", "المحفوظة على هذا الجهاز")}</button></div><p class="muted" style="font-size:11px;margin-bottom:16px">${L("Sentiment filters apply to the current page. Saved stories stay on this device.", "تُطبق تصفية التصنيفات على الصفحة الحالية. تبقى الأخبار المحفوظة على هذا الجهاز.")}</p><div id="news-results"></div>`;
  document.getElementById("news-filters").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const data = new FormData(ev.currentTarget);
    params.set("symbol", String(data.get("symbol")).trim().toUpperCase());
    params.set("topic", String(data.get("topic")).trim());
    params.delete("offset");
    location.search = params;
  });
  activeRefresh = () => {
    if (state.savedOnly) {
      state.news = savedNews();
      document.getElementById("news-results").innerHTML = newsCards(state.news);
      return;
    }
    return requestInto(
      "news-results",
      () =>
        api("news", {
          symbol: params.get("symbol"),
          topic: params.get("topic"),
          offset: state.offset,
        }),
      (r) => {
        state.news = r.data;
        state.newsMeta = r.meta;
        state.newsHasMore = r.hasMore;
        return (
          newsCards(r.data) + source(r.meta) + pager(state.offset, r.hasMore)
        );
      },
    );
  };
  activeRefresh();
}

const FIELDS = {
  totalRevenue: ["Revenue", "الإيرادات"],
  grossProfit: ["Gross profit", "إجمالي الربح"],
  operatingIncome: ["Operating income", "الدخل التشغيلي"],
  netIncome: ["Net income", "صافي الدخل"],
  ebitda: ["EBITDA", "الأرباح قبل الفوائد والضرائب والاستهلاك"],
  totalAssets: ["Total assets", "إجمالي الأصول"],
  totalLiab: ["Total liabilities", "إجمالي الالتزامات"],
  totalStockholderEquity: ["Shareholder equity", "حقوق المساهمين"],
  cash: ["Cash", "النقد"],
  netDebt: ["Net debt", "صافي الدين"],
  totalCashFromOperatingActivities: [
    "Operating cash flow",
    "التدفق النقدي التشغيلي",
  ],
  capitalExpenditures: ["Capital expenditure", "النفقات الرأسمالية"],
  freeCashFlow: ["Free cash flow", "التدفق النقدي الحر"],
  dividendsPaid: ["Dividends paid", "توزيعات الأرباح"],
};
const STATEMENTS = {
  Income_Statement: ["Income statement", "قائمة الدخل"],
  Balance_Sheet: ["Balance sheet", "الميزانية العمومية"],
  Cash_Flow: ["Cash flow", "التدفقات النقدية"],
};
function metrics(c) {
  const m = c.metrics;
  const values = [
    [
      L("Market capitalization", "القيمة السوقية"),
      compact(m.MarketCapitalization),
    ],
    [L("P/E ratio", "مضاعف الربحية"), fmt(m.PERatio)],
    [L("Earnings per share", "ربحية السهم"), fmt(m.EarningsShare)],
    [
      L("Dividend yield", "عائد التوزيعات"),
      isNumber(m.DividendYield) ? fmt(m.DividendYield * 100) + "%" : "—",
    ],
    [L("Revenue (TTM)", "الإيرادات (آخر 12 شهراً)"), compact(m.RevenueTTM)],
    [
      L("Profit margin", "هامش الربح"),
      isNumber(m.ProfitMargin) ? fmt(m.ProfitMargin * 100) + "%" : "—",
    ],
    [
      L("52-week high", "أعلى سعر خلال 52 أسبوعاً"),
      fmt(c.technicals["52WeekHigh"]),
    ],
    [
      L("52-week low", "أدنى سعر خلال 52 أسبوعاً"),
      fmt(c.technicals["52WeekLow"]),
    ],
  ];
  return `<div class="metric-grid">${values.map(([label, v]) => `<div class="metric"><span>${label}</span><b>${v}</b></div>`).join("")}</div>`;
}
function statementContent() {
  const c = state.company;
  if (!c) return "";
  return Object.entries(STATEMENTS)
    .map(([key, title]) => {
      const s = c.financials[key],
        rows = s[state.period];
      if (!rows.length)
        return `<section class="statement"><h3>${L(...title)}</h3>${empty(L("Statement not available", "القائمة غير متوفرة"), L("The data provider has not supplied this statement for the selected period.", "لم يوفر المزود هذه القائمة للفترة المختارة."))}</section>`;
      const fields = Object.keys(rows[0]).filter((k) => k in FIELDS);
      return `<section class="statement"><div class="section-head"><h3>${L(...title)}</h3><span class="muted">${e(s.currency || L("Currency unavailable", "العملة غير متوفرة"))}</span></div><div class="panel table-scroll" role="region" tabindex="0" aria-label="${L(...title)}"><table class="stock-table"><thead><tr><th>${L("Reported figures", "البيانات المعلنة")}</th>${rows.map((r) => `<th>${e(date(r.date))}</th>`).join("")}</tr></thead><tbody>${fields.map((f) => `<tr><td>${L(...FIELDS[f])}</td>${rows.map((r) => `<td class="numeric">${fmt(r[f], 0)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
    })
    .join("");
}
function reportContent(c, meta) {
  return `<div class="section-head"><div><h2>${L("Company financial report", "التقرير المالي للشركة")}</h2><p>${L("Financial statements are shown in their reported currency.", "تُعرض القوائم المالية بعملة التقرير.")}</p></div><div class="actions"><button class="button compact" data-export>${L("Download CSV ↓", "تحميل CSV ↓")}</button><button class="button compact" data-print>${L("Print / PDF", "طباعة / PDF")}</button></div></div><div class="news-filter-row"><div class="segmented" aria-label="${L("Reporting period", "فترة التقرير")}"><button data-period="yearly" aria-pressed="${state.period === "yearly"}">${L("Annual", "سنوي")}</button><button data-period="quarterly" aria-pressed="${state.period === "quarterly"}">${L("Quarterly", "ربع سنوي")}</button></div><p class="muted">${L("Fundamentals updated", "تحديث البيانات المالية")}: ${e(date(c.updatedAt))}</p></div><div id="statements">${statementContent()}</div>${source(meta)}<div class="research-note">${L("Reports present provider-supplied company statements. Missing values remain blank (—); they are never converted to zero. These reports do not contain BIN EISA buy or sell recommendations.", "تعرض التقارير القوائم المالية الواردة من المزود. تظهر القيم غير المتوفرة بعلامة — ولا يتم تحويلها إلى صفر. لا تتضمن هذه التقارير توصيات شراء أو بيع صادرة عن بن عيسى.")}</div>${c.cik ? `<a class="text-link" href="https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(c.cik)}&owner=exclude" target="_blank" rel="noopener noreferrer">${L("View original SEC filings", "عرض الإيداعات الأصلية لدى SEC")} ↗</a>` : ""}`;
}
function analysisContent(c) {
  const a = c.analysts;
  return `<div class="panel panel-pad"><div class="section-head"><div><h2>${L("Analyst perspective", "رؤية المحللين")}</h2><p>${L("Consensus supplied by EODHD, where available.", "إجماع المحللين المقدم من EODHD، عند توفره.")}</p></div></div><div class="metric-grid"><div class="metric"><span>${L("Consensus target price", "السعر المستهدف المجمع")}</span><b>${fmt(a.TargetPrice)} <small>${e(c.currency || "")}</small></b></div><div class="metric"><span>${L("Provider rating (1–5)", "تصنيف المزود (1–5)")}</span><b>${fmt(a.Rating)}</b></div><div class="metric"><span>${L("Revenue growth YoY", "نمو الإيرادات سنوياً")}</span><b>${isNumber(c.metrics.QuarterlyRevenueGrowthYOY) ? pct(c.metrics.QuarterlyRevenueGrowthYOY * 100) : "—"}</b></div><div class="metric"><span>${L("Earnings growth YoY", "نمو الأرباح سنوياً")}</span><b>${isNumber(c.metrics.QuarterlyEarningsGrowthYOY) ? pct(c.metrics.QuarterlyEarningsGrowthYOY * 100) : "—"}</b></div></div><dl class="key-values">${[
    ["StrongBuy", L("Strong buy analysts", "محللو شراء قوي")],
    ["Buy", L("Buy analysts", "محللو شراء")],
    ["Hold", L("Hold analysts", "محللو احتفاظ")],
    ["Sell", L("Sell analysts", "محللو بيع")],
    ["StrongSell", L("Strong sell analysts", "محللو بيع قوي")],
  ]
    .map(([k, v]) => `<div><dt>${v}</dt><dd>${fmt(a[k], 0)}</dd></div>`)
    .join(
      "",
    )}</dl><p class="body-copy">${L("Provider ratings run from 1 (strong sell) to 5 (strong buy). Analyst targets are estimates, not promises. An unavailable consensus is shown as —.", "تتراوح تصنيفات المزود من 1 (بيع قوي) إلى 5 (شراء قوي). الأسعار المستهدفة تقديرات وليست وعوداً. يظهر الإجماع غير المتوفر بعلامة —.")}</p></div><div class="research-note"><b>${L("Shariah classifications", "التصنيفات الشرعية")}</b><p>${L("A licensed Shariah-screening feed is not connected. BIN EISA does not infer compliance or purification percentages from general financial data.", "لا يوجد اتصال بمصدر مرخص للتصنيف الشرعي. لا تستنتج بن عيسى التوافق أو نسب التطهير من البيانات المالية العامة.")}</p></div>`;
}
function chartMarkup(rows) {
  if (!rows.length)
    return empty(
      L("No price history for this range", "لا يوجد سجل أسعار لهذه الفترة"),
      L("Choose another time range.", "اختر فترة زمنية أخرى."),
    );
  const w = 780,
    h = 290,
    pad = 40,
    values = rows.map((r) => r.close),
    min = Math.min(...values),
    max = Math.max(...values),
    spread = max - min || Math.max(Math.abs(max) * 0.01, 1);
  const x = (i) => pad + (i / Math.max(rows.length - 1, 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - min) / spread) * (h - pad * 2);
  const points = rows
    .map((r, i) => `${x(i).toFixed(2)},${y(r.close).toFixed(2)}`)
    .join(" ");
  return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${e(L(`${symbol} historical adjusted daily closing prices`, `${symbol} أسعار الإغلاق اليومية التاريخية المعدلة`))}"><defs><linearGradient id="price-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d1b16a" stop-opacity=".16"/><stop offset="1" stop-color="#d1b16a" stop-opacity="0"/></linearGradient></defs>${[
    0, 0.25, 0.5, 0.75, 1,
  ]
    .map((r) => {
      const v = min + r * spread;
      return `<line class="chart-grid" x1="${pad}" x2="${w - pad}" y1="${y(v)}" y2="${y(v)}"/><text x="${w - pad + 5}" y="${y(v) + 3}">${fmt(v, 0)}</text>`;
    })
    .join(
      "",
    )}<polygon points="${pad},${h - pad} ${points} ${x(rows.length - 1)},${h - pad}" fill="url(#price-area)"/><polyline class="chart-line" points="${points}"/>${[0, Math.floor((rows.length - 1) / 2), rows.length - 1].map((i) => `<text x="${x(i)}" y="${h - 10}" text-anchor="middle">${e(date(rows[i].date))}</text>`).join("")}</svg><p id="chart-readout" class="chart-readout" aria-live="polite"></p><label for="chart-point">${L("Explore daily prices", "استعرض الأسعار اليومية")}</label><input id="chart-point" type="range" min="0" max="${rows.length - 1}" value="${rows.length - 1}" style="width:100%;accent-color:var(--gold)"></div>`;
}
async function loadChart() {
  await requestInto(
    "chart-area",
    () => api("history", { symbol, range: state.range }),
    (r) => {
      state.chartRows = r.data;
      return chartMarkup(r.data) + source(r.meta);
    },
  );
  const input = document.getElementById("chart-point");
  if (input) {
    const update = () => {
      const r = state.chartRows[Number(input.value)];
      const text = `${date(r.date)} · ${fmt(r.close)} ${state.company?.currency || ""} · ${L("Volume", "الحجم")}: ${compact(r.volume)}`;
      document.getElementById("chart-readout").textContent = text;
      input.setAttribute("aria-valuetext", text);
    };
    input.addEventListener("input", update);
    update();
  }
}
async function loadQuote() {
  const host = document.getElementById("quote-area");
  if (!host) return;
  await requestInto(
    "quote-area",
    () => api("quotes", { symbols: symbol }),
    (r) => {
      const q = r.data.find((x) => x.symbol === symbol) || r.data[0];
      if (!q || !isNumber(q.price))
        return empty(
          L("Quote unavailable", "السعر غير متوفر"),
          L(
            "No delayed quote was returned for this stock.",
            "لم يتم إرجاع سعر متأخر لهذا السهم.",
          ),
        );
      const c = state.company;
      return `<div class="price-block"><span class="price-value">${fmt(q.price)}</span><small>${e(c?.currency || "")}</small><span class="numeric ${color(q.changePercent)}">${pct(q.changePercent)} (${fmt(q.change)})</span></div><p class="price-meta">${L("Delayed 15–20 min · Quote as of", "متأخر 15–20 دقيقة · وقت السعر")} ${e(time(q.asOf))}${state.status?.demo ? " · PROVIDER DEMO" : ""}</p>`;
    },
  );
}
function detailPanel(c, meta, tab) {
  if (tab === "financials") return reportContent(c, meta);
  if (tab === "analysis") return analysisContent(c);
  if (tab === "news") return `<div id="stock-news"></div>`;
  return `<div class="detail-grid"><section class="panel panel-pad"><div id="quote-area">${loading()}</div><div class="chart-toolbar"><h3>${L("Price history", "سجل الأسعار")}</h3><div class="segmented" aria-label="${L("Chart range", "فترة الرسم البياني")}">${["1M", "3M", "6M", "1Y", "5Y"].map((r) => `<button data-range="${r}" aria-pressed="${state.range === r}">${r}</button>`).join("")}</div></div><div id="chart-area">${loading()}</div></section><aside class="panel panel-pad"><span class="eyebrow">${L("COMPANY SNAPSHOT", "لمحة عن الشركة")}</span><dl class="key-values">${[
    [L("Exchange", "البورصة"), c.exchange],
    [L("Sector", "القطاع"), c.sector],
    [L("Industry", "الصناعة"), c.industry],
    [L("Country", "الدولة"), c.country],
    [L("Employees", "الموظفون"), compact(c.employees)],
    [L("IPO date", "تاريخ الإدراج"), date(c.ipoDate)],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${e(v || "—")}</dd></div>`)
    .join(
      "",
    )}</dl>${c.website ? `<a class="text-link" href="${e(c.website)}" target="_blank" rel="noopener noreferrer">${L("Company website", "موقع الشركة")} ↗</a>` : ""}<a class="button gold" href="https://bineisa.com/">${L("INVEST NOW ↗", "استثمر الآن ↗")}</a></aside></div>${metrics(c)}<section class="panel panel-pad"><h2>${L("About the company", "عن الشركة")}</h2><p class="body-copy">${e(c.description || L("A company description is not available from the provider.", "وصف الشركة غير متوفر لدى المزود."))}</p></section>${source(meta)}`;
}
async function stockDetail(report = false) {
  const tab = report
    ? "financials"
    : ["overview", "financials", "analysis", "news"].includes(params.get("tab"))
      ? params.get("tab")
      : "overview";
  document.title = `${symbol} — BIN EISA Stocks`;
  main.innerHTML = `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">${L("Overview", "الرئيسية")}</a><span>/</span><a href="${report ? "/reports" : "/stocks"}">${report ? L("Reports", "التقارير") : L("Stocks", "الأسهم")}</a><span>/</span><span>${e(symbol)}</span></nav><div class="stock-heading"><div class="stock-identity"><span class="ticker-monogram">${e(symbol?.split(".")[0].slice(0, 3))}</span><div><h1 id="company-title">${e(symbol)}</h1><p id="company-subtitle">${L("Company research & analysis", "أبحاث وتحليلات الشركة")}</p></div></div><div class="actions"><button class="button" data-save="${e(symbol)}" data-kind="watchlist">☆ ${L("Watchlist", "قائمة المراقبة")}</button><button class="button" data-save="${e(symbol)}" data-kind="private">${L("Save privately", "حفظ خاص")}</button><a class="button gold" href="https://bineisa.com/">${L("INVEST NOW ↗", "استثمر الآن ↗")}</a></div></div><nav class="detail-tabs" aria-label="${L("Stock sections", "أقسام السهم")}">${[
    ["overview", L("Overview", "نظرة عامة")],
    ["financials", L("Financials & reports", "البيانات والتقارير المالية")],
    ["analysis", L("Analysis", "التحليل")],
    ["news", L("Company news", "أخبار الشركة")],
  ]
    .map(
      ([key, label]) =>
        `<a href="${stockUrl(symbol)}?tab=${key}" ${key === tab ? 'aria-current="page"' : ""}>${label}</a>`,
    )
    .join("")}</nav><div id="stock-detail">${loading()}</div>`;
  syncSaveButtons();
  activeRefresh = async () => {
    await requestInto(
      "stock-detail",
      () => api("company", { symbol }),
      (r) => {
        state.company = r.data;
        document.getElementById("company-title").textContent = r.data.name;
        document.getElementById("company-subtitle").textContent =
          `${symbol} · ${r.data.exchange || "—"} · ${r.data.currency || "—"}`;
        document.title = `${r.data.name} (${symbol}) — BIN EISA Stocks`;
        return detailPanel(r.data, r.meta, tab);
      },
    );
    if (document.getElementById("chart-area")) {
      loadQuote();
      loadChart();
    }
    if (document.getElementById("stock-news"))
      requestInto(
        "stock-news",
        () => api("news", { symbol }),
        (r) => {
          state.news = r.data;
          return newsCards(r.data) + source(r.meta);
        },
      );
  };
  await activeRefresh();
}

async function watchPage(privateList = false) {
  const kind = privateList ? "private" : "watchlist";
  document.title = privateList
    ? "Private stocks — BIN EISA Stocks"
    : "Watchlist — BIN EISA Stocks";
  main.innerHTML =
    heading(
      privateList
        ? L("A space for your conviction.", "مساحة لرؤيتك الخاصة.")
        : L("Your companies. In focus.", "شركاتك. تحت المتابعة."),
      privateList
        ? L(
            "A private collection of listed stocks and research notes, visible only to your signed-in account.",
            "مجموعة خاصة من الأسهم المدرجة والملاحظات البحثية، لا يراها إلا حسابك المسجل.",
          )
        : L(
            "Keep the companies you follow together, with delayed quotes from the market-data provider.",
            "اجمع الشركات التي تتابعها مع أسعار متأخرة من مزود بيانات السوق.",
          ),
      `<a class="button gold" href="/search">+ ${L("Find a stock", "ابحث عن سهم")}</a>`,
    ) +
    `<div id="watch-results" class="panel"></div><div class="research-note">${privateList ? L("Private stocks is your personal research list of publicly listed companies. It is not a marketplace for unlisted securities.", "الأسهم الخاصة هي قائمتك البحثية للشركات المدرجة، وليست سوقاً للأوراق المالية غير المدرجة.") : lists.user ? L("Saved to your account. Your guest list stays separately on the device where it was created.", "محفوظة في حسابك. تبقى قائمة الزائر منفصلة على الجهاز الذي أنشئت عليه.") : L("Saved only in this browser. Sign in for account-based lists across devices. Your guest list stays on this device.", "محفوظة في هذا المتصفح فقط. سجّل الدخول للقوائم المرتبطة بالحساب عبر الأجهزة. تبقى قائمة الزائر على هذا الجهاز.")}</div>${investCta()}`;
  const host = document.getElementById("watch-results");
  if (privateList && !lists.user) {
    host.innerHTML = empty(
      L(
        "Your private research starts with an account",
        "بحثك الخاص يبدأ بحساب",
      ),
      L(
        "Sign in to save stocks privately and keep your research notes together.",
        "سجّل الدخول لحفظ الأسهم بشكل خاص وجمع ملاحظاتك البحثية.",
      ),
      `<a class="button gold" href="/auth/login?next=/private-watchlist">${L("Sign in", "تسجيل الدخول")}</a><a class="text-link" href="/auth/register?next=/private-watchlist">${L("Create an account", "إنشاء حساب")} →</a>`,
    );
    activeRefresh = () => watchPage(privateList);
    return;
  }
  if (lists.error) {
    host.innerHTML = errorState(lists.error);
    activeRefresh = async () => {
      try {
        await lists.load();
      } catch {}
      watchPage(privateList);
    };
    return;
  }
  const rows = lists.list(kind);
  if (!rows.length) {
    host.innerHTML = empty(
      L("Your list is ready for its first company", "قائمتك جاهزة لأول شركة"),
      L(
        "Search for a stock, open its profile, then save it to this list.",
        "ابحث عن سهم وافتح ملفه ثم احفظه في هذه القائمة.",
      ),
      `<a class="button gold" href="/search">${L("Explore stocks", "استكشف الأسهم")} →</a>`,
    );
    activeRefresh = () => watchPage(privateList);
    return;
  }
  host.innerHTML =
    rows
      .map(
        (r) =>
          `<article class="watch-item"><div class="watch-heading"><div><a href="${stockUrl(r.symbol)}"><h2>${e(r.symbol)}</h2></a><span id="quote-${e(r.symbol)}" class="muted">${L("Loading quote…", "تحميل السعر…")}</span></div><div class="actions"><a class="text-link" href="${reportUrl(r.symbol)}">${L("Report", "التقرير")} ↗</a><button class="button compact" data-save="${e(r.symbol)}" data-kind="${kind}">${L("Remove", "إزالة")}</button></div></div>${privateList ? `<form class="private-note" data-note="${e(r.symbol)}"><label for="note-${e(r.symbol)}">${L("Private research note", "ملاحظة بحثية خاصة")}</label><textarea id="note-${e(r.symbol)}" name="note" rows="3" maxlength="2000" placeholder="${L("What do you want to understand about this company?", "ما الذي تريد فهمه عن هذه الشركة؟")}">${e(r.note)}</textarea><div class="actions"><button class="button compact">${L("Save note", "حفظ الملاحظة")}</button><small class="muted">${L("Only you can see this note · 2,000 characters max", "أنت فقط تستطيع رؤية هذه الملاحظة · 2,000 حرف كحد أقصى")}</small></div></form>` : ""}</article>`,
      )
      .join("") +
    `<div class="data-note">EODHD · ${L("Quotes delayed 15–20 minutes", "أسعار متأخرة 15–20 دقيقة")}${state.status?.demo ? " · PROVIDER DEMO" : ""}</div>`;
  for (let i = 0; i < rows.length; i += 20) {
    const group = rows.slice(i, i + 20);
    try {
      const result = await api("quotes", {
        symbols: group.map((r) => r.symbol).join(","),
      });
      group.forEach((r) => {
        const q = result.data.find((x) => x.symbol === r.symbol);
        const el = document.getElementById("quote-" + r.symbol);
        if (el)
          el.textContent =
            q && isNumber(q.price)
              ? `${fmt(q.price)} · ${pct(q.changePercent)} · ${time(q.asOf)}`
              : L("Quote unavailable", "السعر غير متوفر");
      });
    } catch {
      group.forEach((r) => {
        const el = document.getElementById("quote-" + r.symbol);
        if (el)
          el.textContent = L(
            "Quote unavailable — your saved stock is retained.",
            "السعر غير متوفر — السهم المحفوظ باقٍ في قائمتك.",
          );
      });
    }
  }
  activeRefresh = () => watchPage(privateList);
}

function methodology() {
  document.title = "Data & methodology — BIN EISA Stocks";
  main.innerHTML = `<div class="methodology">${heading(L("Good research starts with clarity.", "البحث الجيد يبدأ بالوضوح."), L("Understand where the numbers come from, how current they are and what the platform supports.", "تعرّف على مصدر الأرقام ومدى حداثتها وما تدعمه المنصة."))}<section><h2>${L("Market coverage", "تغطية الأسواق")}</h2><p>${L("EODHD supplies the market-data integration. US equities are the initial configured market, matching the public focus of the reference platform. Additional exchanges can be enabled only after coverage and public-display rights are confirmed with the provider.", "يُستخدم EODHD لربط بيانات السوق. الأسهم الأمريكية هي السوق المهيأ مبدئياً. يمكن تفعيل بورصات إضافية بعد تأكيد التغطية وحقوق العرض العام مع المزود.")}</p><p class="body-copy">${state.status?.configured ? L("A provider credential is configured. Availability of each dataset still depends on the subscription and provider response.", "تم إعداد بيانات اتصال المزود. يعتمد توفر كل مجموعة بيانات على الاشتراك واستجابة المزود.") : L("The market-data connection has not been activated. Stock prices and financials remain unavailable until the provider is configured.", "لم يتم تفعيل اتصال بيانات السوق. تبقى الأسعار والبيانات المالية غير متوفرة حتى إعداد المزود.")}</p><a class="text-link" href="https://eodhd.com/financial-apis/quick-start-with-our-financial-data-apis" target="_blank" rel="noopener noreferrer">${L("Provider coverage documentation", "توثيق تغطية المزود")} ↗</a></section><section><h2>${L("Prices and timestamps", "الأسعار وأوقات التحديث")}</h2><p>${L("Stock-detail and watchlist quotes use EODHD’s delayed snapshot feed, generally 15–20 minutes behind. The stock directory and screener show end-of-day prices. Historical charts use adjusted daily closes, which account for corporate actions. They are not intraday trading charts. A quote timestamp is different from the time we fetched or cached the response.", "تستخدم صفحات الأسهم وقوائم المراقبة أسعار EODHD المتأخرة عادةً 15–20 دقيقة. يعرض الدليل وقائمة التصفية أسعار نهاية اليوم. تستخدم الرسوم أسعار الإغلاق اليومية المعدلة للأحداث المؤسسية وليست رسوماً لحظية للتداول. يختلف توقيت السعر عن وقت جلب الاستجابة أو تخزينها مؤقتاً.")}</p></section><section><h2>${L("Financial reports and analysis", "التقارير والتحليل المالي")}</h2><p>${L("Reports display provider-supplied annual and quarterly statements, company metrics and analyst consensus where available. A report is a structured view of data, not a commissioned research opinion. Targets and ratings are attributed to the provider. Missing information is shown as —, never invented.", "تعرض التقارير القوائم السنوية والربع سنوية ومؤشرات الشركات وإجماع المحللين المتوفر من المزود. التقرير عرض منظم للبيانات وليس رأياً بحثياً مكلفاً. تُنسب الأهداف والتصنيفات للمزود. تظهر البيانات غير المتوفرة بعلامة — ولا يتم اختلاقها.")}</p></section><section><h2>${L("News and sentiment", "الأخبار والتصنيفات")}</h2><p>${L("Headlines link to the original publisher. Sentiment is supplied by EODHD: above 0.1 is positive, below −0.1 is negative, and the interval between is neutral. Articles without a score are unrated. These classifications describe text sentiment, not investment suitability.", "ترتبط العناوين بالناشر الأصلي. يوفر EODHD درجات التصنيف: أعلى من 0.1 إيجابي، أقل من −0.1 سلبي، وبينهما محايد. الأخبار بلا درجة غير مصنفة. تصف هذه التصنيفات محتوى النص ولا تحدد ملاءمة الاستثمار.")}</p></section><section><h2>${L("Private lists and accounts", "القوائم الخاصة والحسابات")}</h2><p>${L("Guest watchlists and saved headlines stay in your browser. Signed-in stock lists and private notes are stored in Supabase and protected by policies restricting access to the owning account. BIN EISA Stocks accounts and bineisa.com accounts are separate; links connect the sites, not account credentials.", "تبقى قوائم الزائر والأخبار المحفوظة في المتصفح. تُخزن قوائم الحساب والملاحظات الخاصة في Supabase مع سياسات تقصر الوصول على صاحب الحساب. حسابات أسهم بن عيسى وحسابات bineisa.com منفصلة؛ تربط الروابط الموقعين ولا تشارك بيانات تسجيل الدخول.")}</p></section><section><h2>${L("Shariah-screening coverage", "تغطية التصنيف الشرعي")}</h2><p>${L("No Shariah-screening provider is connected. Compliance labels and purification ratios require separately licensed, sourced data and are not currently displayed.", "لم يتم ربط مزود للتصنيف الشرعي. تتطلب تصنيفات التوافق ونسب التطهير بيانات مرخصة ذات مصدر مستقل، ولا يتم عرضها حالياً.")}</p></section><section><h2>${L("Questions about the platform?", "استفسارات حول المنصة؟")}</h2><p>BinEisa General Trading LLC<br><a href="mailto:info@bineisa.com">info@bineisa.com</a> · <a href="tel:+971543366554" dir="ltr">+971 54 336 6554</a></p></section></div>${investCta()}`;
}

function render() {
  state.version++;
  state.company = null;
  activeRefresh = null;
  translateShell();
  if (route === "/") home();
  else if (route === "/stocks") stockList();
  else if (route === "/reports") stockList(true);
  else if (route === "/search") searchPage();
  else if (route === "/news") newsPage();
  else if (route === "/watchlist") watchPage();
  else if (route === "/private-watchlist") watchPage(true);
  else if (route === "/data-sources") methodology();
  else if (symbol) stockDetail(route.startsWith("/reports/"));
}
main.addEventListener("click", async (event) => {
  const btn = event.target.closest("button");
  if (!btn || btn.disabled) return;
  if (btn.hasAttribute("data-retry")) {
    activeRefresh?.();
    return;
  }
  if (btn.dataset.page !== undefined) {
    params.set("offset", btn.dataset.page);
    location.search = params;
    return;
  }
  if (btn.dataset.save) {
    btn.disabled = true;
    try {
      const saved = await lists.toggle(
        btn.dataset.save,
        btn.dataset.kind || "watchlist",
      );
      if (route.includes("watchlist"))
        await watchPage(route === "/private-watchlist");
      else {
        syncSaveButtons();
        toast(
          saved
            ? L("Stock saved.", "تم حفظ السهم.")
            : L("Stock removed.", "تمت إزالة السهم."),
        );
      }
    } catch (err) {
      saveError(err);
    } finally {
      btn.disabled = false;
    }
    return;
  }
  if (btn.dataset.range) {
    state.range = btn.dataset.range;
    main
      .querySelectorAll("[data-range]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    await loadChart();
    return;
  }
  if (btn.dataset.period) {
    state.period = btn.dataset.period;
    main
      .querySelectorAll("[data-period]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    document.getElementById("statements").innerHTML = statementContent();
    return;
  }
  if (btn.hasAttribute("data-export")) {
    const c = state.company;
    if (!c) return;
    const rows = [
      [
        "BIN EISA Stocks",
        c.symbol,
        "Source: EODHD",
        "Fundamentals updated",
        c.updatedAt,
      ],
      ["Statement", "Period", "Date", "Currency", "Metric", "Value"],
    ];
    for (const [key, s] of Object.entries(c.financials))
      for (const r of s[state.period])
        for (const [field, value] of Object.entries(r))
          if (field in FIELDS)
            rows.push([
              STATEMENTS[key][0],
              state.period,
              r.date,
              s.currency,
              FIELDS[field][0],
              value,
            ]);
    downloadCsv(`BIN-EISA-${c.symbol}-${state.period}.csv`, rows);
    return;
  }
  if (btn.hasAttribute("data-print")) {
    window.print();
    return;
  }
  if (btn.dataset.sentiment) {
    state.sentiment = btn.dataset.sentiment;
    main
      .querySelectorAll("[data-sentiment]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    document.getElementById("news-results").innerHTML =
      newsCards(state.news) +
      (state.savedOnly
        ? ""
        : source(state.newsMeta) + pager(state.offset, state.newsHasMore));
    return;
  }
  if (btn.hasAttribute("data-saved-news")) {
    state.savedOnly = !state.savedOnly;
    newsPage();
    return;
  }
  if (btn.dataset.saveNews) {
    try {
      let saved = savedNews();
      const exists = saved.some((x) => x.url === btn.dataset.saveNews);
      const article = state.news.find((x) => x.url === btn.dataset.saveNews);
      if (exists) saved = saved.filter((x) => x.url !== btn.dataset.saveNews);
      else if (article) saved = [article, ...saved].slice(0, 100);
      localStorage.setItem("bineisa-news-v1", JSON.stringify(saved));
      btn.setAttribute("aria-pressed", String(!exists));
      btn.textContent = `${exists ? "☆" : "★"} ${L("Save", "حفظ")}`;
      toast(
        L(
          "Saved headlines updated on this device.",
          "تم تحديث الأخبار المحفوظة على هذا الجهاز.",
        ),
      );
    } catch {
      toast(L("Browser storage is unavailable.", "تخزين المتصفح غير متوفر."));
    }
    return;
  }
  if (btn.dataset.share) {
    try {
      if (navigator.share) await navigator.share({ url: btn.dataset.share });
      else {
        await navigator.clipboard.writeText(btn.dataset.share);
        toast(L("Article link copied.", "تم نسخ رابط الخبر."));
      }
    } catch (err) {
      if (err.name !== "AbortError")
        toast(
          L(
            "Use the article link to share this story.",
            "استخدم رابط الخبر لمشاركته.",
          ),
        );
    }
  }
});
main.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-note]");
  if (!form) return;
  event.preventDefault();
  const btn = form.querySelector("button");
  btn.disabled = true;
  try {
    await lists.note(form.dataset.note, String(new FormData(form).get("note")));
    toast(L("Private note saved.", "تم حفظ الملاحظة الخاصة."));
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
});
document.addEventListener("bineisa:langchange", render);
const initial = await Promise.allSettled([api("status"), lists.init()]);
if (initial[0].status === "fulfilled") {
  state.status = initial[0].value.data;
  if (!params.has("exchange")) state.exchange = state.status.defaultExchange;
}
if (initial[1].status === "rejected") lists.error = initial[1].reason;
render();
if (window.sbClient)
  window.sbClient.auth.onAuthStateChange((event, session) => {
    const user = session?.user || null;
    if (user?.id === lists.user?.id) return;
    lists.user = user;
    lists.rows = [];
    lists.error = null;
    state.version++;
    // Clear account-owned content before loading any replacement session.
    if (route.includes("watchlist")) main.innerHTML = loading();
    setTimeout(async () => {
      try {
        await lists.load();
      } catch {}
      render();
    }, 0);
  });
// Quotes refresh while the page is visible; user notes and chart selection are preserved.
setInterval(() => {
  if (!document.hidden && document.getElementById("quote-area")) loadQuote();
}, 60000);

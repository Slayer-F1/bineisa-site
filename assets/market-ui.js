export const L = (en, ar) => (window.currentLang === "ar" ? ar : en);
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const isNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);
export const fmt = (v, decimals = 2) =>
  isNumber(v)
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(v)
    : "—";
export const compact = (v) =>
  isNumber(v)
    ? new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(v)
    : "—";
export const pct = (v) => (isNumber(v) ? `${v > 0 ? "+" : ""}${fmt(v)}%` : "—");
export const color = (v) =>
  isNumber(v) ? (v > 0 ? "positive" : v < 0 ? "negative" : "muted") : "muted";
export const date = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString(window.currentLang === "ar" ? "ar-AE" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
};
export const time = (v) => {
  if (!v) return L("Timestamp unavailable", "وقت التحديث غير متوفر");
  const d = new Date(v);
  return Number.isFinite(d.getTime())
    ? `${date(v)} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
    : L("Timestamp unavailable", "وقت التحديث غير متوفر");
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${{ search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', chart: '<path d="M4 4v16h17M7 15l4-5 4 2 5-7"/>', report: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7"/>', news: '<path d="M4 4h16v16H4zM7 8h10M7 12h4M7 16h10M14 11h3v3h-3z"/>', lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>', star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>' }[name] || ""}</svg>`;
export function loading() {
  return `<div class="loading-block" role="status" aria-label="${L("Loading data", "تحميل البيانات")}"><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div>`;
}
export function empty(title, body, actions = "") {
  return `<div class="empty"><span class="empty-icon">${icon("chart")}</span><h3>${escape(title)}</h3><p>${escape(body)}</p>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
}
export function errorState(error) {
  const messages = {
    DATA_NOT_CONFIGURED: L(
      "Market data is not connected yet. Please check back shortly.",
      "بيانات السوق غير متصلة بعد. يرجى المحاولة لاحقاً.",
    ),
    DATA_ENTITLEMENT: L(
      "This dataset is not available under the current data subscription.",
      "هذه البيانات غير متوفرة ضمن الاشتراك الحالي.",
    ),
    RATE_LIMITED: L(
      "Too many requests. Please retry in a minute.",
      "طلبات كثيرة. يرجى المحاولة بعد دقيقة.",
    ),
  };
  return empty(
    L("Data currently unavailable", "البيانات غير متوفرة حالياً"),
    messages[error.code] || error.message,
    `<button class="button compact" data-retry>${L("Try again", "إعادة المحاولة")}</button><a class="text-link" href="/data-sources">${L("About our data ↗", "حول بياناتنا ↗")}</a>`,
  );
}
export async function api(path, params = {}, signal) {
  const query = new URLSearchParams(
    Object.entries(params).filter(
      ([, v]) => v !== "" && v !== undefined && v !== null,
    ),
  );
  let response;
  try {
    response = await fetch(`/api/${path}?${query}`, {
      signal: signal || AbortSignal.timeout(20000),
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw Object.assign(
      new Error(
        L(
          "Could not connect. Check your connection and try again.",
          "تعذر الاتصال. تحقق من اتصالك وحاول مرة أخرى.",
        ),
      ),
      { code: "NETWORK_ERROR" },
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      L(
        "The data service is unavailable. Please try again.",
        "خدمة البيانات غير متوفرة. يرجى المحاولة مجدداً.",
      ),
    );
  }
  if (!response.ok)
    throw Object.assign(new Error(body.error?.message || "Data unavailable"), {
      code: body.error?.code,
    });
  return body;
}
export function source(meta) {
  const kind =
    meta?.freshness === "delayed"
      ? L("Delayed quotes · 15–20 min", "أسعار متأخرة · 15–20 دقيقة")
      : meta?.freshness === "end-of-day"
        ? L("End-of-day data", "بيانات نهاية اليوم")
        : meta?.freshness === "company-reporting"
          ? L("Company reporting data", "بيانات تقارير الشركات")
          : L("Publisher timestamps", "توقيت الناشر");
  return `<div class="data-note"><span>EODHD · ${kind}${meta?.mode === "provider-demo" ? ` · ${L("PROVIDER DEMO", "عرض تجريبي للمزود")}` : ""}</span><a href="/data-sources">${L("Data & methodology ↗", "البيانات والمنهجية ↗")}</a></div>`;
}
export function searchForm(value = "") {
  return `<form class="search-form" role="search" action="/search">${icon("search")}<input type="search" name="q" value="${escape(value)}" aria-label="${L("Search by company or ticker", "ابحث باسم الشركة أو الرمز")}" placeholder="${L("Search a company or symbol…", "ابحث باسم الشركة أو الرمز…")}" maxlength="80" required autocomplete="off"><button type="submit" aria-label="${L("Search", "بحث")}">→</button></form>`;
}
export function investCta() {
  return `<section class="ecosystem-cta"><div><span class="eyebrow">${L("THE BIN EISA ECOSYSTEM", "عالم بن عيسى")}</span><h2>${L("Your research. Your next step.", "بحثك اليوم. خطوتك القادمة.")}</h2><p>${L("Explore BIN EISA’s businesses and investment opportunities on our main website.", "اكتشف أعمال بن عيسى والفرص الاستثمارية عبر موقعنا الرئيسي.")}</p></div><a class="button gold" href="https://bineisa.com/">${L("INVEST NOW ↗", "استثمر الآن ↗")}</a></section>`;
}
export function pager(offset, hasMore) {
  return `<div class="pager"><button class="button compact" data-page="${Math.max(0, offset - 20)}" ${offset === 0 ? "disabled" : ""}>← ${L("Previous", "السابق")}</button><span>${L("Page", "الصفحة")} ${Math.floor(offset / 20) + 1}</span><button class="button compact" data-page="${offset + 20}" ${!hasMore ? "disabled" : ""}>${L("Next", "التالي")} →</button></div>`;
}
export function csvCell(value) {
  let v = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(v) && !/^[-+]?\d+(\.\d+)?$/.test(v)) v = "'" + v;
  return '"' + v.replaceAll('"', '""') + '"';
}
export function downloadCsv(name, rows) {
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 6000);
}

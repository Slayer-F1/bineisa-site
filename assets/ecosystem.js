/* Shared site footer: brand, platform links, official BIN EISA contacts and
   the two-site ecosystem links. Rendered on every page that has #ecosystem-footer. */
(function () {
  const icons = {
    instagram:
      '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>',
    tiktok:
      '<path d="M14 3v12a4 4 0 1 1-4-4v3a1 1 0 1 0 1 1V3h3c.5 3 2.3 4.7 5 5v3c-2-.1-3.7-.9-5-2"/>',
  };
  const social = {
    instagram: {
      href: "https://www.instagram.com/bineisa.ae/",
      label: "Instagram @bineisa.ae",
    },
    tiktok: {
      href: "https://www.tiktok.com/@bineisa_ae",
      label: "TikTok @bineisa_ae",
    },
  };

  function renderFooter() {
    const el = document.getElementById("ecosystem-footer");
    if (!el) return;
    const ar = window.currentLang === "ar";
    const t = (en, arabic) => (ar ? arabic : en);
    const year = new Date().getFullYear();
    const socialLinks = Object.entries(social)
      .map(
        ([name, { href, label }]) =>
          `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${icons[name]}</svg></a>`,
      )
      .join("");
    el.innerHTML = `<div class="wrap footer-inner">
      <div class="footer-row">
        <a class="stock-brand" href="/" aria-label="${t("BIN EISA Stocks home", "الصفحة الرئيسية لأسهم بن عيسى")}"><svg class="brand-glyph" viewBox="0 0 15 23" aria-hidden="true"><rect x="0" y="14" width="3.6" height="9" rx=".8"/><rect x="5.7" y="7" width="3.6" height="16" rx=".8"/><rect x="11.4" y="0" width="3.6" height="23" rx=".8"/></svg><span class="brand-word">BIN EISA</span><span class="brand-tag">${t("STOCKS", "الأسهم")}</span></a>
        <nav class="footer-nav" aria-label="${t("Footer", "التذييل")}">
          <a href="/stocks">${t("Stocks", "الأسهم")}</a>
          <a href="/reports">${t("Financial reports", "التقارير المالية")}</a>
          <a href="/news">${t("Market news", "أخبار السوق")}</a>
          <a href="/data-sources">${t("Data & methodology", "البيانات والمنهجية")}</a>
          <a href="https://bineisa.com/">bineisa.com <span aria-hidden="true">↗</span></a>
        </nav>
        <div class="social-links">${socialLinks}</div>
      </div>
      <p class="footer-note">${t("Market data is for research and information. Prices may be delayed. Trades are not executed on this platform.", "بيانات السوق لأغراض البحث والمعلومات. قد تكون الأسعار متأخرة. لا يتم تنفيذ تداولات عبر هذه المنصة.")}</p>
      <div class="footer-bottom">
        <span>© ${year} BinEisa General Trading LLC</span>
        <span class="footer-contact"><a href="mailto:info@bineisa.com">info@bineisa.com</a> · <a href="tel:+971543366554" dir="ltr">+971 54 336 6554</a></span>
        <nav aria-label="${t("Legal", "قانوني")}">
          <a href="/legal/privacy">${t("Privacy", "الخصوصية")}</a>
          <a href="/legal/terms">${t("Terms", "الشروط")}</a>
          <a href="/legal/cookies">${t("Cookies", "ملفات الارتباط")}</a>
        </nav>
      </div>
    </div>`;
  }
  renderFooter();
  document.addEventListener("bineisa:langchange", renderFooter);
  const header = document.querySelector(".market-header");
  if (header) {
    const mark = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    mark();
    window.addEventListener("scroll", mark, { passive: true });
  }
})();

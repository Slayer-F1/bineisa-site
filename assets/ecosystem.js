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
    el.innerHTML = `<div class="wrap footer-grid">
      <div>
        <a class="stock-brand" href="/" aria-label="${t("BIN EISA Stocks home", "الصفحة الرئيسية لأسهم بن عيسى")}"><img class="brand-mark" src="/assets/logo-mark.svg" alt="" width="55" height="40"><span class="brand-rule" aria-hidden="true"></span><span class="brand-text"><img class="brand-wordmark" src="/assets/logo-wordmark.svg" alt="BIN EISA" width="91" height="15"><small>${t("STOCKS", "الأسهم")}</small></span></a>
        <p>${t("Research starts here.<br>Explore the world of BIN EISA.", "البحث يبدأ هنا.<br>اكتشف عالم بن عيسى.")}</p>
        <span class="footer-company">BinEisa General Trading LLC</span>
      </div>
      <div class="footer-links">
        <b>${t("The platform", "المنصة")}</b>
        <a href="/stocks">${t("Stocks", "الأسهم")}</a>
        <a href="/reports">${t("Financial reports", "التقارير المالية")}</a>
        <a href="/news">${t("Market news", "أخبار السوق")}</a>
        <a href="/data-sources">${t("Data & methodology", "البيانات والمنهجية")}</a>
      </div>
      <div class="footer-links">
        <b>${t("Get in touch", "تواصل معنا")}</b>
        <a href="mailto:info@bineisa.com">info@bineisa.com</a>
        <a href="tel:+971543366554" dir="ltr">+971 54 336 6554</a>
        <div class="social-links">${socialLinks}</div>
      </div>
      <div class="footer-links ecosystem-links">
        <b>${t("One BIN EISA ecosystem", "عالم بن عيسى")}</b>
        <a href="https://bineisastocks.com/">bineisastocks.com <span>↗</span></a>
        <a href="https://bineisa.com/">bineisa.com <span>↗</span></a>
      </div>
    </div>
    <div class="wrap footer-bottom">
      <p>${t("Market data is for research and information. Prices may be delayed. Trades are not executed on this platform.", "بيانات السوق لأغراض البحث والمعلومات. قد تكون الأسعار متأخرة. لا يتم تنفيذ تداولات عبر هذه المنصة.")}</p>
      <div>
        <span>© ${year} BinEisa General Trading LLC</span>
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
})();

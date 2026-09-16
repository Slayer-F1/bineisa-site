(function () {
  const icons = {
    instagram:
      '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>',
    tiktok:
      '<path d="M14 3v12a4 4 0 1 1-4-4v3a1 1 0 1 0 1 1V3h3c.5 3 2.3 4.7 5 5v3c-2-.1-3.7-.9-5-2"/>',
  };
  function renderFooter() {
    const el = document.getElementById("ecosystem-footer");
    if (!el) return;
    const ar = window.currentLang === "ar";
    el.innerHTML = `<div class="wrap footer-grid"><div><a class="stock-brand" href="/"><span class="brand-mark">BE</span><span><b>BIN EISA</b><small>STOCKS</small></span></a><p>${ar ? "البحث يبدأ هنا. اكتشف عالم بن عيسى." : "Research starts here.<br>Explore the world of BIN EISA."}</p><span class="footer-company">BinEisa General Trading LLC</span></div><div class="footer-links"><b>${ar ? "المنصة" : "The platform"}</b><a href="/stocks">${ar ? "الأسهم" : "Stocks"}</a><a href="/reports">${ar ? "التقارير المالية" : "Financial reports"}</a><a href="/news">${ar ? "أخبار السوق" : "Market news"}</a><a href="/data-sources">${ar ? "البيانات والمنهجية" : "Data & methodology"}</a></div><div class="footer-links"><b>${ar ? "تواصل معنا" : "Get in touch"}</b><a href="mailto:info@bineisa.com">info@bineisa.com</a><a href="tel:+971543366554" dir="ltr">+971 54 336 6554</a><div class="social-links">${Object.entries(
      icons,
    )
      .map(
        ([name, svg]) =>
          `<a href="${name === "instagram" ? "https://www.instagram.com/bineisa.ae/" : "https://www.tiktok.com/@bineisa_ae"}" target="_blank" rel="noopener noreferrer" aria-label="${name === "instagram" ? "Instagram @bineisa.ae" : "TikTok @bineisa_ae"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${svg}</svg></a>`,
      )
      .join(
        "",
      )}</div></div><div class="footer-links ecosystem-links"><b>${ar ? "عالم بن عيسى" : "One BIN EISA ecosystem"}</b><a href="https://bineisastocks.com/">bineisastocks.com <span>↗</span></a><a href="https://bineisa.com/">bineisa.com <span>↗</span></a><a class="button gold compact" href="https://bineisa.com/">${ar ? "استثمر الآن ↗" : "INVEST NOW ↗"}</a></div></div><div class="wrap footer-bottom"><p>${ar ? "بيانات السوق لأغراض البحث والمعلومات. قد تكون الأسعار متأخرة. لا يتم تنفيذ تداولات عبر هذه المنصة." : "Market data is for research and information. Prices may be delayed. Trades are not executed on this platform."}</p><div><span>© ${new Date().getFullYear()} BinEisa General Trading LLC</span><nav aria-label="Legal"><a href="/legal/privacy">${ar ? "الخصوصية" : "Privacy"}</a><a href="/legal/terms">${ar ? "الشروط" : "Terms"}</a><a href="/legal/cookies">${ar ? "ملفات الارتباط" : "Cookies"}</a></nav></div></div>`;
  }
  renderFooter();
  document.addEventListener("bineisa:langchange", renderFooter);
})();

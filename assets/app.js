/* Bin Eisa — shared site behaviour (all pages) */
(function(){
  // JS marker: reveal/entrance styles only apply when scripts run,
  // so content is never hidden in no-JS or headless contexts.
  document.documentElement.classList.add('js');

  // Supabase client (guard: CDN may be blocked; site must still render)
  window.sbClient = null;
  try{
    if(window.supabase && window.BINEISA_CONFIG){
      window.sbClient = window.supabase.createClient(
        window.BINEISA_CONFIG.supabaseUrl,
        window.BINEISA_CONFIG.supabaseKey
      );
    }
  }catch(e){ console.warn('Supabase init failed', e); }

  window.initLang();

  // Mobile menu
  const btn = document.getElementById('menuBtn');
  const nav = document.getElementById('mobileNav');
  if(btn && nav){
    btn.addEventListener('click', ()=>{
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click', ()=>{
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded','false');
    }));
  }

  // Reveal on scroll
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    },{threshold:.12});
    document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));
  }

  // Contact form -> mailto (home page only)
  const cf = document.getElementById('contactForm');
  if(cf){
    cf.addEventListener('submit', function(ev){
      ev.preventDefault();
      const f = ev.target;
      if(!f.reportValidity()) return;
      const subject = encodeURIComponent('Enquiry: ' + f.topic.options[f.topic.selectedIndex].text);
      const body = encodeURIComponent(
        'Name: ' + f.name.value + '\n' +
        'Contact: ' + f.contact.value + '\n\n' +
        f.message.value
      );
      window.location.href = 'mailto:info@bineisa.ae?subject=' + subject + '&body=' + body;
    });
  }

  // Header auth state: swap "Sign In" -> "My Account" when a session exists
  const authLink = document.getElementById('authLink');
  if(authLink && window.sbClient){
    window.sbClient.auth.getSession().then(({data})=>{
      if(data && data.session){
        authLink.setAttribute('data-i18n','navAccount');
        authLink.setAttribute('href', authLink.getAttribute('data-account-href') || 'account/index.html');
        authLink.textContent = window.t('navAccount');
      }
    }).catch(()=>{});
  }
})();

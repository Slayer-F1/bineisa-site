/* Bin Eisa — shared site behaviour (all pages). No inline handlers: CSP-safe. */
(function(){
  document.documentElement.classList.add('js');

  const CFG = window.BINEISA_CONFIG || {};

  // ── Supabase client (guard: CDN may be blocked; site must still render) ──
  window.sbClient = null;
  try{
    if(window.supabase && CFG.supabaseUrl && CFG.supabaseKey){
      window.sbClient = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
        auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
      });
    }
  }catch(e){ console.warn('Supabase init failed', e); }

  window.initLang();

  // ── Click guard: a button can only run one async action at a time ──
  // Ignores double-taps and accidental repeat clicks; restores the label after.
  window.guardClick = function(btn, fn){
    return async function(ev){
      if(!btn || btn.dataset.busy === '1') return;
      btn.dataset.busy = '1';
      btn.disabled = true;
      btn.setAttribute('aria-busy','true');
      try{ await fn(ev); }
      finally{
        delete btn.dataset.busy;
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    };
  };

  // ── Language toggle (event listeners, not inline onclick) ──
  document.querySelectorAll('[data-lang]').forEach(b=>{
    b.addEventListener('click', ()=> window.setLang(b.getAttribute('data-lang')));
  });

  // ── Mobile menu ──
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
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && nav.classList.contains('open')){ nav.classList.remove('open'); btn.setAttribute('aria-expanded','false'); } });
  }

  // ── Reveal on scroll ──
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

  // ── Contact channels: real links from config, "Available soon" otherwise ──
  function prettyPhone(e164){
    const m = /^\+971(\d)(\d{3})(\d{4})$/.exec(e164);
    return m ? `+971 ${m[1]}${m[2]} ${m[3]}` : e164;
  }
  function setChannel(id, href, text){
    const a = document.getElementById(id);
    if(!a) return;
    if(href){ a.setAttribute('href', href); a.textContent = text; a.removeAttribute('aria-disabled'); }
    else { a.removeAttribute('href'); a.setAttribute('aria-disabled','true'); a.setAttribute('data-i18n','chSoon'); a.textContent = window.t('chSoon'); }
  }
  const c = CFG.contact || {};
  setChannel('chEmailLink', c.email ? 'mailto:'+c.email : null, c.email);
  setChannel('chPhoneLink', c.phoneE164 ? 'tel:'+c.phoneE164 : null, c.phoneE164 ? prettyPhone(c.phoneE164) : '');
  setChannel('chWaLink', c.whatsappE164 ? 'https://wa.me/'+c.whatsappE164.replace('+','') : null, c.whatsappE164 ? prettyPhone(c.whatsappE164) : '');

  // ── Contact form → enquiries table (honeypot + validation + one submit at a time) ──
  const cf = document.getElementById('contactForm');
  if(cf){
    const loadedAt = Date.now();
    const msg = document.getElementById('contactMsg');
    const sendBtn = document.getElementById('contactSend');
    function showMsg(key, kind){
      msg.textContent = window.t(key);
      msg.setAttribute('data-i18n', key);
      msg.className = 'msg show ' + (kind === 'success' ? 'msg-success' : 'msg-error');
    }
    function fieldError(input, key){
      input.setAttribute('aria-invalid','true');
      input.focus();
      showMsg(key,'error');
    }
    cf.addEventListener('submit', window.guardClick(sendBtn, async function(ev){
      ev.preventDefault();
      cf.querySelectorAll('[aria-invalid]').forEach(i=>i.removeAttribute('aria-invalid'));
      msg.className = 'msg';
      const name = cf.name.value.trim();
      const contact = cf.contact.value.trim();
      const message = cf.message.value.trim();
      const topic = cf.topic.value;
      // Honeypot: real people never see or fill this field
      if(cf.company && cf.company.value){ showMsg('fSent','success'); cf.reset(); return; }
      if(Date.now() - loadedAt < 2500){ showMsg('errTooFast','error'); return; }
      if(name.length < 2 || name.length > 120){ fieldError(cf.name,'errName'); return; }
      const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact);
      const looksPhone = /^\+?[\d\s()-]{7,20}$/.test(contact);
      if(!(looksEmail || looksPhone) || contact.length > 160){ fieldError(cf.contact,'errContact'); return; }
      if(message.length < 10 || message.length > 4000){ fieldError(cf.message,'errMsg'); return; }
      if(!window.sbClient){ showMsg('fFail','error'); return; }
      sendBtn.textContent = window.t('fSending');
      try{
        const { error } = await window.sbClient.from('enquiries').insert({
          full_name: name, contact: contact, topic: topic, message: message, lang: window.currentLang
        });
        if(error){
          showMsg(/rate_limited/i.test(error.message) ? 'errRate' : 'fFail', 'error');
        } else {
          showMsg('fSent','success');
          cf.reset();
        }
      }catch(e){ showMsg('fFail','error'); }
      finally{ sendBtn.textContent = window.t('fSend'); }
    }));
  }

  // ── Header auth state: swap "Sign In" -> "My Account" when a session exists ──
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

  // ── Idle logout helper (used by the member dashboard) ──
  window.startIdleLogout = function(minutes, onIdle){
    const ms = Math.max(1, minutes || 15) * 60 * 1000;
    let timer = null;
    const reset = ()=>{ if(timer) clearTimeout(timer); timer = setTimeout(onIdle, ms); };
    ['mousemove','keydown','touchstart','scroll','click','visibilitychange'].forEach(ev=>
      document.addEventListener(ev, reset, { passive: true })
    );
    reset();
    return ()=>{ if(timer) clearTimeout(timer); };
  };
})();

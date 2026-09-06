/* Bin Eisa — passwordless auth (email + mobile as account details, one-time codes) */
(function(){
  const CFG = window.BINEISA_CONFIG || {};
  const sb = window.sbClient;
  const loadedAt = Date.now();
  const RESEND_SECONDS = 60;
  const PRIMARY = (CFG.authChannel === 'email') ? 'email' : 'phone';

  const $ = id => document.getElementById(id);
  const msg = $('authMsg');
  const regForm = $('registerForm');
  const loginForm = $('loginForm');
  const codeForm = $('codeForm');
  const stepForm = regForm || loginForm;   // step 1: the details form on this page
  const stepCode = codeForm;               // step 2: the one-time-code form

  function show(key, kind){
    if(!msg) return;
    msg.textContent = window.t(key);
    msg.setAttribute('data-i18n', key);
    msg.className = 'msg show ' + (kind === 'success' ? 'msg-success' : kind === 'info' ? 'msg-info' : 'msg-error');
  }
  function showRaw(text){
    if(!msg) return;
    msg.textContent = text;
    msg.removeAttribute('data-i18n');
    msg.className = 'msg show msg-error';
  }
  function hide(){ if(msg) msg.className = 'msg'; }
  function fieldError(input, key){
    if(input){ input.setAttribute('aria-invalid','true'); input.focus(); }
    show(key,'error');
  }
  function mapError(error, phase){
    if(!error) return null;
    const code = String(error.code || '');
    const m = (error.message || '').toLowerCase();
    if(error.status === 429 || /rate_limit|rate limit|too many/.test(code + ' ' + m)) return 'errRate';
    if(code === 'email_address_invalid' || /email address .* is invalid/.test(m)) return 'errEmail';
    if(code === 'otp_disabled' || code === 'user_not_found' || /signups not allowed/.test(m)) return 'errNoAccount';
    if(/phone provider|unsupported phone|sms provider|phone_provider_disabled/.test(code + ' ' + m)) return 'errSmsOff';
    if(code === 'validation_failed' && /phone/.test(m)) return 'errPhone';
    if(phase === 'verify' && (code === 'otp_expired' || /invalid|expired|token/.test(m))) return 'errCodeInvalid';
    return null;
  }

  // ── Phone normalisation to E.164 (UAE shortcuts + international) ──
  window.normalizePhone = function(raw){
    let s = String(raw || '').replace(/[\s()\-.]/g,'');
    s = s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)); // Arabic-Indic digits
    if(/^00/.test(s)) s = '+' + s.slice(2);
    if(/^05\d{8}$/.test(s)) s = '+971' + s.slice(1);
    if(/^5\d{8}$/.test(s)) s = '+971' + s;
    if(/^9715\d{8}$/.test(s)) s = '+' + s;
    return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
  };
  const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  // ── Pending OTP state (survives a refresh of the code step) ──
  const KEY = 'bineisa-otp';
  function savePending(p){ try{ sessionStorage.setItem(KEY, JSON.stringify(Object.assign({ts:Date.now()}, p))); }catch(e){} }
  function loadPending(){ try{ const p = JSON.parse(sessionStorage.getItem(KEY)||'null'); return p && Date.now()-p.ts < 10*60*1000 ? p : null; }catch(e){ return null; } }
  function clearPending(){ try{ sessionStorage.removeItem(KEY); }catch(e){} }
  let pending = null;

  // ── Optional Turnstile captcha ──
  let captchaToken = null;
  function mountCaptcha(){
    if(!CFG.captchaSiteKey) return;
    const host = $('captcha');
    if(!host) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = ()=>{ try{ window.turnstile.render(host, { sitekey: CFG.captchaSiteKey, callback: t => { captchaToken = t; } }); }catch(e){} };
    document.head.appendChild(s);
  }
  mountCaptcha();

  // ── Step switching + resend cooldown ──
  let cooldownTimer = null;
  function startCooldown(){
    const b = $('resendBtn');
    if(!b) return;
    let s = RESEND_SECONDS;
    b.disabled = true;
    b.textContent = window.t('resendIn',{s});
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(()=>{
      s -= 1;
      if(s <= 0){ clearInterval(cooldownTimer); b.disabled = false; b.textContent = window.t('resendBtn'); }
      else b.textContent = window.t('resendIn',{s});
    }, 1000);
  }
  function gotoCode(){
    if(stepForm) stepForm.classList.add('hidden');
    if(stepCode) stepCode.classList.remove('hidden');
    const sub = $('codeSub');
    if(sub){ sub.setAttribute('data-i18n', pending.channel === 'phone' ? 'codeSubPhone' : 'codeSub'); sub.textContent = window.t(sub.getAttribute('data-i18n')); }
    const dest = $('codeDest');
    if(dest) dest.textContent = pending.channel === 'phone' ? pending.phone : pending.email;
    const chg = $('changeBtn');
    if(chg){
      chg.setAttribute('data-i18n', pending.channel === 'phone' ? 'changeNumber' : 'changeEmail');
      chg.textContent = window.t(chg.getAttribute('data-i18n'));
    }
    const input = $('f-code');
    if(input){ input.value = ''; setTimeout(()=>input.focus(), 50); }
    startCooldown();
  }
  function gotoForm(){
    clearPending(); pending = null;
    if(stepCode) stepCode.classList.add('hidden');
    if(stepForm) stepForm.classList.remove('hidden');
    hide();
  }

  // ── Send the one-time code ──
  async function sendCode(p, isRegister){
    const opts = { shouldCreateUser: !!isRegister };
    if(captchaToken) opts.captchaToken = captchaToken;
    if(p.channel === 'email'){
      if(location.protocol.startsWith('http')){
        opts.emailRedirectTo = location.origin + location.pathname.replace(/auth\/(register|login)(\.html)?$/, 'auth/login.html');
      }
      if(isRegister) opts.data = { full_name: p.name, phone: p.phone, preferred_lang: window.currentLang };
      return sb.auth.signInWithOtp({ email: p.email, options: opts });
    }
    if(isRegister) opts.data = { full_name: p.name, email: p.email, preferred_lang: window.currentLang };
    return sb.auth.signInWithOtp({ phone: p.phone, options: opts });
  }

  // ── Register: name + mobile + email + consent ──
  if(regForm){
    const submit = $('submitBtn');
    const regSub = $('regSub');
    if(regSub && PRIMARY === 'phone'){
      regSub.setAttribute('data-i18n','authRegSubPhone');
      regSub.textContent = window.t('authRegSubPhone');
    }
    // The field the one-time code is sent to comes first, whichever channel is configured.
    const emailField = $('f-email') && $('f-email').closest('.field');
    const phoneField = $('f-phone') && $('f-phone').closest('.field');
    if(emailField && phoneField){
      const first  = PRIMARY === 'email' ? emailField : phoneField;
      const second = PRIMARY === 'email' ? phoneField : emailField;
      if(first.nextElementSibling !== second) second.parentNode.insertBefore(first, second);
    }
    regForm.addEventListener('submit', window.guardClick(submit, async function(ev){
      ev.preventDefault();
      hide();
      regForm.querySelectorAll('[aria-invalid]').forEach(i=>i.removeAttribute('aria-invalid'));
      const name = regForm.fullname.value.trim();
      const email = regForm.email.value.trim().toLowerCase();
      const phone = window.normalizePhone(regForm.phone.value);
      if(regForm.company && regForm.company.value){ show('otpSent','success'); return; } // honeypot
      if(Date.now() - loadedAt < 2500){ show('errTooFast'); return; }
      if(name.length < 2){ fieldError(regForm.fullname,'errName'); return; }
      if(!validEmail(email)){ fieldError(regForm.email,'errEmail'); return; }
      if(!phone){ fieldError(regForm.phone,'errPhone'); return; }
      if(!regForm.consent.checked){ fieldError(regForm.consent,'errConsent'); return; }
      if(!sb){ show('errGeneric'); return; }
      pending = { channel: PRIMARY, email, phone, name };
      try{
        const { error } = await sendCode(pending, true);
        if(error){ const k = mapError(error,'send'); k ? show(k) : showRaw(error.message); return; }
        savePending(pending);
        show('otpSent','success');
        gotoCode();
      }catch(e){ show('errGeneric'); }
    }));
  }

  // ── Login: mobile by default, email as the optional fallback ──
  if(loginForm){
    const submit = $('submitBtn');
    let channel = PRIMARY;
    const swap = $('channelSwap');
    const applyChannel = ()=>{
      $('emailField').classList.toggle('hidden', channel !== 'email');
      $('phoneField').classList.toggle('hidden', channel !== 'phone');
      const sub = $('loginSub');
      if(sub){ sub.setAttribute('data-i18n', channel === 'phone' ? 'authLoginSubPhone' : 'authLoginSub'); sub.textContent = window.t(sub.getAttribute('data-i18n')); }
      if(swap){ swap.setAttribute('data-i18n', channel === 'phone' ? 'useEmail' : 'usePhone'); swap.textContent = window.t(swap.getAttribute('data-i18n')); }
    };
    applyChannel();
    if(swap && CFG.allowChannelSwap !== false){
      swap.classList.remove('hidden');
      swap.addEventListener('click', ()=>{
        channel = channel === 'email' ? 'phone' : 'email';
        applyChannel();
        hide();
      });
    }
    loginForm.addEventListener('submit', window.guardClick(submit, async function(ev){
      ev.preventDefault();
      hide();
      loginForm.querySelectorAll('[aria-invalid]').forEach(i=>i.removeAttribute('aria-invalid'));
      if(loginForm.company && loginForm.company.value){ show('otpSent','success'); return; }
      if(Date.now() - loadedAt < 1500){ show('errTooFast'); return; }
      if(!sb){ show('errGeneric'); return; }
      if(channel === 'email'){
        const email = loginForm.email.value.trim().toLowerCase();
        if(!validEmail(email)){ fieldError(loginForm.email,'errEmail'); return; }
        pending = { channel:'email', email };
      } else {
        const phone = window.normalizePhone(loginForm.phone.value);
        if(!phone){ fieldError(loginForm.phone,'errPhone'); return; }
        pending = { channel:'phone', phone };
      }
      try{
        const { error } = await sendCode(pending, false);
        if(error){ const k = mapError(error,'send'); k ? show(k) : showRaw(error.message); return; }
        savePending(pending);
        show('otpSent','success');
        gotoCode();
      }catch(e){ show('errGeneric'); }
    }));
  }

  // ── Code step: verify / resend / change ──
  if(codeForm){
    const verifyBtn = $('verifyBtn');
    const codeInput = $('f-code');
    if(codeInput){
      codeInput.addEventListener('input', ()=>{
        codeInput.value = codeInput.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0)-0x0660)).replace(/\D/g,'').slice(0,6);
      });
    }
    codeForm.addEventListener('submit', window.guardClick(verifyBtn, async function(ev){
      ev.preventDefault();
      hide();
      const token = (codeInput.value || '').trim();
      if(!/^\d{6}$/.test(token)){ fieldError(codeInput,'errCode'); return; }
      if(!pending || !sb){ show('errGeneric'); return; }
      try{
        const params = pending.channel === 'phone'
          ? { phone: pending.phone, token, type: 'sms' }
          : { email: pending.email, token, type: 'email' };
        const { data, error } = await sb.auth.verifyOtp(params);
        if(error || !data || !data.session){ show(mapError(error,'verify') || 'errCodeInvalid'); codeInput.select(); return; }
        clearPending();
        window.location.href = '../account/';
      }catch(e){ show('errGeneric'); }
    }));
    const resend = $('resendBtn');
    if(resend){
      resend.addEventListener('click', window.guardClick(resend, async function(){
        if(!pending || !sb) return;
        hide();
        const { error } = await sendCode(pending, !!regForm);
        if(error){ const k = mapError(error,'send'); k ? show(k) : showRaw(error.message); return; }
        show('otpSent','success');
        startCooldown();
      }));
    }
    const change = $('changeBtn');
    if(change) change.addEventListener('click', gotoForm);
  }

  // ── Magic-link / expired-link handling + already signed in ──
  if(sb){
    const hash = new URLSearchParams(location.hash.replace(/^#/,''));
    const q = new URLSearchParams(location.search);
    if(hash.get('error') || q.get('error')){ show('linkExpired'); history.replaceState(null,'',location.pathname); }
    if(q.get('reason') === 'idle'){ show('idleSignedOut','info'); history.replaceState(null,'',location.pathname); }

    sb.auth.onAuthStateChange((event, session)=>{
      if(session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')){
        clearPending();
        window.location.replace('../account/');
      }
    });
    sb.auth.getSession().then(({data})=>{
      if(data && data.session) window.location.replace('../account/');
    }).catch(()=>{});
  }

  // Restore the code step after a refresh
  pending = loadPending();
  if(pending && stepCode){ gotoCode(); }
})();

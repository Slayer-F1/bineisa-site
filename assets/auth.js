/* Bin Eisa — auth page logic (register + login) */
(function(){
  function show(el, key, kind){
    if(!el) return;
    el.textContent = window.t(key);
    el.setAttribute('data-i18n', key);
    el.classList.remove('msg-error','msg-success');
    el.classList.add('show', kind === 'success' ? 'msg-success' : 'msg-error');
  }
  function hide(el){ if(el) el.classList.remove('show'); }

  // Password visibility toggles
  document.querySelectorAll('.pw-toggle').forEach(t=>{
    t.addEventListener('click', ()=>{
      const input = document.getElementById(t.getAttribute('data-for'));
      if(!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // ── Register ──
  const regForm = document.getElementById('registerForm');
  if(regForm){
    regForm.addEventListener('submit', async function(ev){
      ev.preventDefault();
      const msg = document.getElementById('authMsg');
      hide(msg);
      if(!regForm.reportValidity()) return;
      const name = regForm.fullname.value.trim();
      const email = regForm.email.value.trim();
      const pw = regForm.password.value;
      const pw2 = regForm.password2.value;
      if(pw.length < 8){ show(msg,'errPwLen'); return; }
      if(pw !== pw2){ show(msg,'errPwMatch'); return; }
      if(!window.sbClient){ show(msg,'errGeneric'); return; }
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      try{
        const opts = { data: { full_name: name, preferred_lang: window.currentLang } };
        if(location.protocol.startsWith('http')){
          opts.emailRedirectTo = location.origin + location.pathname.replace(/auth\/register\.html$/,'auth/login.html');
        }
        const { data, error } = await window.sbClient.auth.signUp({ email: email, password: pw, options: opts });
        if(error){
          msg.textContent = error.message;
          msg.removeAttribute('data-i18n');
          msg.classList.remove('msg-success');
          msg.classList.add('show','msg-error');
        } else if(data && data.session){
          // Email confirmation disabled server-side -> signed in immediately
          window.location.href = '../account/index.html';
        } else {
          show(msg,'verifySent','success');
          regForm.reset();
        }
      }catch(e){
        show(msg,'errGeneric');
      }finally{
        btn.disabled = false;
      }
    });
  }

  // ── Login ──
  const loginForm = document.getElementById('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', async function(ev){
      ev.preventDefault();
      const msg = document.getElementById('authMsg');
      hide(msg);
      if(!loginForm.reportValidity()) return;
      if(!window.sbClient){ show(msg,'errGeneric'); return; }
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      try{
        const { error } = await window.sbClient.auth.signInWithPassword({
          email: loginForm.email.value.trim(),
          password: loginForm.password.value
        });
        if(error){
          msg.textContent = error.message;
          msg.removeAttribute('data-i18n');
          msg.classList.remove('msg-success');
          msg.classList.add('show','msg-error');
        } else {
          window.location.href = '../account/index.html';
        }
      }catch(e){
        show(msg,'errGeneric');
      }finally{
        btn.disabled = false;
      }
    });
  }

  // If already signed in, go straight to the dashboard
  if(window.sbClient && (regForm || loginForm)){
    window.sbClient.auth.getSession().then(({data})=>{
      if(data && data.session) window.location.href = '../account/index.html';
    }).catch(()=>{});
  }
})();

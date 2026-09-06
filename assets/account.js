/* Bin Eisa — member dashboard (content access only; no financial data by design) */
(function(){
  const CFG = window.BINEISA_CONFIG || {};
  const sb = window.sbClient;
  if(!sb){ window.location.replace('../auth/login'); return; }

  let insightRows = [];
  let profileData = null;
  let userData = null;

  const CAT_KEY = { market:'catMarket', education:'catEducation', company:'catCompany' };
  const $ = id => document.getElementById(id);

  function fmtDate(iso){
    try{
      return new Date(iso).toLocaleDateString(
        window.currentLang === 'ar' ? 'ar-AE' : 'en-GB',
        { year:'numeric', month:'long', day:'numeric' }
      );
    }catch(e){ return iso ? iso.slice(0,10) : ''; }
  }
  function prettyPhone(e164){
    const m = /^\+971(\d{2})(\d{3})(\d{4})$/.exec(e164 || '');
    return m ? `+971 ${m[1]}${m[2]} ${m[3]}` : (e164 || '');
  }

  function render(){
    const lang = window.currentLang;
    if(userData){
      const fullName = (profileData && profileData.full_name) || (userData.user_metadata && userData.user_metadata.full_name) || '';
      const phone = (profileData && profileData.phone) || (userData.user_metadata && userData.user_metadata.phone) || '';
      const verified = !!(profileData && profileData.phone_verified) || !!userData.phone_confirmed_at;
      $('accNameV').textContent = fullName || '—';
      $('welcomeName').textContent = fullName ? fullName.split(' ')[0] : '';
      $('accEmailV').textContent = (profileData && profileData.email) || userData.email || '—';
      $('accSinceV').textContent = fmtDate(userData.created_at);
      $('accPhoneV').textContent = phone ? prettyPhone(phone) : window.t('accPhoneMissing');
      const chip = $('accPhoneChip');
      chip.textContent = window.t(verified ? 'accVerified' : 'accUnverified');
      chip.className = 'status-chip ' + (verified ? 'ok' : 'warn');
      const vbtn = $('verifyPhoneBtn');
      if(vbtn) vbtn.classList.toggle('hidden', !(CFG.phoneOtpEnabled && phone && !verified));
      const idle = $('idleNote');
      if(idle) idle.textContent = window.t('accIdleNote', { m: CFG.idleLogoutMinutes || 15 });
    }
    const list = $('insightList');
    if(!list) return;
    list.innerHTML = '';
    if(!insightRows.length){
      const p = document.createElement('p');
      p.className = 'loading-note';
      p.textContent = window.t('accEmpty');
      list.appendChild(p);
      return;
    }
    insightRows.forEach(row=>{
      const item = document.createElement('article');
      item.className = 'insight-item';
      const meta = document.createElement('div');
      meta.className = 'insight-meta';
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = window.t(CAT_KEY[row.category] || 'catInsight');
      const date = document.createElement('span');
      date.className = 'insight-date';
      date.textContent = fmtDate(row.created_at);
      meta.appendChild(chip); meta.appendChild(date);
      const h = document.createElement('h3');
      h.textContent = lang === 'ar' ? row.title_ar : row.title_en;
      const s = document.createElement('p');
      s.textContent = lang === 'ar' ? (row.summary_ar || row.body_ar) : (row.summary_en || row.body_en);
      item.appendChild(meta); item.appendChild(h); item.appendChild(s);
      list.appendChild(item);
    });
  }

  async function load(){
    const { data: sess } = await sb.auth.getSession();
    if(!sess || !sess.session){ window.location.replace('../auth/login'); return; }
    userData = sess.session.user;

    const insightsQuery = () => sb.from('insights')
      .select('slug, category, title_en, title_ar, summary_en, summary_ar, body_en, body_ar, created_at')
      .order('created_at', { ascending:false });

    const [profileRes, insightsRes] = await Promise.all([
      sb.from('profiles').select('full_name, preferred_lang, phone, phone_verified, email, created_at').eq('id', userData.id).maybeSingle(),
      insightsQuery()
    ]);
    profileData = profileRes.data || null;
    insightRows = insightsRes.data || [];
    if(!insightRows.length){
      await new Promise(r=>setTimeout(r, 900));
      const retry = await insightsQuery();
      insightRows = retry.data || [];
    }
    $('dashLoading').classList.add('hidden');
    $('dashContent').classList.remove('hidden');
    render();
  }

  document.addEventListener('bineisa:langchange', render);

  // Sign out (guarded against double clicks)
  const signout = $('signoutBtn');
  if(signout){
    signout.addEventListener('click', window.guardClick(signout, async ()=>{
      try{ await sb.auth.signOut(); }catch(e){}
      window.location.replace('../index.html');
    }));
  }

  // Idle logout
  window.startIdleLogout(CFG.idleLogoutMinutes || 15, async ()=>{
    try{ await sb.auth.signOut(); }catch(e){}
    window.location.replace('../auth/login?reason=idle');
  });

  // Optional: SMS verification of the mobile number (only when an SMS provider is enabled)
  const vbtn = $('verifyPhoneBtn');
  if(vbtn){
    vbtn.addEventListener('click', window.guardClick(vbtn, async ()=>{
      const phone = profileData && profileData.phone;
      if(!phone || !CFG.phoneOtpEnabled) return;
      const { error } = await sb.auth.updateUser({ phone });
      if(error){ alert(error.message); return; }
      const code = window.prompt(window.t('fCode'));
      if(!code) return;
      const { error: vErr } = await sb.auth.verifyOtp({ phone, token: code.trim(), type: 'phone_change' });
      if(vErr){ alert(window.t('errCodeInvalid')); return; }
      await sb.from('profiles').update({ phone_verified: true }).eq('id', userData.id);
      profileData.phone_verified = true;
      render();
    }));
  }

  // A thrown load() is a data/network failure, not a missing session: stay put and
  // offer a retry, otherwise the login page bounces the still-valid session back here.
  load().catch(()=>{
    const l = $('dashLoading');
    if(l){
      l.classList.remove('hidden');
      l.setAttribute('data-i18n','accLoadFail');
      l.textContent = window.t('accLoadFail');
    }
  });
})();

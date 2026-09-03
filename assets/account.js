/* Bin Eisa — member dashboard (content access only; no financial data by design) */
(function(){
  if(!window.sbClient){ window.location.href = '../auth/login.html'; return; }

  let insightRows = [];
  let profileData = null;
  let userData = null;

  const CAT_KEY = { market:'catMarket', education:'catEducation', company:'catCompany' };

  function fmtDate(iso){
    try{
      return new Date(iso).toLocaleDateString(
        window.currentLang === 'ar' ? 'ar-AE' : 'en-GB',
        { year:'numeric', month:'long', day:'numeric' }
      );
    }catch(e){ return iso ? iso.slice(0,10) : ''; }
  }

  function render(){
    const lang = window.currentLang;
    if(userData){
      const nameEl = document.getElementById('accNameV');
      const emailEl = document.getElementById('accEmailV');
      const sinceEl = document.getElementById('accSinceV');
      const welcome = document.getElementById('welcomeName');
      const fullName = (profileData && profileData.full_name) || '';
      if(nameEl) nameEl.textContent = fullName || '—';
      if(welcome) welcome.textContent = fullName ? fullName.split(' ')[0] : '';
      if(emailEl) emailEl.textContent = userData.email || '—';
      if(sinceEl) sinceEl.textContent = fmtDate(userData.created_at);
    }
    const list = document.getElementById('insightList');
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
    const { data: sess } = await window.sbClient.auth.getSession();
    if(!sess || !sess.session){ window.location.href = '../auth/login.html'; return; }
    userData = sess.session.user;

    const insightsQuery = () => window.sbClient.from('insights')
      .select('slug, category, title_en, title_ar, summary_en, summary_ar, body_en, body_ar, created_at')
      .order('created_at', { ascending:false });

    const [profileRes, insightsRes] = await Promise.all([
      window.sbClient.from('profiles').select('full_name, preferred_lang, created_at').eq('id', userData.id).maybeSingle(),
      insightsQuery()
    ]);
    profileData = profileRes.data || null;
    insightRows = insightsRes.data || [];

    // Just after login the token can attach a beat late — retry once before showing empty
    if(!insightRows.length){
      await new Promise(r=>setTimeout(r, 900));
      const retry = await insightsQuery();
      insightRows = retry.data || [];
    }

    const loading = document.getElementById('dashLoading');
    const content = document.getElementById('dashContent');
    if(loading) loading.classList.add('hidden');
    if(content) content.classList.remove('hidden');
    render();
  }

  document.addEventListener('bineisa:langchange', render);

  const signout = document.getElementById('signoutBtn');
  if(signout){
    signout.addEventListener('click', async ()=>{
      try{ await window.sbClient.auth.signOut(); }catch(e){}
      window.location.href = '../index.html';
    });
  }

  load().catch(()=>{ window.location.href = '../auth/login.html'; });
})();

/**
 * 法考主观题督学系统 v3
 * 功能：登录身份、每日反馈、每题独立密码、法条定位刷题、管理后台
 */

// ============ CONSTANTS ============
const LS = { // localStorage keys
  ROLE: 'fk_role',
  MANAGER_PWD: 'fk_mgr_pwd',
  LEARNER_SUBJECTS: 'fk_lrn_subjects',
  LEARNER_PHASE: 'fk_lrn_phase',
  FEEDBACK_DATE: 'fk_fb_date',
  PRACTICE_DRAWN: 'fk_practice_drawn',
  PRACTICE_DATE: 'fk_practice_date',
  PROVISION_DRAWN: 'fk_provision_drawn',
  PROVISION_DATE: 'fk_provision_date',
  UNLOCKED: 'fk_unlocked',
  PASSWORDS: 'fk_passwords',
};
const DEFAULT_MGR_PWD = '3223';
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const S = state => {};

// ============ STATE ============
const st = {
  role: null, // 'learner' | 'manager'
  subjects: [], // learner's current复习科目
  phase: '', // learner's current阶段
  practiceDrawn: [], // [qId, ...]
  provisionDrawn: [], // [pvId, ...]
  practicePlan: 1,
  provisionPlan: 1,
  practiceIdx: 0,
  provisionIdx: 0,
  unlocked: new Set(),
  questionPasswords: {}, // {qId: '1234', ...}
};

// ============ DOM ============
const dom = {};

function initDom() {
  const ids = ['loginOverlay','loginLearner','loginManager','managerPwdArea','managerPwdInput','loginError','managerPwdConfirm',
    'feedbackOverlay','feedbackSubjects','feedbackPhases','feedbackConfirm',
    'navLinks','hamburgerBtn','adminBtn','loginSwitch','navSep',
    'practiceSubjectTabs','practiceTypeTabs','practicePlanCount','practicePoolCount','practiceDrawnCount',
    'practiceDrawBtn','practiceResetBtn','practiceDrawn','practiceDrawnNav','practiceContainer','practiceEmpty',
    'provisionPlanCount','provisionPoolCount','provisionDrawnCount','provisionDrawBtn','provisionResetBtn',
    'provisionDrawn','provisionDrawnNav','provisionContainer','provisionEmpty',
    'reciteSubjectTabs','todayDate','reciteText',
    'videoSubjectTabs','videoGrid','materialSubjectTabs','materialGrid',
    'answerPwdModal','answerPwdInput','answerPwdError','answerPwdHint','answerPwdCancel','answerPwdConfirm',
    'adminModal','adminModalClose','adminStats','adminSubjects','adminPhase',
    'adminPracticeDrawn','adminProvisionDrawn','adminPracticePasswords','adminProvisionPasswords',
    'adminManagerPwd','adminSaveManagerPwd'];
  ids.forEach(id => dom[id] = $(id));
}

// ============ PERSISTENCE ============
function saveLS() {
  try {
    localStorage.setItem(LS.PRACTICE_DRAWN, JSON.stringify(st.practiceDrawn));
    localStorage.setItem(LS.PROVISION_DRAWN, JSON.stringify(st.provisionDrawn));
    localStorage.setItem(LS.PRACTICE_DATE, todayKey());
    localStorage.setItem(LS.PROVISION_DATE, todayKey());
    localStorage.setItem(LS.UNLOCKED, JSON.stringify([...st.unlocked]));
    localStorage.setItem(LS.PASSWORDS, JSON.stringify(st.questionPasswords));
  } catch {}
}
function todayKey() { const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function isToday(k) { return localStorage.getItem(k)===todayKey(); }

function loadState() {
  st.role = localStorage.getItem(LS.ROLE) || null;
  st.subjects = JSON.parse(localStorage.getItem(LS.LEARNER_SUBJECTS)||'[]');
  st.phase = localStorage.getItem(LS.LEARNER_PHASE) || '';
  try {
    if (isToday(LS.PRACTICE_DATE)) st.practiceDrawn = JSON.parse(localStorage.getItem(LS.PRACTICE_DRAWN)||'[]');
    if (isToday(LS.PROVISION_DATE)) st.provisionDrawn = JSON.parse(localStorage.getItem(LS.PROVISION_DRAWN)||'[]');
    st.unlocked = new Set(JSON.parse(localStorage.getItem(LS.UNLOCKED)||'[]'));
    st.questionPasswords = JSON.parse(localStorage.getItem(LS.PASSWORDS)||'{}');
  } catch {}
}

// ============ PASSWORD GENERATION ============
function genPwd() { return String(Math.floor(1000+Math.random()*9000)); }

function getPwdFor(id) {
  if (!st.questionPasswords[id]) {
    st.questionPasswords[id] = genPwd();
    saveLS();
  }
  return st.questionPasswords[id];
}

// ============ LOGIN ============
function showLogin() { dom.loginOverlay.classList.remove('hidden'); }
function hideLogin() { dom.loginOverlay.classList.add('hidden'); }

function doLogin(role) {
  st.role = role;
  localStorage.setItem(LS.ROLE, role);
  hideLogin();
  dom.adminBtn.classList.toggle('hidden', role !== 'manager');
  dom.navSep.classList.toggle('hidden', role !== 'manager');
  if (role === 'learner') showFeedbackIfNeeded();
  renderAll();
}

function showFeedbackIfNeeded() {
  const last = localStorage.getItem(LS.FEEDBACK_DATE);
  if (last !== todayKey() || !st.subjects.length) {
    dom.feedbackOverlay.classList.remove('hidden');
    // Reset chips
    dom.feedbackSubjects.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', st.subjects.includes(c.dataset.subj)));
    dom.feedbackPhases.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.phase === st.phase));
  }
}

// ============ FEEDBACK ============
function confirmFeedback() {
  const sel = [...dom.feedbackSubjects.querySelectorAll('.chip.active')].map(c => c.dataset.subj);
  const phaseEl = dom.feedbackPhases.querySelector('.chip.active');
  if (!sel.length) { alert('请至少选择一个科目'); return; }
  if (!phaseEl) { alert('请选择一个复习阶段'); return; }
  st.subjects = sel;
  st.phase = phaseEl.dataset.phase;
  localStorage.setItem(LS.LEARNER_SUBJECTS, JSON.stringify(sel));
  localStorage.setItem(LS.LEARNER_PHASE, st.phase);
  localStorage.setItem(LS.FEEDBACK_DATE, todayKey());
  dom.feedbackOverlay.classList.add('hidden');
}

// ============ DRAW ENGINE ============
function drawFrom(pool, alreadyDrawn, planCount, listKey) {
  const available = pool.filter(q => !alreadyDrawn.includes(q.id));
  if (!available.length) { alert('当前条件下没有可抽取的题目，或已全部抽完。'); return null; }
  const n = Math.min(planCount, available.length);
  const shuffled = [...available];
  for (let i=shuffled.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
  const sel = shuffled.slice(0,n);
  const newIds = sel.map(q => q.id);
  newIds.forEach(id => getPwdFor(id)); // generate passwords
  alreadyDrawn.push(...newIds);
  saveLS();
  return alreadyDrawn;
}

// ============ RENDER ============
function renderAll() {
  renderPractice();
  renderProvision();
  renderRecite();
  renderVideos();
  renderMaterials();
}

// ===== PRACTICE =====
function renderPractice() {
  const subj = dom.practiceSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj || '刑法';
  const type = dom.practiceTypeTabs.querySelector('.tab-btn.active')?.dataset.type || '模拟题';
  const pool = questionsData.filter(q => q.subject===subj && q.type===type);
  dom.practicePoolCount.textContent = pool.length;
  dom.practiceDrawnCount.textContent = st.practiceDrawn.length;

  const drawn = st.practiceDrawn.map(id => questionsData.find(q => q.id===id)).filter(Boolean);
  if (!drawn.length) { dom.practiceDrawn.classList.add('hidden'); dom.practiceEmpty.classList.remove('hidden'); return; }
  dom.practiceEmpty.classList.add('hidden'); dom.practiceDrawn.classList.remove('hidden');
  if (st.practiceIdx >= drawn.length) st.practiceIdx = 0;
  renderQCard(drawn[st.practiceIdx], drawn.length, 'practice');
  renderNav(st.practiceDrawn.length, st.practiceIdx, dom.practiceDrawnNav, (i) => { st.practiceIdx=i; renderPractice(); });
}

// ===== PROVISION =====
function renderProvision() {
  const pool = provisionData;
  dom.provisionPoolCount.textContent = pool.length;
  dom.provisionDrawnCount.textContent = st.provisionDrawn.length;
  const drawn = st.provisionDrawn.map(id => provisionData.find(q => q.id===id)).filter(Boolean);
  if (!drawn.length) { dom.provisionDrawn.classList.add('hidden'); dom.provisionEmpty.classList.remove('hidden'); return; }
  dom.provisionEmpty.classList.add('hidden'); dom.provisionDrawn.classList.remove('hidden');
  if (st.provisionIdx >= drawn.length) st.provisionIdx = 0;
  renderProvisionCard(drawn[st.provisionIdx], drawn.length);
  renderNav(st.provisionDrawn.length, st.provisionIdx, dom.provisionDrawnNav, (i) => { st.provisionIdx=i; renderProvision(); });
}

function renderQCard(q, total, mode) {
  const isUnlocked = st.unlocked.has(q.id);
  const pos = (mode==='practice'?st.practiceIdx:st.provisionIdx)+1;
  dom.practiceContainer.innerHTML = `
    <div class="question-card">
      <div class="q-card-header">
        <span class="q-card-title">${q.title}（${q.score}分）</span>
        <span class="q-card-position">${pos}/${total}</span>
      </div>
      <div class="q-card-badges">
        <span class="badge subj">${q.subject}</span>
        <span class="badge type">${q.type}</span>
        <span class="badge score">${q.score}分</span>
        ${isUnlocked?'<span class="badge unlocked">✓ 已解锁</span>':''}
      </div>
      <div class="q-card-section">
        <h4>📋 案情</h4>
        <div class="content-text">${fmtPara(q.case)}</div>
      </div>
      <div class="q-card-section">
        <h4>❓ 问题</h4>
        <div class="content-text">${esc(q.problems)}</div>
      </div>
      <div class="q-card-section ans-section">
        <h4>🔒 参考答案</h4>
        ${isUnlocked
          ? `<div class="content-text ans-text">${esc(q.answer||'暂无')}</div>`
          : `<div class="ans-locked"><p>完成作答后，向督学索要本题密码</p>
             <button class="btn-primary unlock-btn">🔑 输入密码查看答案</button></div>`}
      </div>
      <div class="q-card-nav">
        <button class="btn-sec" onclick="navigate('${mode}',-1)" ${st.practiceIdx===0?'disabled':''}>◀ 上一题</button>
        <button class="btn-sec" onclick="navigate('${mode}',1)" ${st.practiceIdx>=total-1?'disabled':''}>下一题 ▶</button>
      </div>
    </div>`;
  dom.practiceContainer.querySelector('.unlock-btn')?.addEventListener('click', () => showAnswerPwd(q.id));
}

function renderProvisionCard(q, total) {
  const isUnlocked = st.unlocked.has(q.id);
  const pos = st.provisionIdx+1;
  dom.provisionContainer.innerHTML = `
    <div class="question-card">
      <div class="q-card-header">
        <span class="q-card-title">法条定位题</span>
        <span class="q-card-position">${pos}/${total}</span>
      </div>
      <div class="q-card-section">
        <h4>❓ 问题</h4>
        <div class="content-text" style="font-size:1rem">${esc(q.q)}</div>
      </div>
      <div class="q-card-section ans-section">
        <h4>📖 答案与法条依据</h4>
        ${isUnlocked
          ? `<div class="content-text ans-text">${esc(q.a)}</div>`
          : `<div class="ans-locked"><p>完成作答后，向督学索要本题密码</p>
             <button class="btn-primary unlock-btn">🔑 输入密码查看答案</button></div>`}
      </div>
      <div class="q-card-nav">
        <button class="btn-sec" onclick="navigateProv(-1)" ${st.provisionIdx===0?'disabled':''}>◀ 上一题</button>
        <button class="btn-sec" onclick="navigateProv(1)" ${st.provisionIdx>=total-1?'disabled':''}>下一题 ▶</button>
      </div>
    </div>`;
  dom.provisionContainer.querySelector('.unlock-btn')?.addEventListener('click', () => showAnswerPwd(q.id));
}

window.navigate = function(mode, dir) {
  if (mode==='practice') { st.practiceIdx+=dir; renderPractice(); }
};
window.navigateProv = function(dir) { st.provisionIdx+=dir; renderProvision(); };

function renderNav(total, active, container, onClick) {
  container.innerHTML = '';
  for (let i=0; i<total; i++) {
    const d = document.createElement('button'); d.className='nav-dot'+(i===active?' active':''); d.textContent=i+1;
    d.addEventListener('click',()=>onClick(i));
    container.appendChild(d);
  }
}

// ===== RECITE =====
function renderRecite() {
  const subj = dom.reciteSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj || '刑法';
  const now = new Date(); const wd=['日','一','二','三','四','五','六'];
  dom.todayDate.textContent = `${now.getFullYear()}年${String(now.getMonth()+1).padStart(2,'0')}月${String(now.getDate()).padStart(2,'0')}日 星期${wd[now.getDay()]}`;
  const reciteMap = {
    '刑法': '待督学发布刑法背诵内容...',
    '刑事诉讼法': '待督学发布刑事诉讼法背诵内容...',
    '民法': '待督学发布民法背诵内容...',
    '民事诉讼法': '待督学发布民事诉讼法背诵内容...',
    '理论法': '待督学发布理论法背诵内容...',
    '行政法与行政诉讼法': '待督学发布行政法背诵内容...',
  };
  dom.reciteText.innerHTML = `<p>${reciteMap[subj]||'待督学发布背诵内容...'}</p>`;
}

// ===== VIDEO & MATERIAL =====
const videoData = {
  '刑法': [{n:'柏浪涛 刑法主观题',s:'柏神2025刑法主观10题精讲'},{n:'刑法法条串讲',s:'待添加...'}],
  '刑诉': [{n:'左宁 刑诉法主观题',s:'刑诉法条定位40题讲解'},{n:'向高甲 刑诉背诵',s:'待添加...'}],
  '民法': [{n:'钟秀勇 民法主观题',s:'待添加...'},{n:'张翔 民法',s:'待添加...'}],
  '民诉': [{n:'戴鹏 民诉法',s:'待添加...'},{n:'韩心怡 民诉',s:'待添加...'}],
  '理论法': [{n:'杜洪波 理论法',s:'待添加...'},{n:'白斌 理论法',s:'待添加...'}],
  '行政法': [{n:'李佳 行政法',s:'待添加...'},{n:'徐金桂 行政法',s:'待添加...'}],
};

function renderVideos() {
  const subj = dom.videoSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj || '刑法';
  dom.videoGrid.innerHTML = (videoData[subj]||[]).map(v =>
    `<div class="resource-card"><div class="rsc-icon">🎬</div><h3>${v.n}</h3><p>${v.s}</p><span class="rsc-status pending">待上传</span></div>`
  ).join('');
}

const materialData = {
  '刑法': [{n:'柏浪涛 刑法攻略',s:'2025刑法主观题冲刺版',l:true},{n:'柏神2025主观10题',s:'已加载至刷题系统',l:true}],
  '刑诉': [{n:'左宁 刑诉法攻略',s:'法条定位40题已加载',l:true},{n:'向高甲 刑诉法',s:'待添加...',l:false}],
  '民法': [{n:'钟秀勇 民法攻略',s:'待添加...',l:false}],
  '民诉': [{n:'戴鹏 民诉法攻略',s:'待添加...',l:false}],
  '理论法': [{n:'杜洪波 理论法',s:'待添加...',l:false}],
  '行政法': [{n:'李佳 行政法',s:'待添加...',l:false}],
};

function renderMaterials() {
  const subj = dom.materialSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj || '刑法';
  dom.materialGrid.innerHTML = (materialData[subj]||[]).map(v =>
    `<div class="resource-card${v.l?' loaded':''}"><div class="rsc-icon">${v.l?'📗':'📕'}</div><h3>${v.n}</h3><p>${v.s}</p>
    <span class="rsc-status ${v.l?'loaded':'pending'}">${v.l?'✓ 已加载':'待上传'}</span></div>`
  ).join('');
}

// ============ ANSWER PASSWORD MODAL ============
let pendingUnlockId = null;
function showAnswerPwd(qid) {
  pendingUnlockId = qid;
  dom.answerPwdInput.value = '';
  dom.answerPwdError.classList.add('hidden');
  dom.answerPwdModal.classList.remove('hidden');
  setTimeout(() => dom.answerPwdInput.focus(), 100);
}
function hideAnswerPwd() { dom.answerPwdModal.classList.add('hidden'); pendingUnlockId = null; }
function confirmAnswerPwd() {
  const pwd = dom.answerPwdInput.value.trim();
  const correct = getPwdFor(pendingUnlockId);
  if (pwd === correct) {
    st.unlocked.add(pendingUnlockId);
    saveLS();
    hideAnswerPwd();
    renderPractice();
    renderProvision();
  } else {
    dom.answerPwdError.classList.remove('hidden');
    dom.answerPwdInput.value = '';
    dom.answerPwdInput.focus();
  }
}

// ============ ADMIN DASHBOARD ============
function showAdmin() {
  dom.adminSubjects.textContent = st.subjects.length ? st.subjects.join('、') : '未提交';
  dom.adminPhase.textContent = st.phase || '未提交';
  dom.adminPracticeDrawn.textContent = st.practiceDrawn.length;
  dom.adminProvisionDrawn.textContent = st.provisionDrawn.length;

  // Practice passwords
  const pq = st.practiceDrawn.map(id => questionsData.find(q=>q.id===id)).filter(Boolean);
  dom.adminPracticePasswords.innerHTML = pq.length
    ? pq.map(q => `<div class="pwd-row"><span>${q.title}（${q.subject}）</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join('')
    : '<p class="empty-hint">今日未抽题</p>';

  // Provision passwords
  const pv = st.provisionDrawn.map(id => provisionData.find(q=>q.id===id)).filter(Boolean);
  dom.adminProvisionPasswords.innerHTML = pv.length
    ? pv.map(q => `<div class="pwd-row"><span>法条定位题</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join('')
    : '<p class="empty-hint">今日未抽题</p>';

  dom.adminManagerPwd.value = localStorage.getItem(LS.MANAGER_PWD) || DEFAULT_MGR_PWD;
  dom.adminModal.classList.remove('hidden');
}
function hideAdmin() { dom.adminModal.classList.add('hidden'); }

// ============ UTILITIES ============
function esc(t) { const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; }
function fmtPara(text) {
  return (text||'').split(/\n\n+/).filter(p=>p.trim()).map(p => `<p class="pi">${esc(p.trim().replace(/\n/g,' '))}</p>`).join('');
}

// ============ SWITCH MODULE ============
function switchModule(name) {
  $$('.module').forEach(m => m.classList.toggle('active', m.id === `module-${name}`));
  $$('.nav-btn[data-module]').forEach(b => b.classList.toggle('active', b.dataset.module === name));
  dom.navLinks.classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}

// ============ BIND EVENTS ============
function bindEvents() {
  // Login
  dom.loginLearner.addEventListener('click', () => doLogin('learner'));
  dom.loginManager.addEventListener('click', () => { dom.managerPwdArea.classList.remove('hidden'); dom.managerPwdInput.focus(); });
  dom.managerPwdConfirm.addEventListener('click', () => {
    const pwd = dom.managerPwdInput.value.trim();
    const correct = localStorage.getItem(LS.MANAGER_PWD) || DEFAULT_MGR_PWD;
    if (pwd === correct) { doLogin('manager'); dom.managerPwdArea.classList.add('hidden'); dom.managerPwdInput.value=''; }
    else { dom.loginError.classList.remove('hidden'); dom.managerPwdInput.value=''; dom.managerPwdInput.focus(); }
  });
  dom.managerPwdInput.addEventListener('keydown', e => { if (e.key==='Enter') dom.managerPwdConfirm.click(); if (e.key==='Escape') { dom.managerPwdArea.classList.add('hidden'); dom.managerPwdInput.value=''; } });

  // Feedback
  dom.feedbackSubjects.addEventListener('click', e => { const c=e.target.closest('.chip'); if(c) c.classList.toggle('active'); });
  dom.feedbackPhases.addEventListener('click', e => { const c=e.target.closest('.chip'); if(c) { dom.feedbackPhases.querySelectorAll('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); } });
  dom.feedbackConfirm.addEventListener('click', confirmFeedback);

  // Nav
  dom.navLinks.addEventListener('click', e => { const b=e.target.closest('.nav-btn[data-module]'); if(b) switchModule(b.dataset.module); });
  dom.hamburgerBtn.addEventListener('click', () => dom.navLinks.classList.toggle('open'));
  dom.adminBtn.addEventListener('click', showAdmin);

  // Login switch (navbar)
  dom.loginSwitch.addEventListener('click', () => {
    localStorage.removeItem(LS.ROLE);
    document.querySelectorAll('.fullscreen-overlay').forEach(o => o.classList.add('hidden'));
    st.role = null;
    showLogin();
  });

  // Module tabs (generic handler for all tab bars)
  document.querySelectorAll('.tabs-bar').forEach(bar => {
    bar.addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Determine which render function
      const barId = bar.id;
      if (barId === 'practiceSubjectTabs' || barId === 'practiceTypeTabs') renderPractice();
      else if (barId === 'reciteSubjectTabs') renderRecite();
      else if (barId === 'videoSubjectTabs') renderVideos();
      else if (barId === 'materialSubjectTabs') renderMaterials();
    });
  });

  // Practice draw/reset
  dom.practiceDrawBtn.addEventListener('click', () => {
    const subj = dom.practiceSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj || '刑法';
    const type = dom.practiceTypeTabs.querySelector('.tab-btn.active')?.dataset.type || '模拟题';
    const pool = questionsData.filter(q => q.subject===subj && q.type===type);
    const plan = Math.max(1, parseInt(dom.practicePlanCount.value)||1);
    drawFrom(pool, st.practiceDrawn, plan);
    st.practiceIdx = st.practiceDrawn.length - plan;
    renderPractice();
  });
  dom.practiceResetBtn.addEventListener('click', () => { if (confirm('重置今日刷题抽题？')) { st.practiceDrawn=[]; st.practiceIdx=0; saveLS(); renderPractice(); } });

  // Provision draw/reset
  dom.provisionDrawBtn.addEventListener('click', () => {
    const plan = Math.max(1, parseInt(dom.provisionPlanCount.value)||1);
    drawFrom(provisionData, st.provisionDrawn, plan);
    st.provisionIdx = st.provisionDrawn.length - plan;
    renderProvision();
  });
  dom.provisionResetBtn.addEventListener('click', () => { if (confirm('重置今日法条定位抽题？')) { st.provisionDrawn=[]; st.provisionIdx=0; saveLS(); renderProvision(); } });

  // Answer password modal
  dom.answerPwdCancel.addEventListener('click', hideAnswerPwd);
  dom.answerPwdConfirm.addEventListener('click', confirmAnswerPwd);
  dom.answerPwdModal.addEventListener('click', e => { if (e.target===dom.answerPwdModal) hideAnswerPwd(); });
  dom.answerPwdInput.addEventListener('keydown', e => { if (e.key==='Enter') confirmAnswerPwd(); if (e.key==='Escape') hideAnswerPwd(); });
  dom.answerPwdInput.addEventListener('input', function() { this.value = this.value.replace(/\D/g,'').slice(0,4); });

  // Admin
  dom.adminModalClose.addEventListener('click', hideAdmin);
  dom.adminModal.addEventListener('click', e => { if (e.target===dom.adminModal) hideAdmin(); });
  dom.adminSaveManagerPwd.addEventListener('click', () => {
    const pwd = dom.adminManagerPwd.value.trim();
    if (pwd.length<4) { alert('密码至少4位'); return; }
    localStorage.setItem(LS.MANAGER_PWD, pwd);
    alert('管理者密码已更新');
  });

  // Close mobile nav
  document.addEventListener('click', e => {
    if (dom.navLinks.classList.contains('open') && !dom.navLinks.contains(e.target) && !dom.hamburgerBtn.contains(e.target))
      dom.navLinks.classList.remove('open');
  });
}

// ============ INIT ============
function init() {
  initDom();
  loadState();

  // Bind events FIRST so login buttons work
  bindEvents();

  // Show login if no role
  if (!st.role) { showLogin(); return; }

  dom.adminBtn.classList.toggle('hidden', st.role !== 'manager');
  dom.navSep.classList.toggle('hidden', st.role !== 'manager');

  if (st.role === 'learner') showFeedbackIfNeeded();
  renderAll();

  dom.practicePlanCount.value = 1;
  dom.provisionPlanCount.value = 1;
}

document.addEventListener('DOMContentLoaded', init);

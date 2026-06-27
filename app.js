/**
 * 法考主观题督学系统 v4
 * - 学生账号登录（管理员创建）
 * - 每学生独立数据（localStorage按学生ID隔离）
 * - 管理者行为不记录到学习数据
 * - 科目标签映射修复
 */

// ============ CONSTANTS ============
const DEFAULT_MGR_PWD = '3223';
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// 科目标签映射：标签值 → 数据中的subject字段值
const SUBJ_MAP = {
  '刑法': '刑法', '民法': '民法', '民诉': '民事诉讼法',
  '刑诉': '刑事诉讼法', '行政法': '行政法与行政诉讼法', '理论法': '理论法',
};

// ============ STATE ============
let st = {};

function freshState(tenant) {
  return {
    tenant: tenant,      // 'manager' 或学生ID字符串
    role: tenant === 'manager' ? 'manager' : 'learner',
    studentId: tenant === 'manager' ? null : tenant,
    subjects: [],
    phase: '',
    practiceDrawn: [],
    provisionDrawn: [],
    practiceIdx: 0,
    provisionIdx: 0,
    unlocked: new Set(),
    questionPasswords: {},
  };
}

// ============ PERSISTENCE ============
function prefix() { return st.tenant ? 'fk_' + st.tenant + '_' : 'fk_'; }
function lsKey(raw) { return prefix() + raw; }

function saveLS() {
  try {
    const p = prefix();
    localStorage.setItem(p + 'practice_drawn', JSON.stringify(st.practiceDrawn));
    localStorage.setItem(p + 'provision_drawn', JSON.stringify(st.provisionDrawn));
    localStorage.setItem(p + 'practice_date', todayKey());
    localStorage.setItem(p + 'provision_date', todayKey());
    localStorage.setItem(p + 'unlocked', JSON.stringify([...st.unlocked]));
    localStorage.setItem(p + 'passwords', JSON.stringify(st.questionPasswords));
    if (st.role === 'learner') {
      localStorage.setItem(p + 'subjects', JSON.stringify(st.subjects));
      localStorage.setItem(p + 'phase', st.phase);
      localStorage.setItem(p + 'fb_date', todayKey());
    }
  } catch {}
}

function loadState(tenant) {
  st = freshState(tenant);
  try {
    const p = prefix();
    if (isToday(p + 'practice_date'))
      st.practiceDrawn = JSON.parse(localStorage.getItem(p + 'practice_drawn') || '[]');
    if (isToday(p + 'provision_date'))
      st.provisionDrawn = JSON.parse(localStorage.getItem(p + 'provision_drawn') || '[]');
    st.unlocked = new Set(JSON.parse(localStorage.getItem(p + 'unlocked') || '[]'));
    st.questionPasswords = JSON.parse(localStorage.getItem(p + 'passwords') || '{}');
    if (st.role === 'learner') {
      st.subjects = JSON.parse(localStorage.getItem(p + 'subjects') || '[]');
      st.phase = localStorage.getItem(p + 'phase') || '';
    }
  } catch {}
}

function todayKey() { const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function isToday(k) { return localStorage.getItem(k)===todayKey(); }

// ============ STUDENT ACCOUNTS (admin namespace) ============
function getStudents() {
  try { return JSON.parse(localStorage.getItem('fk_students') || '[]'); }
  catch { return []; }
}
function saveStudents(students) {
  localStorage.setItem('fk_students', JSON.stringify(students));
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

// ============ DOM ============
const dom = {};

function initDom() {
  const ids = [
    'loginOverlay','loginLearner','loginManager','managerPwdArea','managerPwdInput','loginError','managerPwdConfirm',
    'studentLoginArea','studentIdInput','studentPwdInput','studentLoginError','studentLoginConfirm',
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
    'adminManagerPwd','adminSaveManagerPwd','adminStudentList','adminAddStudentBtn','adminNewStudentId',
    'adminCurrentStudent',
  ];
  ids.forEach(id => dom[id] = $(id));
}

// ============ LOGIN ============
function showLogin() { dom.loginOverlay.classList.remove('hidden'); st = freshState(null); }
function hideLogin() { dom.loginOverlay.classList.add('hidden'); }
function switchToStudentLogin() {
  dom.loginLearner.classList.add('hidden');
  dom.loginManager.classList.add('hidden');
  dom.studentLoginArea.classList.remove('hidden');
  dom.studentIdInput.focus();
}

function doLogin(tenant) {
  loadState(tenant);
  hideLogin();
  const isMgr = tenant === 'manager';
  dom.adminBtn.classList.toggle('hidden', !isMgr);
  dom.navSep.classList.toggle('hidden', !isMgr);
  dom.loginSwitch.textContent = isMgr ? '🔒 退出管理' : '🔄 切换身份';
  if (st.role === 'learner') showFeedbackIfNeeded();
  renderAll();
}

// ============ FEEDBACK ============
function showFeedbackIfNeeded() {
  const p = prefix();
  const last = localStorage.getItem(p + 'fb_date');
  if (last !== todayKey() || !st.subjects.length) {
    dom.feedbackOverlay.classList.remove('hidden');
    dom.feedbackSubjects.querySelectorAll('.chip').forEach(c =>
      c.classList.toggle('active', st.subjects.includes(c.dataset.subj)));
    dom.feedbackPhases.querySelectorAll('.chip').forEach(c =>
      c.classList.toggle('active', c.dataset.phase === st.phase));
  }
}
function confirmFeedback() {
  const sel = [...dom.feedbackSubjects.querySelectorAll('.chip.active')].map(c => c.dataset.subj);
  const phaseEl = dom.feedbackPhases.querySelector('.chip.active');
  if (!sel.length) { alert('请至少选择一个科目'); return; }
  if (!phaseEl) { alert('请选择一个复习阶段'); return; }
  st.subjects = sel; st.phase = phaseEl.dataset.phase;
  saveLS(); dom.feedbackOverlay.classList.add('hidden');
}

// ============ DRAW ============
function drawFrom(pool, alreadyDrawn, planCount) {
  const available = pool.filter(q => !alreadyDrawn.includes(q.id));
  if (!available.length) { alert('当前没有可抽取的题目，或已全部抽完。'); return null; }
  const n = Math.min(planCount, available.length);
  const shuffled = [...available];
  for (let i=shuffled.length-1; i>0; i--) {
    const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  const sel = shuffled.slice(0,n);
  const newIds = sel.map(q => q.id);
  newIds.forEach(id => getPwdFor(id));
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

function renderPractice() {
  const subjBtn = dom.practiceSubjectTabs.querySelector('.tab-btn.active');
  const typeBtn = dom.practiceTypeTabs.querySelector('.tab-btn.active');
  const subj = subjBtn?.dataset.subj || '刑法';
  const type = typeBtn?.dataset.type || '模拟题';
  const dataSubj = SUBJ_MAP[subj] || subj;

  const pool = questionsData.filter(q => q.subject === dataSubj && q.type === type);
  dom.practicePoolCount.textContent = pool.length;
  dom.practiceDrawnCount.textContent = st.practiceDrawn.length;

  const drawn = st.practiceDrawn.map(id => questionsData.find(q => q.id===id)).filter(Boolean);
  if (!drawn.length) { dom.practiceDrawn.classList.add('hidden'); dom.practiceEmpty.classList.remove('hidden'); return; }
  dom.practiceEmpty.classList.add('hidden'); dom.practiceDrawn.classList.remove('hidden');
  if (st.practiceIdx >= drawn.length) st.practiceIdx = 0;
  renderQCard(drawn[st.practiceIdx], drawn.length);
  renderNav(st.practiceDrawn.length, st.practiceIdx, dom.practiceDrawnNav, (i) => { st.practiceIdx=i; renderPractice(); });
}

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

function renderQCard(q, total) {
  const isUnlocked = st.unlocked.has(q.id);
  const pos = st.practiceIdx+1;
  dom.practiceContainer.innerHTML = `
    <div class="question-card">
      <div class="q-card-header">
        <span class="q-card-title">${q.title}（${q.score}分）${st.tenant === 'manager' ? '<span style="font-size:0.75rem;color:var(--text-secondary);margin-left:8px">👤 管理者预览</span>' : ''}</span>
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
          : st.tenant === 'manager'
            ? `<div class="content-text ans-text" style="background:#f0f0f0;border-color:#ccc">${esc((q.answer||'').substring(0,200))}...</div>`
            : `<div class="ans-locked"><p>完成作答后，向督学索要本题密码</p>
               <button class="btn-primary unlock-btn">🔑 输入密码查看答案</button></div>`}
      </div>
      <div class="q-card-nav">
        <button class="btn-sec" onclick="navPractice(-1)" ${st.practiceIdx===0?'disabled':''}>◀ 上一题</button>
        <button class="btn-sec" onclick="navPractice(1)" ${st.practiceIdx>=total-1?'disabled':''}>下一题 ▶</button>
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
        <span class="q-card-title">法条定位题${st.tenant === 'manager' ? '<span style="font-size:0.75rem;color:var(--text-secondary);margin-left:8px">👤 管理者预览</span>' : ''}</span>
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
          : st.tenant === 'manager'
            ? `<div class="content-text ans-text" style="background:#f0f0f0;border-color:#ccc">${esc(q.a)}</div>`
            : `<div class="ans-locked"><p>完成作答后，向督学索要本题密码</p>
               <button class="btn-primary unlock-btn">🔑 输入密码查看答案</button></div>`}
      </div>
      <div class="q-card-nav">
        <button class="btn-sec" onclick="navProv(-1)" ${st.provisionIdx===0?'disabled':''}>◀ 上一题</button>
        <button class="btn-sec" onclick="navProv(1)" ${st.provisionIdx>=total-1?'disabled':''}>下一题 ▶</button>
      </div>
    </div>`;
  dom.provisionContainer.querySelector('.unlock-btn')?.addEventListener('click', () => showAnswerPwd(q.id));
}

window.navPractice = function(dir) { st.practiceIdx+=dir; renderPractice(); };
window.navProv = function(dir) { st.provisionIdx+=dir; renderProvision(); };

function renderNav(total, active, container, onClick) {
  container.innerHTML = '';
  for (let i=0; i<total; i++) {
    const d = document.createElement('button');
    d.className='nav-dot'+(i===active?' active':''); d.textContent=i+1;
    d.addEventListener('click',()=>onClick(i));
    container.appendChild(d);
  }
}

// ===== RECITE =====
function renderRecite() {
  const subj = dom.reciteSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj || '刑法';
  const now = new Date(); const wd=['日','一','二','三','四','五','六'];
  dom.todayDate.textContent = `${now.getFullYear()}年${String(now.getMonth()+1).padStart(2,'0')}月${String(now.getDate()).padStart(2,'0')}日 星期${wd[now.getDay()]}`;
  const map = { '刑法':'待督学发布刑法背诵内容...','刑事诉讼法':'待督学发布刑事诉讼法背诵内容...',
    '民法':'待督学发布民法背诵内容...','民事诉讼法':'待督学发布民事诉讼法背诵内容...',
    '理论法':'待督学发布理论法背诵内容...','行政法与行政诉讼法':'待督学发布行政法背诵内容...' };
  dom.reciteText.innerHTML = `<p>${map[subj]||map['行政法与行政诉讼法']||'待督学发布背诵内容...'}</p>`;
}

// ===== VIDEO & MATERIAL =====
const videoData = {
  '刑法':[{n:'柏浪涛 刑法主观题',s:'柏神2025刑法主观10题精讲'},{n:'刑法法条串讲',s:'待添加...'}],
  '刑诉':[{n:'左宁 刑诉法主观题',s:'刑诉法条定位40题讲解'},{n:'向高甲 刑诉背诵',s:'待添加...'}],
  '民法':[{n:'钟秀勇 民法主观题',s:'待添加...'},{n:'张翔 民法',s:'待添加...'}],
  '民诉':[{n:'戴鹏 民诉法',s:'待添加...'},{n:'韩心怡 民诉',s:'待添加...'}],
  '理论法':[{n:'杜洪波 理论法',s:'待添加...'},{n:'白斌 理论法',s:'待添加...'}],
  '行政法':[{n:'李佳 行政法',s:'行政法每日一题24题已加载'},{n:'徐金桂 行政法',s:'待添加...'}],
};
function renderVideos() {
  const subj = dom.videoSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj || '刑法';
  dom.videoGrid.innerHTML = (videoData[subj]||[]).map(v =>
    `<div class="resource-card"><div class="rsc-icon">🎬</div><h3>${v.n}</h3><p>${v.s}</p><span class="rsc-status pending">待上传</span></div>`
  ).join('');
}
const materialData = {
  '刑法':[{n:'柏浪涛 刑法攻略',s:'2025刑法主观题冲刺版',l:true},{n:'柏神2025主观10题',s:'已加载至刷题系统',l:true}],
  '刑诉':[{n:'左宁 刑诉法攻略',s:'法条定位40题已加载',l:true},{n:'向高甲 刑诉法',s:'待添加...',l:false}],
  '民法':[{n:'钟秀勇 民法攻略',s:'待添加...',l:false}],
  '民诉':[{n:'戴鹏 民诉法攻略',s:'待添加...',l:false}],
  '理论法':[{n:'杜洪波 理论法',s:'待添加...',l:false}],
  '行政法':[{n:'李佳 行政法',s:'每日一题24题已加载',l:true},{n:'徐金桂 行政法',s:'待添加...',l:false}],
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
  dom.answerPwdInput.value = ''; dom.answerPwdError.classList.add('hidden');
  dom.answerPwdModal.classList.remove('hidden');
  setTimeout(() => dom.answerPwdInput.focus(), 100);
}
function hideAnswerPwd() { dom.answerPwdModal.classList.add('hidden'); pendingUnlockId = null; }
function confirmAnswerPwd() {
  const pwd = dom.answerPwdInput.value.trim();
  const correct = getPwdFor(pendingUnlockId);
  if (pwd === correct) {
    st.unlocked.add(pendingUnlockId); saveLS();
    hideAnswerPwd(); renderPractice(); renderProvision();
  } else {
    dom.answerPwdError.classList.remove('hidden');
    dom.answerPwdInput.value = ''; dom.answerPwdInput.focus();
  }
}

// ============ ADMIN DASHBOARD ============
function showAdmin() {
  // 当前登录学生的数据
  dom.adminCurrentStudent.textContent = st.studentId || '管理者';
  dom.adminSubjects.textContent = st.subjects.length ? st.subjects.join('、') : '未提交';
  dom.adminPhase.textContent = st.phase || '未提交';
  dom.adminPracticeDrawn.textContent = st.practiceDrawn.length;
  dom.adminProvisionDrawn.textContent = st.provisionDrawn.length;

  // 今日密码
  const pq = st.practiceDrawn.map(id => questionsData.find(q=>q.id===id)).filter(Boolean);
  dom.adminPracticePasswords.innerHTML = pq.length
    ? pq.map(q => `<div class="pwd-row"><span>${q.title}（${q.subject}）</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join('')
    : '<p class="empty-hint">今日未抽题</p>';
  const pv = st.provisionDrawn.map(id => provisionData.find(q=>q.id===id)).filter(Boolean);
  dom.adminProvisionPasswords.innerHTML = pv.length
    ? pv.map(q => `<div class="pwd-row"><span>法条定位题</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join('')
    : '<p class="empty-hint">今日未抽题</p>';

  // 学生列表
  dom.adminManagerPwd.value = localStorage.getItem('fk_mgr_pwd') || DEFAULT_MGR_PWD;
  renderStudentList();
  dom.adminModal.classList.remove('hidden');
}
function hideAdmin() { dom.adminModal.classList.add('hidden'); }

function renderStudentList() {
  const students = getStudents();
  if (!students.length) {
    dom.adminStudentList.innerHTML = '<p class="empty-hint">还没有学生账号，下方添加</p>';
    return;
  }
  dom.adminStudentList.innerHTML = students.map(s => {
    // 查看该学生今日学习情况
    const p = 'fk_' + s.id + '_';
    const practiceDrawn = JSON.parse(localStorage.getItem(p + 'practice_drawn') || '[]');
    const provisionDrawn = JSON.parse(localStorage.getItem(p + 'provision_drawn') || '[]');
    const unlocked = JSON.parse(localStorage.getItem(p + 'unlocked') || '[]');
    const subjects = JSON.parse(localStorage.getItem(p + 'subjects') || '[]');
    const phase = localStorage.getItem(p + 'phase') || '';
    return `<div class="student-row">
      <div class="student-info">
        <strong>${s.id}</strong>
        <span class="student-meta">密码: ${s.pwd}</span>
        <span class="student-meta">抽题: ${practiceDrawn.length+provisionDrawn.length} | 解锁: ${unlocked.length}</span>
        <span class="student-meta">${subjects.join('/')||'未填'} ${phase ? '· '+phase : ''}</span>
      </div>
      <button class="btn-sec btn-sm del-student" data-id="${s.id}">删除</button>
    </div>`;
  }).join('');
  dom.adminStudentList.querySelectorAll('.del-student').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm(`确定删除学生 ${btn.dataset.id} 的所有数据？`)) return;
      let students = getStudents();
      students = students.filter(s => s.id !== btn.dataset.id);
      saveStudents(students);
      renderStudentList();
    });
  });
}

// ============ UTILITIES ============
function esc(t) { const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; }
function fmtPara(text) {
  return (text||'').split(/\n\n+/).filter(p=>p.trim()).map(p => `<p class="pi">${esc(p.trim().replace(/\n/g,' '))}</p>`).join('');
}

// ============ SWITCH MODULE ============
function switchModule(name) {
  $$('.module').forEach(m => m.classList.toggle('active', m.id==='module-'+name));
  $$('.nav-btn[data-module]').forEach(b => b.classList.toggle('active', b.dataset.module===name));
  dom.navLinks.classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}

// ============ BIND EVENTS ============
function bindEvents() {
  // Login
  dom.loginLearner.addEventListener('click', switchToStudentLogin);
  dom.loginManager.addEventListener('click', () => {
    dom.managerPwdArea.classList.remove('hidden');
    dom.managerPwdInput.focus();
  });
  dom.managerPwdConfirm.addEventListener('click', () => {
    const pwd = dom.managerPwdInput.value.trim();
    const correct = localStorage.getItem('fk_mgr_pwd') || DEFAULT_MGR_PWD;
    if (pwd === correct) {
      doLogin('manager');
      dom.managerPwdArea.classList.add('hidden');
      dom.managerPwdInput.value = '';
    } else {
      dom.loginError.classList.remove('hidden');
      dom.managerPwdInput.value = '';
      dom.managerPwdInput.focus();
    }
  });
  dom.managerPwdInput.addEventListener('keydown', e => {
    if (e.key==='Enter') dom.managerPwdConfirm.click();
    if (e.key==='Escape') { dom.managerPwdArea.classList.add('hidden'); dom.managerPwdInput.value=''; }
  });

  // Student login
  dom.studentLoginConfirm.addEventListener('click', () => {
    const sid = dom.studentIdInput.value.trim();
    const pwd = dom.studentPwdInput.value.trim();
    if (!sid) { dom.studentLoginError.textContent = '请输入学生ID'; dom.studentLoginError.classList.remove('hidden'); return; }
    const students = getStudents();
    const found = students.find(s => s.id === sid);
    if (!found) { dom.studentLoginError.textContent = '学生ID不存在，请联系管理员'; dom.studentLoginError.classList.remove('hidden'); return; }
    if (found.pwd !== pwd) { dom.studentLoginError.textContent = '密码错误'; dom.studentLoginError.classList.remove('hidden'); return; }
    dom.studentLoginError.classList.add('hidden');
    doLogin(sid);
  });
  dom.studentIdInput.addEventListener('keydown', e => { if (e.key==='Enter') dom.studentPwdInput.focus(); });
  dom.studentPwdInput.addEventListener('keydown', e => { if (e.key==='Enter') dom.studentLoginConfirm.click(); });

  // Feedback
  dom.feedbackSubjects.addEventListener('click', e => { const c=e.target.closest('.chip'); if(c) c.classList.toggle('active'); });
  dom.feedbackPhases.addEventListener('click', e => {
    const c=e.target.closest('.chip');
    if(c) { dom.feedbackPhases.querySelectorAll('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); }
  });
  dom.feedbackConfirm.addEventListener('click', confirmFeedback);

  // Nav
  dom.navLinks.addEventListener('click', e => { const b=e.target.closest('.nav-btn[data-module]'); if(b) switchModule(b.dataset.module); });
  dom.hamburgerBtn.addEventListener('click', () => dom.navLinks.classList.toggle('open'));
  dom.adminBtn.addEventListener('click', showAdmin);
  dom.loginSwitch.addEventListener('click', () => {
    st = freshState(null);
    document.querySelectorAll('.fullscreen-overlay').forEach(o => o.classList.add('hidden'));
    // Reset login form
    dom.loginLearner.classList.remove('hidden');
    dom.loginManager.classList.remove('hidden');
    dom.studentLoginArea.classList.add('hidden');
    dom.managerPwdArea.classList.add('hidden');
    dom.loginError.classList.add('hidden');
    dom.studentLoginError.classList.add('hidden');
    dom.studentIdInput.value = '';
    dom.studentPwdInput.value = '';
    showLogin();
  });

  // Tab bars
  document.querySelectorAll('.tabs-bar').forEach(bar => {
    bar.addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const id = bar.id;
      if (id==='practiceSubjectTabs'||id==='practiceTypeTabs') renderPractice();
      else if (id==='reciteSubjectTabs') renderRecite();
      else if (id==='videoSubjectTabs') renderVideos();
      else if (id==='materialSubjectTabs') renderMaterials();
    });
  });

  // Practice draw
  dom.practiceDrawBtn.addEventListener('click', () => {
    if (st.tenant === 'manager') { alert('管理者模式不记录抽题数据。请以学生身份登录使用学习功能。'); return; }
    const subj = dom.practiceSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj || '刑法';
    const type = dom.practiceTypeTabs.querySelector('.tab-btn.active')?.dataset.type || '模拟题';
    const dataSubj = SUBJ_MAP[subj] || subj;
    const pool = questionsData.filter(q => q.subject===dataSubj && q.type===type);
    const plan = Math.max(1, parseInt(dom.practicePlanCount.value)||1);
    drawFrom(pool, st.practiceDrawn, plan);
    st.practiceIdx = st.practiceDrawn.length - plan;
    renderPractice();
  });
  dom.practiceResetBtn.addEventListener('click', () => {
    if (st.tenant === 'manager') { alert('管理者模式无抽题数据可重置。'); return; }
    if (!confirm('重置今日刷题抽题？')) return;
    st.practiceDrawn=[]; st.practiceIdx=0; saveLS(); renderPractice();
  });

  // Provision draw
  dom.provisionDrawBtn.addEventListener('click', () => {
    if (st.tenant === 'manager') { alert('管理者模式不记录抽题数据。请以学生身份登录使用学习功能。'); return; }
    const plan = Math.max(1, parseInt(dom.provisionPlanCount.value)||1);
    drawFrom(provisionData, st.provisionDrawn, plan);
    st.provisionIdx = st.provisionDrawn.length - plan;
    renderProvision();
  });
  dom.provisionResetBtn.addEventListener('click', () => {
    if (st.tenant === 'manager') { alert('管理者模式无抽题数据可重置。'); return; }
    if (!confirm('重置今日法条定位抽题？')) return;
    st.provisionDrawn=[]; st.provisionIdx=0; saveLS(); renderProvision();
  });

  // Answer password
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
    localStorage.setItem('fk_mgr_pwd', pwd);
    alert('管理者密码已更新');
  });

  // Add student
  dom.adminAddStudentBtn.addEventListener('click', () => {
    const raw = dom.adminNewStudentId.value.trim();
    if (!raw) { alert('请输入学生ID'); return; }
    const students = getStudents();
    if (students.find(s => s.id === raw)) { alert('该学生ID已存在'); return; }
    const pwd = genPwd();
    students.push({ id: raw, pwd: pwd, created: new Date().toISOString() });
    saveStudents(students);
    dom.adminNewStudentId.value = '';
    renderStudentList();
    alert(`学生 ${raw} 创建成功！初始密码：${pwd}`);
  });
  dom.adminNewStudentId.addEventListener('keydown', e => { if (e.key==='Enter') dom.adminAddStudentBtn.click(); });

  // Close mobile nav
  document.addEventListener('click', e => {
    if (dom.navLinks.classList.contains('open') && !dom.navLinks.contains(e.target) && !dom.hamburgerBtn.contains(e.target))
      dom.navLinks.classList.remove('open');
  });
}

// ============ INIT ============
function init() {
  initDom();
  bindEvents();
  showLogin();
}

document.addEventListener('DOMContentLoaded', init);

/**
 * 法考主观题督学系统 v5
 * - 管理员在线添加题目
 * - 统计面板（科目题库 + 学生进度）
 * - 一键发布到GitHub
 * - 学生独立数据隔离
 */

// ============ CONSTANTS ============
const DEFAULT_MGR_PWD = '3223';
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const SUBJ_MAP = { '刑法':'刑法','民法':'民法','民诉':'民事诉讼法','刑诉':'刑诉法','行政法':'行政法与行政诉讼法','理论法':'理论法' };
const REV_SUBJ = {}; Object.entries(SUBJ_MAP).forEach(([k,v]) => REV_SUBJ[v] = k);
const TYPE_NAMES = ['模拟题','真题','每日练习','民事大综合'];

// ============ STATE ============
let st = {};

function freshState(tenant) {
  return {
    tenant, role: tenant === 'manager' ? 'manager' : 'learner',
    studentId: tenant === 'manager' ? null : tenant,
    subjects: [], phase: '', practiceDrawn: [], provisionDrawn: [],
    practiceIdx: 0, provisionIdx: 0,
    unlocked: new Set(), questionPasswords: {},
  };
}

// ============ PERSISTENCE ============
function pfx() { return st.tenant ? 'fk_' + st.tenant + '_' : 'fk_'; }
function saveLS() {
  try {
    const p = pfx();
    localStorage.setItem(p+'practice_drawn', JSON.stringify(st.practiceDrawn));
    localStorage.setItem(p+'provision_drawn', JSON.stringify(st.provisionDrawn));
    localStorage.setItem(p+'practice_date', todayKey());
    localStorage.setItem(p+'provision_date', todayKey());
    localStorage.setItem(p+'unlocked', JSON.stringify([...st.unlocked]));
    localStorage.setItem(p+'passwords', JSON.stringify(st.questionPasswords));
    if (st.role === 'learner') {
      localStorage.setItem(p+'subjects', JSON.stringify(st.subjects));
      localStorage.setItem(p+'phase', st.phase);
      localStorage.setItem(p+'fb_date', todayKey());
    }
  } catch {}
}
function loadState(tenant) {
  st = freshState(tenant);
  try {
    const p = pfx();
    if (isToday(p+'practice_drawn')) st.practiceDrawn = JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
    if (isToday(p+'provision_drawn')) st.provisionDrawn = JSON.parse(localStorage.getItem(p+'provision_drawn')||'[]');
    st.unlocked = new Set(JSON.parse(localStorage.getItem(p+'unlocked')||'[]'));
    st.questionPasswords = JSON.parse(localStorage.getItem(p+'passwords')||'{}');
    if (st.role === 'learner') {
      st.subjects = JSON.parse(localStorage.getItem(p+'subjects')||'[]');
      st.phase = localStorage.getItem(p+'phase')||'';
    }
  } catch {}
}
function todayKey() { const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function isToday(k) { return localStorage.getItem(k)===todayKey(); }

// ============ ADMIN CUSTOM QUESTIONS ============
function getAdminQuestions() {
  try { return JSON.parse(localStorage.getItem('fk_admin_questions')||'[]'); }
  catch { return []; }
}
function saveAdminQuestions(qs) { localStorage.setItem('fk_admin_questions', JSON.stringify(qs)); }

/** 合并题库：默认数据 + 管理员添加的数据 */
function getMergedPool(subj, type) {
  const defaults = questionsData.filter(q => q.subject===subj && q.type===type);
  const customs = getAdminQuestions().filter(q => q.subject===subj && q.type===type);
  // 管理员自定义题目的ID从10000开始
  const merged = [...defaults];
  customs.forEach((q, i) => { q.id = 10000 + i; merged.push(q); });
  return merged;
}

function getAdminNextId() {
  const qs = getAdminQuestions();
  return qs.length > 0 ? Math.max(...qs.map(q => q.id || 0)) + 1 : 1;
}

// ============ PUBLISH SYSTEM ============
/** 管理员发布：把admin_questions写入fk_published供学习者同步 */
function publishToLearners() {
  const adminQs = getAdminQuestions();
  const version = Date.now();
  localStorage.setItem('fk_published_data', JSON.stringify({ version, questions: adminQs }));
  localStorage.setItem('fk_published_version', String(version));
  return version;
}
function getPublishedVersion() {
  return parseInt(localStorage.getItem('fk_published_version')||'0');
}
function loadPublishedData() {
  try {
    const raw = localStorage.getItem('fk_published_data');
    if (!raw) return [];
    return JSON.parse(raw).questions || [];
  } catch { return []; }
}

// ============ LEARNER CHECK UPDATES ============
function learnerCheckUpdates() {
  const pubVersion = getPublishedVersion();
  const lastSeen = parseInt(localStorage.getItem(pfx()+'last_pub_version')||'0');
  if (pubVersion > lastSeen) {
    localStorage.setItem(pfx()+'last_pub_version', String(pubVersion));
    return true;
  }
  return false;
}

// ============ STUDENT ACCOUNTS ============
function getStudents() { try { return JSON.parse(localStorage.getItem('fk_students')||'[]'); } catch { return []; } }
function saveStudents(s) { localStorage.setItem('fk_students', JSON.stringify(s)); }

// ============ PASSWORD ============
function genPwd() { return String(Math.floor(1000+Math.random()*9000)); }
function getPwdFor(id) {
  if (!st.questionPasswords[id]) { st.questionPasswords[id]=genPwd(); saveLS(); }
  return st.questionPasswords[id];
}

// ============ DOM ============
const dom = {};
function initDom() {
  const ids = ['loginOverlay','loginLearner','loginManager','managerPwdArea','managerPwdInput','loginError','managerPwdConfirm',
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
    'editorSubject','editorType','editorTitle','editorCase','editorProblems','editorAnswer','editorSaveBtn','editorStatus',
    'publishBtn','statsTabBtns','statsContent'];
  ids.forEach(id => dom[id] = $(id));
}

// ============ LOGIN ============
function showLogin() { dom.loginOverlay.classList.remove('hidden'); st=freshState(null); }
function switchToStudentLogin() {
  dom.loginLearner.classList.add('hidden'); dom.loginManager.classList.add('hidden');
  dom.studentLoginArea.classList.remove('hidden'); dom.studentIdInput.focus();
}
function doLogin(tenant) {
  loadState(tenant);
  hideLogin();
  const isMgr = tenant === 'manager';
  dom.adminBtn.classList.toggle('hidden', !isMgr);
  dom.navSep.classList.toggle('hidden', !isMgr);
  dom.loginSwitch.textContent = isMgr ? '🔒 退出管理' : '🔄 切换身份';
  if (st.role === 'learner') {
    showFeedbackIfNeeded();
    // 检查更新
    if (learnerCheckUpdates()) {
      const msg = localStorage.getItem('fk_update_msg') || '管理员已发布新题目，当前题库已更新！';
      setTimeout(() => alert('🔄 ' + msg), 500);
    }
  }
  renderAll();
}

// ============ FEEDBACK ============
function showFeedbackIfNeeded() {
  const p = pfx();
  if (localStorage.getItem(p+'fb_date')!==todayKey() || !st.subjects.length) {
    dom.feedbackOverlay.classList.remove('hidden');
    dom.feedbackSubjects.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', st.subjects.includes(c.dataset.subj)));
    dom.feedbackPhases.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.phase===st.phase));
  }
}
function confirmFeedback() {
  const sel=[...dom.feedbackSubjects.querySelectorAll('.chip.active')].map(c=>c.dataset.subj);
  const pe=dom.feedbackPhases.querySelector('.chip.active');
  if (!sel.length||!pe) { alert('请选择科目和阶段'); return; }
  st.subjects=sel; st.phase=pe.dataset.phase; saveLS();
  dom.feedbackOverlay.classList.add('hidden');
}

// ============ DRAW ============
function drawFrom(pool, already, n) {
  const avail = pool.filter(q => !already.includes(q.id));
  if (!avail.length) { alert('无可抽取的题目'); return null; }
  const cnt = Math.min(n, avail.length);
  const shuf = [...avail];
  for (let i=shuf.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [shuf[i],shuf[j]]=[shuf[j],shuf[i]]; }
  const ids = shuf.slice(0,cnt).map(q=>q.id);
  ids.forEach(id=>getPwdFor(id));
  already.push(...ids); saveLS();
  return already;
}

// ============ RENDER ============
function renderAll() { renderPractice(); renderProvision(); renderRecite(); renderVideos(); renderMaterials(); }

function getCurrentSubjType() {
  const sb = dom.practiceSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法';
  const tp = dom.practiceTypeTabs.querySelector('.tab-btn.active')?.dataset.type||'模拟题';
  return { subj: sb, type: tp, dataSubj: SUBJ_MAP[sb]||sb };
}

function renderPractice() {
  const {subj,type,dataSubj} = getCurrentSubjType();
  const pool = getMergedPool(dataSubj, type);
  dom.practicePoolCount.textContent = pool.length;
  dom.practiceDrawnCount.textContent = st.practiceDrawn.length;
  const drawn = st.practiceDrawn.map(id => pool.find(q=>q.id===id)).filter(Boolean);
  if (!drawn.length) { dom.practiceDrawn.classList.add('hidden'); dom.practiceEmpty.classList.remove('hidden'); return; }
  dom.practiceEmpty.classList.add('hidden'); dom.practiceDrawn.classList.remove('hidden');
  if (st.practiceIdx >= drawn.length) st.practiceIdx = 0;
  const q = drawn[st.practiceIdx];
  const isMgr = st.tenant === 'manager';
  const isUnlocked = st.unlocked.has(q.id);
  dom.practiceContainer.innerHTML = `
    <div class="question-card">
      <div class="q-card-header">
        <span class="q-card-title">${q.title||''}（${q.score||36}分）${isMgr?'<span style="font-size:0.75rem;color:var(--text-secondary);margin-left:8px">👤 管理者预览</span>':''}</span>
        <span class="q-card-position">${st.practiceIdx+1}/${drawn.length}</span>
      </div>
      <div class="q-card-badges">
        <span class="badge subj">${q.subject}</span>
        <span class="badge type">${q.type}</span>
        <span class="badge score">${q.score||36}分</span>
        ${(q.id>=10000)?'<span class="badge" style="background:#fce7f3;color:#9d174d">📝 自定义</span>':''}
        ${isUnlocked?'<span class="badge unlocked">✓ 已解锁</span>':''}
      </div>
      <div class="q-card-section"><h4>📋 案情</h4><div class="content-text">${q.case?fmtPara(q.case):'(无)'}</div></div>
      <div class="q-card-section"><h4>❓ 问题</h4><div class="content-text">${esc(q.problems||'')}</div></div>
      <div class="q-card-section ans-section">
        <h4>🔒 参考答案</h4>
        ${isUnlocked ? `<div class="content-text ans-text">${esc(q.answer||'暂无')}</div>`
        : isMgr ? `<div class="content-text ans-text" style="background:#f0f0f0;border-color:#ccc">${esc((q.answer||'').substring(0,300))}${(q.answer||'').length>300?'...':''}</div>`
        : `<div class="ans-locked"><p>完成作答后，向督学索要本题密码</p><button class="btn-primary unlock-btn">🔑 输入密码查看答案</button></div>`}
      </div>
      <div class="q-card-nav">
        <button class="btn-sec" onclick="navPractice(-1)" ${st.practiceIdx===0?'disabled':''}>◀ 上一题</button>
        <button class="btn-sec" onclick="navPractice(1)" ${st.practiceIdx>=drawn.length-1?'disabled':''}>下一题 ▶</button>
      </div>
    </div>`;
  dom.practiceContainer.querySelector('.unlock-btn')?.addEventListener('click', ()=>showAnswerPwd(q.id));
}

function renderProvision() {
  const pool=provisionData; const drawn=st.provisionDrawn.map(id=>pool.find(q=>q.id===id)).filter(Boolean);
  dom.provisionPoolCount.textContent=pool.length; dom.provisionDrawnCount.textContent=st.provisionDrawn.length;
  if (!drawn.length) { dom.provisionDrawn.classList.add('hidden'); dom.provisionEmpty.classList.remove('hidden'); return; }
  dom.provisionEmpty.classList.add('hidden'); dom.provisionDrawn.classList.remove('hidden');
  if (st.provisionIdx>=drawn.length) st.provisionIdx=0;
  const q=drawn[st.provisionIdx]; const isU=st.unlocked.has(q.id); const isM=st.tenant==='manager';
  dom.provisionContainer.innerHTML=`
    <div class="question-card"><div class="q-card-header"><span class="q-card-title">法条定位题${isM?'<span style="font-size:0.75rem;color:var(--text-secondary);margin-left:8px">👤 管理者预览</span>':''}</span><span class="q-card-position">${st.provisionIdx+1}/${drawn.length}</span></div>
    <div class="q-card-section"><h4>❓ 问题</h4><div class="content-text" style="font-size:1rem">${esc(q.q)}</div></div>
    <div class="q-card-section ans-section"><h4>📖 答案</h4>
    ${isU?`<div class="content-text ans-text">${esc(q.a)}</div>`:isM?`<div class="content-text ans-text" style="background:#f0f0f0">${esc(q.a)}</div>`:`<div class="ans-locked"><p>完成作答后索要密码</p><button class="btn-primary unlock-btn">🔑 输入密码查看答案</button></div>`}
    </div><div class="q-card-nav">
    <button class="btn-sec" onclick="navProv(-1)" ${st.provisionIdx===0?'disabled':''}>◀ 上一题</button>
    <button class="btn-sec" onclick="navProv(1)" ${st.provisionIdx>=drawn.length-1?'disabled':''}>下一题 ▶</button></div></div>`;
  dom.provisionContainer.querySelector('.unlock-btn')?.addEventListener('click',()=>showAnswerPwd(q.id));
}

window.navPractice=function(d){st.practiceIdx+=d;renderPractice();};
window.navProv=function(d){st.provisionIdx+=d;renderProvision();};

// ===== RECITE =====
function renderRecite() {
  const s=dom.reciteSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法';
  const n=new Date(); const w=['日','一','二','三','四','五','六'];
  dom.todayDate.textContent=`${n.getFullYear()}年${String(n.getMonth()+1).padStart(2,'0')}月${String(n.getDate()).padStart(2,'0')}日 星期${w[n.getDay()]}`;
  dom.reciteText.innerHTML=`<p>待督学发布${s}背诵内容...</p>`;
}

// ===== VIDEO & MATERIAL =====
const vD={'刑法':[{n:'柏浪涛 刑法主观题',s:'柏神10题'}],'刑诉':[{n:'左宁 刑诉法',s:'法条定位40题'}],'民法':[{n:'待添加',s:'待上传'}],'民诉':[{n:'待添加',s:'待上传'}],'理论法':[{n:'待添加',s:'待上传'}],'行政法':[{n:'李佳 行政法',s:'每日一题24题'}]};
function renderVideos(){const s=dom.videoSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法'; dom.videoGrid.innerHTML=(vD[s]||[]).map(v=>`<div class="resource-card"><div class="rsc-icon">🎬</div><h3>${v.n}</h3><p>${v.s}</p><span class="rsc-status pending">待上传</span></div>`).join('');}
const mD={'刑法':[{n:'柏浪涛 刑法攻略',l:1},{n:'柏神主观10题',l:1}],'刑诉':[{n:'左宁 刑诉法',l:1}],'行政法':[{n:'李佳 行政法',l:1}],'民法':[{n:'待添加'}],'民诉':[{n:'待添加'}],'理论法':[{n:'待添加'}]};
function renderMaterials(){const s=dom.materialSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法'; dom.materialGrid.innerHTML=(mD[s]||[]).map(v=>`<div class="resource-card${v.l?' loaded':''}"><div class="rsc-icon">${v.l?'📗':'📕'}</div><h3>${v.n}</h3><p>${v.l?'已加载':'待上传'}</p><span class="rsc-status ${v.l?'loaded':'pending'}">${v.l?'✓ 已加载':'待上传'}</span></div>`).join('');}

// ============ ANSWER PASSWORD ============
let puid=null;
function showAnswerPwd(id){puid=id; dom.answerPwdInput.value=''; dom.answerPwdError.classList.add('hidden'); dom.answerPwdModal.classList.remove('hidden'); setTimeout(()=>dom.answerPwdInput.focus(),100);}
function hideAnswerPwd(){dom.answerPwdModal.classList.add('hidden'); puid=null;}
function confirmAnswerPwd(){const p=dom.answerPwdInput.value.trim(); const c=getPwdFor(puid); if(p===c){st.unlocked.add(puid); saveLS(); hideAnswerPwd(); renderPractice(); renderProvision();}else{dom.answerPwdError.classList.remove('hidden'); dom.answerPwdInput.value=''; dom.answerPwdInput.focus();}}

// ============ ADMIN DASHBOARD ============
function showAdmin() {
  dom.adminCurrentStudent.textContent=st.studentId||'管理者(系统)';
  dom.adminSubjects.textContent=st.subjects.length?st.subjects.join('、'):'未提交';
  dom.adminPhase.textContent=st.phase||'未提交';
  dom.adminPracticeDrawn.textContent=st.practiceDrawn.length;
  dom.adminProvisionDrawn.textContent=st.provisionDrawn.length;
  const pq=st.practiceDrawn.map(id=>getMergedPool('','').find(q=>q.id===id)).filter(Boolean);
  dom.adminPracticePasswords.innerHTML=pq.length?pq.map(q=>`<div class="pwd-row"><span>${q.title||'题'}（${q.subject}）</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">今日未抽题</p>';
  const pv=st.provisionDrawn.map(id=>provisionData.find(q=>q.id===id)).filter(Boolean);
  dom.adminProvisionPasswords.innerHTML=pv.length?pv.map(q=>`<div class="pwd-row"><span>法条定位题</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">今日未抽题</p>';
  dom.adminManagerPwd.value=localStorage.getItem('fk_mgr_pwd')||DEFAULT_MGR_PWD;
  renderStudentList();
  renderStats();
  dom.adminModal.classList.remove('hidden');
}
function hideAdmin(){dom.adminModal.classList.add('hidden');}

function renderStudentList() {
  const students=getStudents();
  dom.adminStudentList.innerHTML=!students.length?'<p class="empty-hint">还没有学生账号</p>':students.map(s=>{
    const p='fk_'+s.id+'_';
    const pd=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
    const pvd=JSON.parse(localStorage.getItem(p+'provision_drawn')||'[]');
    const ul=JSON.parse(localStorage.getItem(p+'unlocked')||'[]');
    const subj=JSON.parse(localStorage.getItem(p+'subjects')||'[]');
    const ph=localStorage.getItem(p+'phase')||'';
    // 计算各科目进度
    const subjProgress = subj.length ? subj.map(sn => {
      const ds = SUBJ_MAP[sn] || sn;
      const total = questionsData.filter(q=>q.subject===ds).length;
      const done = pd.filter(id => { const q=questionsData.find(qq=>qq.id===id); return q&&q.subject===ds; }).length;
      return `${sn}:${done}/${total}`;
    }).join(' | ') : '';
    return `<div class="student-row"><div class="student-info"><strong>${s.id}</strong>
      <span class="student-meta">密码 ${s.pwd}</span>
      <span class="student-meta">抽${pd.length+pvd.length} 解${ul.length}</span>
      <span class="student-meta">${subj.join('/')||'未填'}${ph?'·'+ph:''}</span>
      ${subjProgress?`<span class="student-progress">${subjProgress}</span>`:''}
    </div><button class="btn-sec btn-sm del-student" data-id="${s.id}">删除</button></div>`;
  }).join('');
  dom.adminStudentList.querySelectorAll('.del-student').forEach(b=>b.addEventListener('click',()=>{
    if(!confirm('删除学生 '+b.dataset.id+'？')) return;
    let ss=getStudents(); saveStudents(ss.filter(s=>s.id!==b.dataset.id)); renderStudentList();
  }));
}

// ============ STATISTICS ============
function renderStats() {
  // 统计各科目各类型的题目数（默认+自定义）
  const adminQs=getAdminQuestions();
  const tabs = ['刑法','民法','民诉','刑诉','行政法','理论法'];
  let html = '<div class="stats-table-wrap"><table class="stats-table"><tr><th>科目</th>';
  TYPE_NAMES.forEach(t=>html+=`<th>${t}</th>`);
  html+='<th>合计</th></tr>';
  tabs.forEach(tab=>{
    const ds=SUBJ_MAP[tab];
    html+=`<tr><td>${tab}</td>`;
    let total=0;
    TYPE_NAMES.forEach(type=>{
      const def=questionsData.filter(q=>q.subject===ds&&q.type===type).length;
      const cust=adminQs.filter(q=>q.subject===ds&&q.type===type).length;
      const sum=def+cust;
      total+=sum;
      html+=`<td>${sum}${cust?`<span class="cust-badge">+${cust}</span>`:''}</td>`;
    });
    html+=`<td><strong>${total}</strong></td></tr>`;
  });
  html+='</table></div>';

  // 学生进度
  const students=getStudents();
  html+='<h4 style="margin-top:16px;margin-bottom:8px">📊 学生完成进度</h4>';
  if (!students.length) { html+='<p class="empty-hint">暂无学生</p>'; }
  else {
    html+='<div class="stats-table-wrap"><table class="stats-table"><tr><th>学生</th>';
    tabs.forEach(t=>html+=`<th>${t}</th>`);
    html+='<th>总进度</th></tr>';
    students.forEach(s=>{
      const p='fk_'+s.id+'_';
      const pd=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
      const subjPref=JSON.parse(localStorage.getItem(p+'subjects')||'[]');
      html+=`<tr><td>${s.id}</td>`;
      let totalAll=0, doneAll=0;
      tabs.forEach(tab=>{
        const ds=SUBJ_MAP[tab];
        const total=questionsData.filter(q=>q.subject===ds).length + adminQs.filter(q=>q.subject===ds).length;
        const done=pd.filter(id=>{const qq=[...questionsData,...adminQs].find(x=>x.id===id); return qq&&qq.subject===ds;}).length;
        totalAll+=total; doneAll+=done;
        html+=`<td>${done}/${total}</td>`;
      });
      const pct = totalAll>0 ? Math.round(doneAll/totalAll*100) : 0;
      html+=`<td><strong>${doneAll}/${totalAll}</strong> (${pct}%)</td></tr>`;
    });
    html+='</table></div>';
  }

  // 自定义题目显示
  if (adminQs.length) {
    html+=`<h4 style="margin-top:16px;margin-bottom:8px">📝 管理员自定义题目 (${adminQs.length}题)</h4>`;
    html+='<div class="stats-table-wrap"><table class="stats-table"><tr><th>科目</th><th>题型</th><th>标题</th><th>操作</th></tr>';
    adminQs.forEach((q,i)=>{
      const tab=REV_SUBJ[q.subject]||q.subject;
      html+=`<tr><td>${tab}</td><td>${q.type}</td><td>${q.title||'未命名'}</td>
      <td><button class="btn-sec btn-sm del-admin-q" data-idx="${i}">删除</button></td></tr>`;
    });
    html+='</table></div>';
  }

  dom.statsContent.innerHTML = html;
  dom.statsContent.querySelectorAll('.del-admin-q').forEach(b=>b.addEventListener('click',()=>{
    const idx=parseInt(b.dataset.idx);
    const qs=getAdminQuestions();
    if(!confirm('删除题目「'+qs[idx].title+'」？')) return;
    qs.splice(idx,1); saveAdminQuestions(qs); renderStats();
  }));
}

// ============ QUESTION EDITOR ============
function saveEditorQuestion() {
  const subject=dom.editorSubject.value; const type=dom.editorType.value;
  const title=dom.editorTitle.value.trim(); const caseText=dom.editorCase.value.trim();
  const problems=dom.editorProblems.value.trim(); const answer=dom.editorAnswer.value.trim();
  if (!problems) { dom.editorStatus.textContent='❌ 问题不能为空'; dom.editorStatus.className='editor-msg err'; return; }
  if (!answer) { dom.editorStatus.textContent='❌ 参考答案不能为空'; dom.editorStatus.className='editor-msg err'; return; }
  const qs=getAdminQuestions();
  qs.push({ id: getAdminNextId(), subject, type, title: title||'自定义题', score: 36, case: caseText, problems, answer });
  saveAdminQuestions(qs);
  dom.editorTitle.value=''; dom.editorCase.value=''; dom.editorProblems.value=''; dom.editorAnswer.value='';
  dom.editorStatus.textContent=`✅ 已添加！当前 "${subject}" "${type}" 自定义题共 ${qs.filter(q=>q.subject===subject&&q.type===type).length} 题`;
  dom.editorStatus.className='editor-msg ok';
}

// ============ PUBLISH ============
function publishAndExport() {
  const version = publishToLearners();
  const adminQs = getAdminQuestions();

  // 生成可下载的JS文件
  let jsContent = `/**
 * 管理员自定义题目 - 自动生成
 * 发布时间：${new Date().toLocaleString('zh-CN')}
 * 版本：${version}
 */
const adminCustomData = ${JSON.stringify(adminQs, null, 2)};
`;
  // 下载
  const blob = new Blob([jsContent], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'admin-questions.js';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  localStorage.setItem('fk_update_msg', `自定义题库已更新（${adminQs.length}题），版本 ${version}`);
  localStorage.setItem('fk_published_version', String(version));
  dom.editorStatus.textContent = `✅ 已发布！版本 ${version}，已导出 admin-questions.js 文件（${adminQs.length}题）`;
  dom.editorStatus.className = 'editor-msg ok';

  // 同时生成 data/merge-questions.js 的内容提示
  if (adminQs.length > 0) {
    dom.editorStatus.textContent += ' 📋 如需永久更新到网站，将下载的文件放入 data/ 文件夹后运行 同步GitHub.bat';
  }
}

// ============ UTILITIES ============
function esc(t){const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML;}
function fmtPara(t){return (t||'').split(/\n\n+/).filter(p=>p.trim()).map(p=>`<p class="pi">${esc(p.trim().replace(/\n/g,' '))}</p>`).join('');}
function switchModule(n){$$('.module').forEach(m=>m.classList.toggle('active',m.id==='module-'+n)); $$('.nav-btn[data-module]').forEach(b=>b.classList.toggle('active',b.dataset.module===n)); dom.navLinks.classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'});}

// ============ BIND EVENTS ============
function bindEvents() {
  dom.loginLearner.addEventListener('click', switchToStudentLogin);
  dom.loginManager.addEventListener('click', ()=>{dom.managerPwdArea.classList.remove('hidden'); dom.managerPwdInput.focus();});
  dom.managerPwdConfirm.addEventListener('click',()=>{
    const p=dom.managerPwdInput.value.trim(); const c=localStorage.getItem('fk_mgr_pwd')||DEFAULT_MGR_PWD;
    if(p===c){doLogin('manager'); dom.managerPwdArea.classList.add('hidden'); dom.managerPwdInput.value='';}
    else{dom.loginError.classList.remove('hidden'); dom.managerPwdInput.value=''; dom.managerPwdInput.focus();}
  });
  dom.managerPwdInput.addEventListener('keydown',e=>{if(e.key==='Enter')dom.managerPwdConfirm.click(); if(e.key==='Escape'){dom.managerPwdArea.classList.add('hidden');dom.managerPwdInput.value='';}});
  dom.studentLoginConfirm.addEventListener('click',()=>{
    const sid=dom.studentIdInput.value.trim(); const pwd=dom.studentPwdInput.value.trim();
    if(!sid){dom.studentLoginError.textContent='请输入学生ID'; dom.studentLoginError.classList.remove('hidden'); return;}
    const ss=getStudents(); const f=ss.find(s=>s.id===sid);
    if(!f){dom.studentLoginError.textContent='学生ID不存在'; dom.studentLoginError.classList.remove('hidden'); return;}
    if(f.pwd!==pwd){dom.studentLoginError.textContent='密码错误'; dom.studentLoginError.classList.remove('hidden'); return;}
    dom.studentLoginError.classList.add('hidden'); doLogin(sid);
  });
  dom.studentIdInput.addEventListener('keydown',e=>{if(e.key==='Enter')dom.studentPwdInput.focus();});
  dom.studentPwdInput.addEventListener('keydown',e=>{if(e.key==='Enter')dom.studentLoginConfirm.click();});

  dom.feedbackSubjects.addEventListener('click',e=>{const c=e.target.closest('.chip'); if(c)c.classList.toggle('active');});
  dom.feedbackPhases.addEventListener('click',e=>{const c=e.target.closest('.chip'); if(c){dom.feedbackPhases.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');}});
  dom.feedbackConfirm.addEventListener('click',confirmFeedback);

  dom.navLinks.addEventListener('click',e=>{const b=e.target.closest('.nav-btn[data-module]'); if(b)switchModule(b.dataset.module);});
  dom.hamburgerBtn.addEventListener('click',()=>dom.navLinks.classList.toggle('open'));
  dom.adminBtn.addEventListener('click',showAdmin);
  dom.loginSwitch.addEventListener('click',()=>{
    st=freshState(null); document.querySelectorAll('.fullscreen-overlay').forEach(o=>o.classList.add('hidden'));
    dom.loginLearner.classList.remove('hidden'); dom.loginManager.classList.remove('hidden');
    dom.studentLoginArea.classList.add('hidden'); dom.managerPwdArea.classList.add('hidden');
    dom.loginError.classList.add('hidden'); dom.studentLoginError.classList.add('hidden');
    dom.studentIdInput.value=''; dom.studentPwdInput.value=''; showLogin();
  });

  document.querySelectorAll('.tabs-bar').forEach(bar=>{
    bar.addEventListener('click',e=>{
      const btn=e.target.closest('.tab-btn'); if(!btn)return;
      bar.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
      const id=bar.id;
      if(id==='practiceSubjectTabs'||id==='practiceTypeTabs')renderPractice();
      else if(id==='reciteSubjectTabs')renderRecite();
      else if(id==='videoSubjectTabs')renderVideos();
      else if(id==='materialSubjectTabs')renderMaterials();
    });
  });

  dom.practiceDrawBtn.addEventListener('click',()=>{
    if(st.tenant==='manager'){alert('管理者不记录抽题数据'); return;}
    const {dataSubj,type}=getCurrentSubjType();
    const pool=getMergedPool(dataSubj,type);
    drawFrom(pool,st.practiceDrawn,Math.max(1,parseInt(dom.practicePlanCount.value)||1));
    st.practiceIdx=st.practiceDrawn.length-1; renderPractice();
  });
  dom.practiceResetBtn.addEventListener('click',()=>{
    if(st.tenant==='manager'){alert('管理者无抽题数据'); return;}
    if(!confirm('重置今日抽题？'))return; st.practiceDrawn=[]; st.practiceIdx=0; saveLS(); renderPractice();
  });
  dom.provisionDrawBtn.addEventListener('click',()=>{
    if(st.tenant==='manager'){alert('管理者不记录抽题数据'); return;}
    drawFrom(provisionData,st.provisionDrawn,Math.max(1,parseInt(dom.provisionPlanCount.value)||1));
    st.provisionIdx=st.provisionDrawn.length-1; renderProvision();
  });
  dom.provisionResetBtn.addEventListener('click',()=>{
    if(st.tenant==='manager'){alert('管理者无抽题数据'); return;}
    if(!confirm('重置今日法条定位？'))return; st.provisionDrawn=[]; st.provisionIdx=0; saveLS(); renderProvision();
  });

  dom.answerPwdCancel.addEventListener('click',hideAnswerPwd);
  dom.answerPwdConfirm.addEventListener('click',confirmAnswerPwd);
  dom.answerPwdModal.addEventListener('click',e=>{if(e.target===dom.answerPwdModal)hideAnswerPwd();});
  dom.answerPwdInput.addEventListener('keydown',e=>{if(e.key==='Enter')confirmAnswerPwd(); if(e.key==='Escape')hideAnswerPwd();});
  dom.answerPwdInput.addEventListener('input',function(){this.value=this.value.replace(/\D/g,'').slice(0,4);});

  dom.adminModalClose.addEventListener('click',hideAdmin);
  dom.adminModal.addEventListener('click',e=>{if(e.target===dom.adminModal)hideAdmin();});
  dom.adminSaveManagerPwd.addEventListener('click',()=>{
    const p=dom.adminManagerPwd.value.trim(); if(p.length<4){alert('至少4位'); return;}
    localStorage.setItem('fk_mgr_pwd',p); alert('已更新');
  });

  dom.adminAddStudentBtn.addEventListener('click',()=>{
    const r=dom.adminNewStudentId.value.trim(); if(!r){alert('输入学生ID'); return;}
    const ss=getStudents(); if(ss.find(s=>s.id===r)){alert('已存在'); return;}
    const p=genPwd(); ss.push({id:r,pwd:p,created:new Date().toISOString()}); saveStudents(ss);
    dom.adminNewStudentId.value=''; renderStudentList();
    alert(`学生 ${r} 创建成功！密码：${p}`);
  });
  dom.adminNewStudentId.addEventListener('keydown',e=>{if(e.key==='Enter')dom.adminAddStudentBtn.click();});

  // Question editor
  dom.editorSaveBtn.addEventListener('click', saveEditorQuestion);
  dom.publishBtn.addEventListener('click', publishAndExport);

  // Stats tab switching
  dom.statsTabBtns?.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn'); if (!btn) return;
    dom.statsTabBtns.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.stats-tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById('stats-' + tab);
    if (target) { target.classList.remove('hidden'); if (tab === 'stats') renderStats(); }
  });

  document.addEventListener('click',e=>{
    if(dom.navLinks.classList.contains('open')&&!dom.navLinks.contains(e.target)&&!dom.hamburgerBtn.contains(e.target))
      dom.navLinks.classList.remove('open');
  });
}

// ============ INIT ============
function init() {
  initDom(); bindEvents(); showLogin();
}
document.addEventListener('DOMContentLoaded', init);

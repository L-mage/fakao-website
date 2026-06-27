/**
 * 法考主观题督学系统 v8
 * - 管理者直接查看所有题目 + 编辑任意题目
 * - 学习者申请答案 → 管理者逐题批准/拒绝
 * - 每题独立4位密码，管理者可控
 */

const DEFAULT_MGR_PWD = '3223';
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const SUBJ_MAP = {'刑法':'刑法','民法':'民法','民诉':'民事诉讼法','刑诉':'刑诉法','行政法':'行政法与行政诉讼法','理论法':'理论法','民事大综合':'民事大综合'};
const REV_SUBJ = {}; Object.entries(SUBJ_MAP).forEach(([k,v])=>REV_SUBJ[v]=k);
const SUBJ_TABS = ['刑法','民法','民诉','刑诉','行政法','理论法','民事大综合'];

let st = {};
function freshState(t){return{tenant:t,role:t==='manager'?'manager':'learner',studentId:t==='manager'?null:t,subjects:[],phase:'',practiceDrawn:[],provisionDrawn:[],practiceIdx:0,provisionIdx:0,unlocked:new Set(),questionPasswords:{},pendingRequests:[]};}

function pfx(){return st.tenant?'fk_'+st.tenant+'_':'fk_';}
function saveLS(){
  try{const p=pfx();
  if(st.role==='learner'){
    localStorage.setItem(p+'practice_drawn',JSON.stringify(st.practiceDrawn));
    localStorage.setItem(p+'practice_date',todayKey());
    localStorage.setItem(p+'subjects',JSON.stringify(st.subjects));
    localStorage.setItem(p+'phase',st.phase);
    localStorage.setItem(p+'fb_date',todayKey());
  }
  localStorage.setItem(p+'unlocked',JSON.stringify([...st.unlocked]));
  localStorage.setItem(p+'passwords',JSON.stringify(st.questionPasswords));
  localStorage.setItem(p+'provision_drawn',JSON.stringify(st.provisionDrawn));
  localStorage.setItem(p+'provision_date',todayKey());
  }catch{}
}
function loadState(t){
  st=freshState(t);try{const p=pfx();
  if(isToday(p+'practice_drawn'))st.practiceDrawn=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
  if(isToday(p+'provision_drawn'))st.provisionDrawn=JSON.parse(localStorage.getItem(p+'provision_drawn')||'[]');
  st.unlocked=new Set(JSON.parse(localStorage.getItem(p+'unlocked')||'[]'));
  st.questionPasswords=JSON.parse(localStorage.getItem(p+'passwords')||'{}');
  if(st.role==='learner'){
    st.subjects=JSON.parse(localStorage.getItem(p+'subjects')||'[]');
    st.phase=localStorage.getItem(p+'phase')||'';
    st.pendingRequests=JSON.parse(localStorage.getItem(p+'pending_reqs')||'[]');
  }}catch{}
}
function todayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function isToday(k){return localStorage.getItem(k)===todayKey();}

function getStudents(){try{return JSON.parse(localStorage.getItem('fk_students')||'[]');}catch{return[];}}
function saveStudents(s){localStorage.setItem('fk_students',JSON.stringify(s));}

// ===== QUESTIONS STORAGE =====
function getAdminQuestions(){try{return JSON.parse(localStorage.getItem('fk_admin_questions')||'[]');}catch{return[];}}
function saveAdminQuestions(qs){localStorage.setItem('fk_admin_questions',JSON.stringify(qs));}
function getQuestionOverrides(){try{return JSON.parse(localStorage.getItem('fk_question_overrides')||'{}');}catch{return{};}}
function saveQuestionOverrides(o){localStorage.setItem('fk_question_overrides',JSON.stringify(o));}

function getEffectivePool(){
  const overrides=getQuestionOverrides();
  // Built-in questions with overrides applied
  let result = questionsData.map(q => overrides[q.id] ? {...q, ...overrides[q.id], id: q.id} : q);
  // Admin-added custom questions (id >= 10000)
  const customs = getAdminQuestions().map((q,i) => ({...q, id:10000+i}));
  // Also apply overrides to custom questions
  const effectiveCustoms = customs.map(q => overrides[q.id] ? {...q, ...overrides[q.id]} : q);
  return [...result, ...effectiveCustoms];
}

function genPwd(){return String(Math.floor(1000+Math.random()*9000));}
function getPwdFor(id){
  if(!st.questionPasswords[id]){st.questionPasswords[id]=genPwd();saveLS();}
  return st.questionPasswords[id];
}

// ===== REQUEST SYSTEM =====
function saveRequests(studentId, reqs){
  localStorage.setItem('fk_'+studentId+'_pending_reqs', JSON.stringify(reqs));
}
function getRequests(studentId){
  try{return JSON.parse(localStorage.getItem('fk_'+studentId+'_pending_reqs')||'[]');}catch{return[];}
}

// ===== DOM =====
const dom={};
function initDom(){['loginOverlay','loginLearner','loginManager','managerPwdArea','managerPwdInput','loginError','managerPwdConfirm',
'studentLoginArea','studentIdInput','studentPwdInput','studentLoginError','studentLoginConfirm',
'feedbackOverlay','feedbackSubjects','feedbackPhases','feedbackConfirm',
'navLinks','hamburgerBtn','adminToggle','loginSwitch','navSep',
'practiceSubjectTabs','practiceTypeTabs','practicePlanCount','practicePoolCount','practiceDrawnCount','selectHint',
'practiceDrawBtn','practiceResetBtn','practiceDrawn','practiceDrawnNav','practiceContainer','practiceEmpty',
'provisionPlanCount','provisionPoolCount','provisionDrawnCount','provisionDrawBtn','provisionResetBtn',
'provisionDrawn','provisionDrawnNav','provisionContainer','provisionEmpty',
'reciteSubjectTabs','todayDate','reciteText','videoSubjectTabs','videoGrid','materialSubjectTabs','materialGrid',
'answerPwdModal','answerPwdInput','answerPwdError','answerPwdHint','answerPwdCancel','answerPwdConfirm',
'editorPanel','editorToggle','editorBody','editorSubject','editorType','editorTitle','editorCase','editorProblems','editorAnswer','editorSaveBtn','editorStatus',
'publishBtn','adminViewStudent','adminNewStudentId','adminAddStudentBtn','adminStudentList',
'adminManagerPwd','adminSaveManagerPwd','adminPracticePasswords','adminProvisionPasswords',
'adminPendingRequests','statsContent','adminPendingCount'].forEach(id=>dom[id]=$(id));}

// ============ LOGIN ============
function showLogin(){dom.loginOverlay.classList.remove('hidden');st=freshState(null);}
function switchToStudentLogin(){dom.loginLearner.classList.add('hidden');dom.loginManager.classList.add('hidden');dom.studentLoginArea.classList.remove('hidden');dom.studentIdInput.focus();}
function doLogin(t){loadState(t);hideLogin();const m=t==='manager';dom.adminToggle.classList.toggle('hidden',!m);dom.navSep.classList.toggle('hidden',!m);dom.loginSwitch.textContent=m?'🔒 退出管理':'🔄 切换身份';if(st.role==='learner')showFeedbackIfNeeded();renderAll();}
function showFeedbackIfNeeded(){const p=pfx();if(localStorage.getItem(p+'fb_date')!==todayKey()||!st.subjects.length){dom.feedbackOverlay.classList.remove('hidden');dom.feedbackSubjects.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',st.subjects.includes(c.dataset.subj)));dom.feedbackPhases.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c.dataset.phase===st.phase));}}
function confirmFeedback(){const sel=[...dom.feedbackSubjects.querySelectorAll('.chip.active')].map(c=>c.dataset.subj);const pe=dom.feedbackPhases.querySelector('.chip.active');if(!sel.length||!pe){alert('请选择科目和阶段');return;}st.subjects=sel;st.phase=pe.dataset.phase;saveLS();dom.feedbackOverlay.classList.add('hidden');}

// ============ POOL HELPERS ============
function getSelectedSubjs(){return[...dom.practiceSubjectTabs.querySelectorAll('.tab-btn.active')].map(b=>SUBJ_MAP[b.dataset.subj]||b.dataset.subj);}
function getSelectedTypes(){return[...dom.practiceTypeTabs.querySelectorAll('.tab-btn.active')].map(b=>b.dataset.type);}
function getCurrentPool(){
  const ss=getSelectedSubjs();const ts=getSelectedTypes();const noType=ss.includes('民事大综合');
  let pool=getEffectivePool();
  if(ss.length)pool=pool.filter(q=>ss.includes(q.subject));
  if(!noType&&ts.length)pool=pool.filter(q=>ts.includes(q.type));
  return pool;
}

// ============ RENDER ============
function renderAll(){renderPractice();renderProvision();renderRecite();renderVideos();renderMaterials();}

function renderPractice(){
  dom.editorPanel.classList.toggle('hidden',st.tenant!=='manager');
  const hasDZ=!![...dom.practiceSubjectTabs.querySelectorAll('.tab-btn.active')].find(b=>b.dataset.subj==='民事大综合');
  dom.practiceTypeTabs.style.display=hasDZ?'none':'flex';

  if(st.tenant==='manager'){
    // Manager: show ALL questions as a browsable list
    const pool=getCurrentPool();
    dom.practicePoolCount.textContent=pool.length;
    dom.practiceDrawnCount.textContent='';
    dom.practiceDrawBtn.style.display='none';
    dom.practiceResetBtn.style.display='none';
    dom.practicePlanCount.parentElement.parentElement.style.display='none';
    dom.selectHint.textContent=`💡 共 ${pool.length} 道题目，点击查看详情，点击✏️编辑修改`;

    if(!pool.length){dom.practiceDrawn.classList.add('hidden');dom.practiceEmpty.classList.remove('hidden');dom.practiceEmpty.innerHTML='<div class="empty-icon">📚</div><h3>当前无题目</h3><p>切换科目或添加新题</p>';return;}
    dom.practiceEmpty.classList.add('hidden');dom.practiceDrawn.classList.remove('hidden');
    if(st.practiceIdx>=pool.length)st.practiceIdx=0;
    const q=pool[st.practiceIdx];
    const overrides=getQuestionOverrides();
    const isCustom=q.id>=10000;
    const isOverridden=overrides[q.id]!==undefined;
    const sourceLabel=isCustom?'📝 自定义':(isOverridden?'📋 已修改':'📖 原题');
    dom.practiceContainer.innerHTML=`<div class="question-card"><div class="q-card-header"><span class="q-card-title">${q.title||'未命名'}（${q.score||36}分） <span style="font-size:.75rem;color:var(--text-secondary)">${sourceLabel}</span></span><span class="q-card-position">${st.practiceIdx+1}/${pool.length}</span></div>
    <div class="q-card-badges"><span class="badge subj">${q.subject}</span><span class="badge type">${q.type}</span><span class="badge score">${q.score||36}分</span></div>
    <div class="q-card-section"><h4>📋 案情</h4><div class="content-text">${q.case?fmtPara(q.case):'(无)'}</div></div>
    <div class="q-card-section"><h4>❓ 问题</h4><div class="content-text">${esc(q.problems||'')}</div></div>
    <div class="q-card-section"><h4>🔓 参考答案</h4><div class="content-text ans-text">${esc(q.answer||'暂无')}</div></div>
    <div class="q-card-nav">
      <button class="btn-sec" onclick="navPractice(-1)" ${st.practiceIdx===0?'disabled':''}>◀ 上一题</button>
      <button class="btn-primary" onclick="editQuestion(${q.id})">✏️ 编辑此题</button>
      ${isCustom?`<button class="btn-sec" style="background:#fef2f2;color:var(--danger);border-color:#fecaca" onclick="deleteCustomQ(${q.id})">🗑 删除</button>`:''}
      <button class="btn-sec" onclick="navPractice(1)" ${st.practiceIdx>=pool.length-1?'disabled':''}>下一题 ▶</button>
    </div></div>`;
  } else {
    // Learner: refresh data from localStorage (manager may have approved)
    const learnerPfx=pfx();
    st.unlocked=new Set(JSON.parse(localStorage.getItem(learnerPfx+'unlocked')||'[]'));
    st.pendingRequests=JSON.parse(localStorage.getItem(learnerPfx+'pending_reqs')||'[]');
    st.questionPasswords=JSON.parse(localStorage.getItem(learnerPfx+'passwords')||'{}');

    dom.practiceDrawBtn.style.display='';
    dom.practiceResetBtn.style.display='';
    dom.practicePlanCount.parentElement.parentElement.style.display='';
    const pool=getCurrentPool();
    dom.practicePoolCount.textContent=pool.length;
    dom.practiceDrawnCount.textContent=st.practiceDrawn.length;
    const drawn=st.practiceDrawn.map(id=>pool.find(q=>q.id===id)).filter(Boolean);
    if(!drawn.length){dom.practiceDrawn.classList.add('hidden');dom.practiceEmpty.classList.remove('hidden');dom.practiceEmpty.innerHTML='<div class="empty-icon">🎯</div><h3>今日尚未抽题</h3><p>选择科目后点击抽题</p>';return;}
    dom.practiceEmpty.classList.add('hidden');dom.practiceDrawn.classList.remove('hidden');
    if(st.practiceIdx>=drawn.length)st.practiceIdx=0;
    const q=drawn[st.practiceIdx];const isU=st.unlocked.has(q.id);
    const isPending=st.pendingRequests&&st.pendingRequests.includes(q.id);
    dom.practiceContainer.innerHTML=`<div class="question-card"><div class="q-card-header"><span class="q-card-title">${q.title||''}（${q.score||36}分）</span><span class="q-card-position">${st.practiceIdx+1}/${drawn.length}</span></div><div class="q-card-badges"><span class="badge subj">${q.subject}</span><span class="badge type">${q.type}</span><span class="badge score">${q.score||36}分</span>${isU?'<span class="badge unlocked">✓ 已解锁</span>':isPending?'<span class="badge" style="background:#fef3c7;color:#92400e">⏳ 已申请</span>':''}</div>
    <div class="q-card-section"><h4>📋 案情</h4><div class="content-text">${q.case?fmtPara(q.case):'(无)'}</div></div>
    <div class="q-card-section"><h4>❓ 问题</h4><div class="content-text">${esc(q.problems||'')}</div></div>
    <div class="q-card-section"><h4>🔒 参考答案</h4>
    ${isU?`<div class="content-text ans-text">${esc(q.answer||'暂无')}</div>`
    :isPending?`<div class="ans-locked" style="background:#fef3c7;border-color:#fbbf24"><p>⏳ 已向督学提交申请，等待批准</p></div>`
    :`<div class="ans-locked"><p>完成作答后点击下方按钮申请查看答案</p><button class="btn-primary request-btn">📩 向督学申请答案</button></div>`}
    </div><div class="q-card-nav"><button class="btn-sec" onclick="navPractice(-1)" ${st.practiceIdx===0?'disabled':''}>◀ 上一题</button><button class="btn-sec" onclick="navPractice(1)" ${st.practiceIdx>=drawn.length-1?'disabled':''}>下一题 ▶</button></div></div>`;
    dom.practiceContainer.querySelector('.request-btn')?.addEventListener('click',()=>{
      if(!st.pendingRequests)st.pendingRequests=[];
      st.pendingRequests.push(q.id);
      localStorage.setItem(pfx()+'pending_reqs',JSON.stringify(st.pendingRequests));
      renderPractice();
      alert('✅ 已向督学提交申请，请等待批准');
    });
  }
}

window.navPractice=function(d){st.practiceIdx+=d;renderPractice();};
window.navProv=function(d){st.provisionIdx+=d;renderProvision();};

// ===== EDIT SYSTEM =====
let editingQId=null;
window.editQuestion=function(id){
  const pool=getEffectivePool();
  const q=pool.find(x=>x.id===id);
  if(!q){alert('题目不存在');return;}
  editingQId=id;
  // Open editor panel
  dom.editorBody.classList.remove('hidden');
  dom.editorSubject.value=q.subject;
  dom.editorType.value=q.type;
  dom.editorTitle.value=q.title||'';
  dom.editorCase.value=q.case||'';
  dom.editorProblems.value=q.problems||'';
  dom.editorAnswer.value=q.answer||'';
  dom.editorStatus.textContent=`✏️ 正在编辑 ID=${id}「${q.title||''}」`;
  dom.editorStatus.className='editor-msg';
  dom.editorBody.scrollIntoView({behavior:'smooth'});
};
window.deleteCustomQ=function(id){
  if(!confirm('确认删除此题？不可恢复'))return;
  let qs=getAdminQuestions();
  const idx=qs.findIndex(q=>q.id===id-10000||(qs.indexOf(q)+10000)===id);
  // Find by matching
  const customIdx=id-10000;
  if(customIdx>=0&&customIdx<qs.length){
    qs.splice(customIdx,1);
    saveAdminQuestions(qs);
    renderPractice();renderStats();
  }
};

function saveEditorQuestion(){
  const sb=dom.editorSubject.value;const tp=dom.editorType.value;
  const title=dom.editorTitle.value.trim();const c=dom.editorCase.value.trim();
  const p=dom.editorProblems.value.trim();const a=dom.editorAnswer.value.trim();
  if(!p){dom.editorStatus.textContent='❌ 问题不能为空';dom.editorStatus.className='editor-msg err';return;}
  if(!a){dom.editorStatus.textContent='❌ 答案不能为空';dom.editorStatus.className='editor-msg err';return;}

  if(editingQId!==null){
    // Edit existing question
    const overrides=getQuestionOverrides();
    overrides[editingQId]={subject:sb,type:tp,title:title||'自定义题',score:36,case:c,problems:p,answer:a};
    saveQuestionOverrides(overrides);
    dom.editorStatus.textContent=`✅ 已更新 ID=${editingQId}`;
  } else {
    // Add new question
    const qs=getAdminQuestions();
    qs.push({id:Date.now(),subject:sb,type:tp,title:title||'自定义题',score:36,case:c,problems:p,answer:a});
    saveAdminQuestions(qs);
    dom.editorStatus.textContent=`✅ 已添加（${sb}·${tp}）`;
  }
  dom.editorStatus.className='editor-msg ok';
  editingQId=null;
  dom.editorTitle.value='';dom.editorCase.value='';dom.editorProblems.value='';dom.editorAnswer.value='';
  renderPractice();renderStats();
}

function renderProvision(){const pool=provisionData;const drawn=st.provisionDrawn.map(id=>pool.find(q=>q.id===id)).filter(Boolean);dom.provisionPoolCount.textContent=pool.length;dom.provisionDrawnCount.textContent=st.provisionDrawn.length;if(!drawn.length){dom.provisionDrawn.classList.add('hidden');dom.provisionEmpty.classList.remove('hidden');return;}dom.provisionEmpty.classList.add('hidden');dom.provisionDrawn.classList.remove('hidden');if(st.provisionIdx>=drawn.length)st.provisionIdx=0;const q=drawn[st.provisionIdx];const iU=st.unlocked.has(q.id);const iM=st.tenant==='manager';dom.provisionContainer.innerHTML=`<div class="question-card"><div class="q-card-header"><span class="q-card-title">法条定位${iM?' <span style="font-size:.75rem;color:var(--text-secondary)">👤 预览</span>':''}</span><span class="q-card-position">${st.provisionIdx+1}/${drawn.length}</span></div><div class="q-card-section"><h4>❓ 问题</h4><div class="content-text" style="font-size:1rem">${esc(q.q)}</div></div><div class="q-card-section"><h4>📖 答案</h4>${iU?`<div class="content-text ans-text">${esc(q.a)}</div>`:iM?`<div class="content-text ans-text" style="background:#f0f0f0">${esc(q.a)}</div>`:`<div class="ans-locked"><p>完成作答后向督学申请答案</p></div>`}</div><div class="q-card-nav"><button class="btn-sec" onclick="navProv(-1)" ${st.provisionIdx===0?'disabled':''}>◀ 上一题</button><button class="btn-sec" onclick="navProv(1)" ${st.provisionIdx>=drawn.length-1?'disabled':''}>下一题 ▶</button></div></div>`;}

function renderRecite(){const s=dom.reciteSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法';const n=new Date();const w=['日','一','二','三','四','五','六'];dom.todayDate.textContent=`${n.getFullYear()}年${String(n.getMonth()+1).padStart(2,'0')}月${String(n.getDate()).padStart(2,'0')}日 星期${w[n.getDay()]}`;dom.reciteText.innerHTML=`<p>待督学发布${s}背诵内容...</p>`;}
const vD={'刑法':[{n:'柏浪涛 刑法主观题',s:'柏神10题'}],'刑诉':[{n:'左宁 刑诉法',s:'法条定位40题'}],'民法':[{n:'待添加',s:''}],'民诉':[{n:'待添加',s:''}],'理论法':[{n:'待添加',s:''}],'行政法':[{n:'李佳 行政法',s:'每日一题24题'}]};
function renderVideos(){const s=dom.videoSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法';dom.videoGrid.innerHTML=(vD[s]||[]).map(v=>`<div class="resource-card"><div class="rsc-icon">🎬</div><h3>${v.n}</h3><p>${v.s}</p><span class="rsc-status ${v.s?'loaded':'pending'}">${v.s?'✓ 已加载':'待上传'}</span></div>`).join('');}
const mD={'刑法':[{n:'柏浪涛 刑法攻略',l:1},{n:'柏神主观10题',l:1}],'刑诉':[{n:'左宁 刑诉法',l:1}],'行政法':[{n:'李佳 行政法',l:1}],'民法':[{n:'待添加'}],'民诉':[{n:'待添加'}],'理论法':[{n:'待添加'}]};
function renderMaterials(){const s=dom.materialSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法';dom.materialGrid.innerHTML=(mD[s]||[]).map(v=>`<div class="resource-card${v.l?' loaded':''}"><div class="rsc-icon">${v.l?'📗':'📕'}</div><h3>${v.n}</h3><p>${v.l?'已加载':'待上传'}</p><span class="rsc-status ${v.l?'loaded':'pending'}">${v.l?'✓ 已加载':'待上传'}</span></div>`).join('');}

// ============ ADMIN PAGE ============
function showAdminPage(){
  dom.adminViewStudent.textContent=st.studentId||'管理者';
  // Passwords for current session's student
  const allPool=getEffectivePool();
  const pq=st.practiceDrawn.map(id=>allPool.find(q=>q.id===id)).filter(Boolean);
  dom.adminPracticePasswords.innerHTML=pq.length?pq.map(q=>`<div class="pwd-row"><span>${q.title||'题'}（${q.subject}·${q.type}）</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">今日未抽题</p>';
  const pv=st.provisionDrawn.map(id=>provisionData.find(q=>q.id===id)).filter(Boolean);
  dom.adminProvisionPasswords.innerHTML=pv.length?pv.map(q=>`<div class="pwd-row"><span>法条定位题</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">今日未抽题</p>';
  dom.adminManagerPwd.value=localStorage.getItem('fk_mgr_pwd')||DEFAULT_MGR_PWD;
  renderStudentList();renderStats();renderPendingRequests();
}

function renderStudentList(){
  const ss=getStudents();
  dom.adminStudentList.innerHTML=!ss.length?'<p class="empty-hint">暂无学生账号</p>':ss.map(s=>{
    const p='fk_'+s.id+'_';const pd=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
    const pvd=JSON.parse(localStorage.getItem(p+'provision_drawn')||'[]');const ul=JSON.parse(localStorage.getItem(p+'unlocked')||'[]');
    const reqs=JSON.parse(localStorage.getItem(p+'pending_reqs')||'[]');
    return `<div class="student-row view-student" data-sid="${s.id}">
    <div class="student-info"><strong>${s.id}</strong><span class="student-meta">密码 ${s.pwd}</span><span class="student-meta">抽${pd.length+pvd.length} 解${ul.length}</span>${reqs.length?`<span class="student-meta" style="color:var(--accent);font-weight:600">待批 ${reqs.length}</span>`:''}</div>
    <button class="btn-sec btn-sm" onclick="viewStudentStats('${s.id}')">📋 查看</button>
    <button class="btn-sec btn-sm del-student" data-id="${s.id}">删除</button></div>`;
  }).join('');
  dom.adminStudentList.querySelectorAll('.del-student').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();if(!confirm('删除 '+b.dataset.id+'？'))return;let ss=getStudents();saveStudents(ss.filter(s=>s.id!==b.dataset.id));renderStudentList();}));
  dom.adminStudentList.querySelectorAll('.view-student').forEach(r=>r.addEventListener('click',()=>viewStudentStats(r.dataset.sid)));
}

function viewStudentStats(id){
  const p='fk_'+id+'_';const pd=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
  const pvd=JSON.parse(localStorage.getItem(p+'provision_drawn')||'[]');
  dom.adminViewStudent.textContent=id;
  const pi=pd.map(id=>questionsData.find(q=>q.id===id)).filter(Boolean);
  dom.adminPracticePasswords.innerHTML=pi.length?pi.map(q=>`<div class="pwd-row"><span>${q.title||'题'}（${q.subject}）</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">无</p>';
  const pvi=pvd.map(id=>provisionData.find(q=>q.id===id)).filter(Boolean);
  dom.adminProvisionPasswords.innerHTML=pvi.length?pvi.map(q=>`<div class="pwd-row"><span>法条定位题</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">无</p>';
}

function renderPendingRequests(){
  const students=getStudents();
  let html='';
  let totalPending=0;
  students.forEach(s=>{
    const reqs=getRequests(s.id);
    if(!reqs.length)return;
    totalPending+=reqs.length;
    html+=`<div class="pending-group"><strong>${s.id}</strong>（${reqs.length}个待批）</div>`;
    reqs.forEach(qId=>{
      const pool=getEffectivePool();
      const q=pool.find(x=>x.id===qId);
      html+=`<div class="pwd-row"><span>${q?q.title+'（'+q.subject+'）':'题ID:'+qId}</span>
      <button class="btn-primary btn-sm" onclick="approveRequest('${s.id}',${qId})">✅ 批准</button>
      <button class="btn-sec btn-sm" onclick="denyRequest('${s.id}',${qId})">❌ 拒绝</button></div>`;
    });
  });
  if(!totalPending){html='<p class="empty-hint">暂无待批准的请求</p>';}
  else{html=`<p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:8px">共 ${totalPending} 个待处理请求</p>`+html;}
  dom.adminPendingRequests.innerHTML=html;
  dom.adminPendingCount.textContent=totalPending;
}

window.approveRequest=function(sid,qId){
  const p='fk_'+sid+'_';
  // Generate password for this question for this student
  // Force generate by accessing
  const pwd=genPwd();
  let passwords=JSON.parse(localStorage.getItem(p+'passwords')||'{}');
  passwords[qId]=pwd;
  localStorage.setItem(p+'passwords',JSON.stringify(passwords));
  // Add to unlocked
  let unlocked=new Set(JSON.parse(localStorage.getItem(p+'unlocked')||'[]'));
  unlocked.add(qId);
  localStorage.setItem(p+'unlocked',JSON.stringify([...unlocked]));
  // Remove from pending
  let reqs=getRequests(sid);
  reqs=reqs.filter(r=>r!==qId);
  saveRequests(sid,reqs);
  renderPendingRequests();
  renderStudentList();
  alert(`✅ 已批准！密码：${pwd}\n（学生端将自动解锁此题答案）`);
};

window.denyRequest=function(sid,qId){
  let reqs=getRequests(sid);
  reqs=reqs.filter(r=>r!==qId);
  saveRequests(sid,reqs);
  renderPendingRequests();
  renderStudentList();
};

function renderStats(){
  const adminQs=getAdminQuestions();const overrides=getQuestionOverrides();
  const cols=['模拟题','真题','每日练习'];
  let html='<div class="stats-table-wrap"><table class="stats-table"><tr><th>科目</th>';
  cols.forEach(t=>html+=`<th>${t}</th>`);html+='<th>合计</th><th>已修改</th></tr>';
  SUBJ_TABS.forEach(tab=>{
    const ds=SUBJ_MAP[tab];html+=`<tr><td>${tab}</td>`;let total=0;let mod=0;
    cols.forEach(type=>{
      const def=questionsData.filter(q=>q.subject===ds&&q.type===type).length;
      const cust=adminQs.filter(q=>q.subject===ds&&q.type===type).length;const sum=def+cust;total+=sum;
      html+=`<td>${sum}${cust?`<span class="cust-badge">+${cust}</span>`:''}</td>`;
    });
    // Count overrides
    const overrideCount=Object.keys(overrides).filter(k=>{
      const q=[...questionsData,...adminQs].find(x=>x.id==k||x.id==k-10000);
      return q&&q.subject===ds;
    }).length;
    mod+=overrideCount;
    html+=`<td><strong>${total}</strong></td><td>${mod?`<span class="cust-badge">${mod}</span>`:'0'}</td></tr>`;
  });
  html+='</table></div>';

  const students=getStudents();
  html+='<h4 style="margin:12px 0 6px">📊 学生进度</h4>';
  if(!students.length)html+='<p class="empty-hint">暂无学生</p>';
  else{
    html+='<div class="stats-table-wrap"><table class="stats-table"><tr><th>学生</th>';
    SUBJ_TABS.forEach(t=>html+=`<th>${t}</th>`);
    html+='<th>总进度</th></tr>';
    students.forEach(s=>{
      const p='fk_'+s.id+'_';const pd=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
      html+=`<tr><td>${s.id}</td>`;let tA=0,dA=0;
      SUBJ_TABS.forEach(tab=>{
        const ds=SUBJ_MAP[tab];const tt=questionsData.filter(q=>q.subject===ds).length+adminQs.filter(q=>q.subject===ds).length;
        const done=pd.filter(id=>{const qq=[...questionsData,...adminQs].find(x=>x.id===id);return qq&&qq.subject===ds;}).length;
        tA+=tt;dA+=done;html+=`<td>${done}/${tt}</td>`;
      });
      html+=`<td><strong>${dA}/${tA}</strong> (${tA>0?Math.round(dA/tA*100):0}%)</td></tr>`;
    });
    html+='</table></div>';
  }

  if(adminQs.length){
    html+=`<h4 style="margin:12px 0 6px">📝 自定义 (${adminQs.length}题)</h4><div class="stats-table-wrap"><table class="stats-table"><tr><th>科目</th><th>题型</th><th>标题</th><th>操作</th></tr>`;
    adminQs.forEach((q,i)=>{const tab=REV_SUBJ[q.subject]||q.subject;html+=`<tr><td>${tab}</td><td>${q.type}</td><td>${q.title||'未命名'}</td><td><button class="btn-sec btn-sm" onclick="editQuestion(${10000+i})">✏️</button></td></tr>`;});
    html+='</table></div>';
  }

  dom.statsContent.innerHTML=html;
}

// ============ PUBLISH ============
function publishAndExport(){
  const qs=getAdminQuestions();const v=Date.now();
  localStorage.setItem('fk_published_data',JSON.stringify({version:v,questions:qs}));
  localStorage.setItem('fk_published_version',String(v));
  localStorage.setItem('fk_update_msg',`自定义题库已更新（${qs.length}题）`);
  const blob=new Blob([`const adminCustomData = ${JSON.stringify(qs,null,2)};`],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='admin-questions.js';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  alert(`✅ 已发布！已下载 admin-questions.js`);
}

// ============ UTILITIES ============
function esc(t){const d=document.createElement('div');d.textContent=t||'';return d.innerHTML;}
function fmtPara(t){return(t||'').split(/\n\n+/).filter(p=>p.trim()).map(p=>`<p class="pi">${esc(p.trim().replace(/\n/g,' '))}</p>`).join('');}
function switchModule(n){$$('.module').forEach(m=>m.classList.toggle('active',m.id==='module-'+n));$$('.nav-btn[data-module]').forEach(b=>b.classList.toggle('active',b.dataset.module===n));dom.navLinks.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});}

// ============ EVENTS ============
function bindEvents(){
  dom.loginLearner.addEventListener('click',switchToStudentLogin);
  dom.loginManager.addEventListener('click',()=>{dom.managerPwdArea.classList.remove('hidden');dom.managerPwdInput.focus();});
  dom.managerPwdConfirm.addEventListener('click',()=>{const p=dom.managerPwdInput.value.trim();const c=localStorage.getItem('fk_mgr_pwd')||DEFAULT_MGR_PWD;if(p===c){doLogin('manager');dom.managerPwdArea.classList.add('hidden');dom.managerPwdInput.value='';}else{dom.loginError.classList.remove('hidden');dom.managerPwdInput.value='';dom.managerPwdInput.focus();}});
  dom.managerPwdInput.addEventListener('keydown',e=>{if(e.key==='Enter')dom.managerPwdConfirm.click();if(e.key==='Escape'){dom.managerPwdArea.classList.add('hidden');dom.managerPwdInput.value='';}});
  dom.studentLoginConfirm.addEventListener('click',()=>{const sid=dom.studentIdInput.value.trim();const pwd=dom.studentPwdInput.value.trim();if(!sid){dom.studentLoginError.textContent='输入学生ID';dom.studentLoginError.classList.remove('hidden');return;}const ss=getStudents();const f=ss.find(s=>s.id===sid);if(!f){dom.studentLoginError.textContent='ID不存在';dom.studentLoginError.classList.remove('hidden');return;}if(f.pwd!==pwd){dom.studentLoginError.textContent='密码错误';dom.studentLoginError.classList.remove('hidden');return;}dom.studentLoginError.classList.add('hidden');doLogin(sid);});
  dom.studentIdInput.addEventListener('keydown',e=>{if(e.key==='Enter')dom.studentPwdInput.focus();});
  dom.studentPwdInput.addEventListener('keydown',e=>{if(e.key==='Enter')dom.studentLoginConfirm.click();});
  dom.feedbackSubjects.addEventListener('click',e=>{const c=e.target.closest('.chip');if(c)c.classList.toggle('active');});
  dom.feedbackPhases.addEventListener('click',e=>{const c=e.target.closest('.chip');if(c){dom.feedbackPhases.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');}});
  dom.feedbackConfirm.addEventListener('click',confirmFeedback);
  dom.navLinks.addEventListener('click',e=>{
    const b=e.target.closest('.nav-btn[data-module]');if(!b)return;
    if(b.dataset.module==='admin'){if(st.tenant!=='manager'){alert('请以管理者身份登录');return;}showAdminPage();switchModule('admin');return;}
    switchModule(b.dataset.module);
  });
  dom.hamburgerBtn.addEventListener('click',()=>dom.navLinks.classList.toggle('open'));
  dom.loginSwitch.addEventListener('click',()=>{st=freshState(null);document.querySelectorAll('.fullscreen-overlay').forEach(o=>o.classList.add('hidden'));dom.loginLearner.classList.remove('hidden');dom.loginManager.classList.remove('hidden');dom.studentLoginArea.classList.add('hidden');dom.managerPwdArea.classList.add('hidden');dom.loginError.classList.add('hidden');dom.studentLoginError.classList.add('hidden');dom.studentIdInput.value='';dom.studentPwdInput.value='';showLogin();});

  document.querySelectorAll('.tabs-bar').forEach(bar=>{
    bar.addEventListener('click',e=>{
      const btn=e.target.closest('.tab-btn');if(!btn)return;
      const siblings=bar.querySelectorAll('.tab-btn');
      const ac=[...siblings].filter(s=>s.classList.contains('active')).length;
      if(btn.classList.contains('active')&&ac<=1)return;
      btn.classList.toggle('active');
      const id=bar.id;
      if(id==='practiceSubjectTabs'||id==='practiceTypeTabs')renderPractice();
      else if(id==='reciteSubjectTabs')renderRecite();
      else if(id==='videoSubjectTabs')renderVideos();
      else if(id==='materialSubjectTabs')renderMaterials();
    });
  });

  dom.practiceDrawBtn.addEventListener('click',()=>{
    if(st.tenant==='manager')return;
    drawFrom(getCurrentPool(),st.practiceDrawn,Math.max(1,parseInt(dom.practicePlanCount.value)||1));
    st.practiceIdx=st.practiceDrawn.length-1;renderPractice();
  });
  dom.practiceResetBtn.addEventListener('click',()=>{if(st.tenant==='manager')return;if(!confirm('重置今日抽题？'))return;st.practiceDrawn=[];st.practiceIdx=0;saveLS();renderPractice();});
  dom.provisionDrawBtn.addEventListener('click',()=>{if(st.tenant==='manager'){alert('管理者不记录抽题');return;}drawFrom(provisionData,st.provisionDrawn,Math.max(1,parseInt(dom.provisionPlanCount.value)||1));st.provisionIdx=st.provisionDrawn.length-1;renderProvision();});
  dom.provisionResetBtn.addEventListener('click',()=>{if(st.tenant==='manager'){alert('管理者无抽题数据');return;}if(!confirm('重置今日法条定位？'))return;st.provisionDrawn=[];st.provisionIdx=0;saveLS();renderProvision();});
  dom.adminSaveManagerPwd.addEventListener('click',()=>{const p=dom.adminManagerPwd.value.trim();if(p.length<4){alert('至少4位');return;}localStorage.setItem('fk_mgr_pwd',p);alert('已更新');});
  dom.adminAddStudentBtn.addEventListener('click',()=>{const r=dom.adminNewStudentId.value.trim();if(!r){alert('输入ID');return;}const ss=getStudents();if(ss.find(s=>s.id===r)){alert('已存在');return;}const p=genPwd();ss.push({id:r,pwd:p,created:new Date().toISOString()});saveStudents(ss);dom.adminNewStudentId.value='';renderStudentList();alert(`学生 ${r} 创建成功！密码：${p}`);});
  dom.adminNewStudentId.addEventListener('keydown',e=>{if(e.key==='Enter')dom.adminAddStudentBtn.click();});
  dom.editorSaveBtn.addEventListener('click',saveEditorQuestion);
  dom.publishBtn.addEventListener('click',publishAndExport);
  dom.editorToggle.addEventListener('click',()=>dom.editorBody.classList.toggle('hidden'));
  document.addEventListener('click',e=>{if(dom.navLinks.classList.contains('open')&&!dom.navLinks.contains(e.target)&&!dom.hamburgerBtn.contains(e.target))dom.navLinks.classList.remove('open');});
}

function drawFrom(pool,already,n){const avail=pool.filter(q=>!already.includes(q.id));if(!avail.length){alert('无可抽取的题目');return null;}const cnt=Math.min(n,avail.length);const shuf=[...avail];for(let i=shuf.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuf[i],shuf[j]]=[shuf[j],shuf[i]];}const ids=shuf.slice(0,cnt).map(q=>q.id);ids.forEach(id=>getPwdFor(id));already.push(...ids);saveLS();return already;}

function init(){initDom();bindEvents();showLogin();}
document.addEventListener('DOMContentLoaded',init);

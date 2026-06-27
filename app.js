/**
 * 法考主观题督学系统 v7
 * - 五大模块管理者与学习者界面统一
 * - 管理后台为覆盖层（不占模块位）
 * - 刷题科目/题型可多选
 * - 统计表不含民事大综合列
 * - 管理者在每个模块有添加内容入口
 */

const DEFAULT_MGR_PWD = '3223';
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const SUBJ_MAP = {'刑法':'刑法','民法':'民法','民诉':'民事诉讼法','刑诉':'刑诉法','行政法':'行政法与行政诉讼法','理论法':'理论法','民事大综合':'民事大综合'};
const REV_SUBJ = {}; Object.entries(SUBJ_MAP).forEach(([k,v])=>REV_SUBJ[v]=k);
const TYPES = ['模拟题','真题','每日练习'];
const SUBJ_TABS = ['刑法','民法','民诉','刑诉','行政法','理论法','民事大综合'];

let st = {};
function freshState(t){return{tenant:t,role:t==='manager'?'manager':'learner',studentId:t==='manager'?null:t,subjects:[],phase:'',practiceDrawn:[],provisionDrawn:[],practiceIdx:0,provisionIdx:0,unlocked:new Set(),questionPasswords:{}};}
function pfx(){return st.tenant?'fk_'+st.tenant+'_':'fk_';}
function saveLS(){try{const p=pfx();localStorage.setItem(p+'practice_drawn',JSON.stringify(st.practiceDrawn));localStorage.setItem(p+'provision_drawn',JSON.stringify(st.provisionDrawn));localStorage.setItem(p+'practice_date',todayKey());localStorage.setItem(p+'provision_date',todayKey());localStorage.setItem(p+'unlocked',JSON.stringify([...st.unlocked]));localStorage.setItem(p+'passwords',JSON.stringify(st.questionPasswords));if(st.role==='learner'){localStorage.setItem(p+'subjects',JSON.stringify(st.subjects));localStorage.setItem(p+'phase',st.phase);localStorage.setItem(p+'fb_date',todayKey());}}catch{}}
function loadState(t){st=freshState(t);try{const p=pfx();if(isToday(p+'practice_drawn'))st.practiceDrawn=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');if(isToday(p+'provision_drawn'))st.provisionDrawn=JSON.parse(localStorage.getItem(p+'provision_drawn')||'[]');st.unlocked=new Set(JSON.parse(localStorage.getItem(p+'unlocked')||'[]'));st.questionPasswords=JSON.parse(localStorage.getItem(p+'passwords')||'{}');if(st.role==='learner'){st.subjects=JSON.parse(localStorage.getItem(p+'subjects')||'[]');st.phase=localStorage.getItem(p+'phase')||'';}}catch{}}
function todayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function isToday(k){return localStorage.getItem(k)===todayKey();}
function getStudents(){try{return JSON.parse(localStorage.getItem('fk_students')||'[]');}catch{return[];}}
function saveStudents(s){localStorage.setItem('fk_students',JSON.stringify(s));}
function getAdminQuestions(){try{return JSON.parse(localStorage.getItem('fk_admin_questions')||'[]');}catch{return[];}}
function saveAdminQuestions(qs){localStorage.setItem('fk_admin_questions',JSON.stringify(qs));}
function getAllPool(){const def=[...questionsData];const cust=getAdminQuestions().map((q,i)=>({...q,id:10000+i}));return[...def,...cust];}
function getPool(subjs,types,noTypeList){let pool=getAllPool();if(subjs.length)pool=pool.filter(q=>subjs.includes(q.subject));if(!noTypeList&&types.length)pool=pool.filter(q=>types.includes(q.type));return pool;}
function genPwd(){return String(Math.floor(1000+Math.random()*9000));}
function getPwdFor(id){if(!st.questionPasswords[id]){st.questionPasswords[id]=genPwd();saveLS();}return st.questionPasswords[id];}

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
'publishBtn','adminOverlay','adminClose','adminTabs',
'adminNewStudentId','adminAddStudentBtn','adminStudentList',
'adminManagerPwd','adminSaveManagerPwd','adminViewStudent',
'adminPracticePasswords','adminProvisionPasswords','statsContent'].forEach(id=>dom[id]=$(id));}

// ============ LOGIN ============
function showLogin(){dom.loginOverlay.classList.remove('hidden');st=freshState(null);}
function hideLogin(){dom.loginOverlay.classList.add('hidden');}
function switchToStudentLogin(){dom.loginLearner.classList.add('hidden');dom.loginManager.classList.add('hidden');dom.studentLoginArea.classList.remove('hidden');dom.studentIdInput.focus();}
function doLogin(t){loadState(t);hideLogin();const m=t==='manager';dom.adminToggle.classList.toggle('hidden',!m);dom.navSep.classList.toggle('hidden',!m);dom.loginSwitch.textContent=m?'🔒 退出管理':'🔄 切换身份';if(st.role==='learner')showFeedbackIfNeeded();renderAll();}
function showFeedbackIfNeeded(){const p=pfx();if(localStorage.getItem(p+'fb_date')!==todayKey()||!st.subjects.length){dom.feedbackOverlay.classList.remove('hidden');dom.feedbackSubjects.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',st.subjects.includes(c.dataset.subj)));dom.feedbackPhases.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c.dataset.phase===st.phase));}}
function confirmFeedback(){const sel=[...dom.feedbackSubjects.querySelectorAll('.chip.active')].map(c=>c.dataset.subj);const pe=dom.feedbackPhases.querySelector('.chip.active');if(!sel.length||!pe){alert('请选择科目和阶段');return;}st.subjects=sel;st.phase=pe.dataset.phase;saveLS();dom.feedbackOverlay.classList.add('hidden');}

// ============ DRAW ============
function drawFrom(pool,already,n){const avail=pool.filter(q=>!already.includes(q.id));if(!avail.length){alert('当前筛选范围内没有可抽取的题目');return null;}const cnt=Math.min(n,avail.length);const shuf=[...avail];for(let i=shuf.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuf[i],shuf[j]]=[shuf[j],shuf[i]];}const ids=shuf.slice(0,cnt).map(q=>q.id);ids.forEach(id=>getPwdFor(id));already.push(...ids);saveLS();return already;}

// ============ GET SELECTED ============
function getSelectedSubjs(){return [...dom.practiceSubjectTabs.querySelectorAll('.tab-btn.active')].map(b=>{const ds=SUBJ_MAP[b.dataset.subj]||b.dataset.subj;return ds;});}
function getSelectedTypes(){return [...dom.practiceTypeTabs.querySelectorAll('.tab-btn.active')].map(b=>b.dataset.type);}
function getCurrentPool(){const ss=getSelectedSubjs();const ts=getSelectedTypes();const noType=ss.includes('民事大综合');return getPool(ss,ts,noType);}

// ============ RENDER ============
function renderAll(){renderPractice();renderProvision();renderRecite();renderVideos();renderMaterials();}

function renderPractice(){
  // Editor panel visibility for manager
  dom.editorPanel.classList.toggle('hidden',st.tenant!=='manager');
  // Type tabs: hide if 民事大综合 is among selected subjects
  const hasDZ=!![...dom.practiceSubjectTabs.querySelectorAll('.tab-btn.active')].find(b=>b.dataset.subj==='民事大综合');
  dom.practiceTypeTabs.style.display=hasDZ?'none':'flex';

  const pool=getCurrentPool();
  dom.practicePoolCount.textContent=pool.length;
  dom.practiceDrawnCount.textContent=st.practiceDrawn.length;
  const drawn=st.practiceDrawn.map(id=>pool.find(q=>q.id===id)).filter(Boolean);
  if(!drawn.length){dom.practiceDrawn.classList.add('hidden');dom.practiceEmpty.classList.remove('hidden');return;}
  dom.practiceEmpty.classList.add('hidden');dom.practiceDrawn.classList.remove('hidden');
  if(st.practiceIdx>=drawn.length)st.practiceIdx=0;
  const q=drawn[st.practiceIdx];const isM=st.tenant==='manager';const isU=st.unlocked.has(q.id);
  const ttl=q.title||'';const sc=q.score||36;
  const cust=q.id>=10000?'<span class="badge" style="background:#fce7f3;color:#9d174d">📝 自定义</span>':'';
  dom.practiceContainer.innerHTML=`<div class="question-card"><div class="q-card-header"><span class="q-card-title">${ttl}（${sc}分）${isM?'<span style="font-size:.75rem;color:var(--text-secondary);margin-left:8px">👤 管理者预览</span>':''}</span><span class="q-card-position">${st.practiceIdx+1}/${drawn.length}</span></div><div class="q-card-badges"><span class="badge subj">${q.subject}</span><span class="badge type">${q.type}</span><span class="badge score">${sc}分</span>${cust}${isU?'<span class="badge unlocked">✓ 已解锁</span>':''}</div><div class="q-card-section"><h4>📋 案情</h4><div class="content-text">${q.case?fmtPara(q.case):'(无)'}</div></div><div class="q-card-section"><h4>❓ 问题</h4><div class="content-text">${esc(q.problems||'')}</div></div><div class="q-card-section ans-section"><h4>🔒 参考答案</h4>${isU?`<div class="content-text ans-text">${esc(q.answer||'暂无')}</div>`:isM?`<div class="content-text ans-text" style="background:#f0f0f0;border-color:#ccc">${esc((q.answer||'').substring(0,300))}${(q.answer||'').length>300?'...':''}</div>`:`<div class="ans-locked"><p>完成作答后索要密码</p><button class="btn-primary unlock-btn">🔑 输入密码</button></div>`}</div><div class="q-card-nav"><button class="btn-sec" onclick="navPractice(-1)" ${st.practiceIdx===0?'disabled':''}>◀ 上一题</button><button class="btn-sec" onclick="navPractice(1)" ${st.practiceIdx>=drawn.length-1?'disabled':''}>下一题 ▶</button></div></div>`;
  dom.practiceContainer.querySelector('.unlock-btn')?.addEventListener('click',()=>showAnswerPwd(q.id));
  // Hint text
  const selSubjs=getSelectedSubjs();const selTypes=getSelectedTypes();
  dom.selectHint.textContent=`💡 已选 ${selSubjs.length} 个科目、${selTypes.length} 个题型，题库共 ${pool.length} 题`;
}

function renderProvision(){const pool=provisionData;const drawn=st.provisionDrawn.map(id=>pool.find(q=>q.id===id)).filter(Boolean);dom.provisionPoolCount.textContent=pool.length;dom.provisionDrawnCount.textContent=st.provisionDrawn.length;if(!drawn.length){dom.provisionDrawn.classList.add('hidden');dom.provisionEmpty.classList.remove('hidden');return;}dom.provisionEmpty.classList.add('hidden');dom.provisionDrawn.classList.remove('hidden');if(st.provisionIdx>=drawn.length)st.provisionIdx=0;const q=drawn[st.provisionIdx];const iU=st.unlocked.has(q.id);const iM=st.tenant==='manager';dom.provisionContainer.innerHTML=`<div class="question-card"><div class="q-card-header"><span class="q-card-title">法条定位${iM?' <span style="font-size:.75rem;color:var(--text-secondary)">👤 预览</span>':''}</span><span class="q-card-position">${st.provisionIdx+1}/${drawn.length}</span></div><div class="q-card-section"><h4>❓ 问题</h4><div class="content-text" style="font-size:1rem">${esc(q.q)}</div></div><div class="q-card-section ans-section"><h4>📖 答案</h4>${iU?`<div class="content-text ans-text">${esc(q.a)}</div>`:iM?`<div class="content-text ans-text" style="background:#f0f0f0">${esc(q.a)}</div>`:`<div class="ans-locked"><p>完成作答后索要密码</p><button class="btn-primary unlock-btn">🔑 输入密码</button></div>`}</div><div class="q-card-nav"><button class="btn-sec" onclick="navProv(-1)" ${st.provisionIdx===0?'disabled':''}>◀ 上一题</button><button class="btn-sec" onclick="navProv(1)" ${st.provisionIdx>=drawn.length-1?'disabled':''}>下一题 ▶</button></div></div>`;dom.provisionContainer.querySelector('.unlock-btn')?.addEventListener('click',()=>showAnswerPwd(q.id));}
window.navPractice=function(d){st.practiceIdx+=d;renderPractice();};
window.navProv=function(d){st.provisionIdx+=d;renderProvision();};

function renderRecite(){const s=dom.reciteSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法';const n=new Date();const w=['日','一','二','三','四','五','六'];dom.todayDate.textContent=`${n.getFullYear()}年${String(n.getMonth()+1).padStart(2,'0')}月${String(n.getDate()).padStart(2,'0')}日 星期${w[n.getDay()]}`;dom.reciteText.innerHTML=`<p>待督学发布${s}背诵内容...</p>`;}
const vD={'刑法':[{n:'柏浪涛 刑法主观题',s:'柏神10题'}],'刑诉':[{n:'左宁 刑诉法',s:'法条定位40题'}],'民法':[{n:'待添加',s:''}],'民诉':[{n:'待添加',s:''}],'理论法':[{n:'待添加',s:''}],'行政法':[{n:'李佳 行政法',s:'每日一题24题'}]};
function renderVideos(){const s=dom.videoSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法';dom.videoGrid.innerHTML=(vD[s]||[]).map(v=>`<div class="resource-card"><div class="rsc-icon">🎬</div><h3>${v.n}</h3><p>${v.s}</p><span class="rsc-status ${v.s?'loaded':'pending'}">${v.s?'✓ 已加载':'待上传'}</span></div>`).join('');}
const mD={'刑法':[{n:'柏浪涛 刑法攻略',l:1},{n:'柏神主观10题',l:1}],'刑诉':[{n:'左宁 刑诉法',l:1}],'行政法':[{n:'李佳 行政法',l:1}],'民法':[{n:'待添加'}],'民诉':[{n:'待添加'}],'理论法':[{n:'待添加'}]};
function renderMaterials(){const s=dom.materialSubjectTabs.querySelector('.tab-btn.active')?.dataset.subj||'刑法';dom.materialGrid.innerHTML=(mD[s]||[]).map(v=>`<div class="resource-card${v.l?' loaded':''}"><div class="rsc-icon">${v.l?'📗':'📕'}</div><h3>${v.n}</h3><p>${v.l?'已加载':'待上传'}</p><span class="rsc-status ${v.l?'loaded':'pending'}">${v.l?'✓ 已加载':'待上传'}</span></div>`).join('');}

// ============ ANSWER PWD ============
let puid=null;
function showAnswerPwd(id){puid=id;dom.answerPwdInput.value='';dom.answerPwdError.classList.add('hidden');dom.answerPwdModal.classList.remove('hidden');setTimeout(()=>dom.answerPwdInput.focus(),100);}
function hideAnswerPwd(){dom.answerPwdModal.classList.add('hidden');puid=null;}
function confirmAnswerPwd(){const p=dom.answerPwdInput.value.trim();const c=getPwdFor(puid);if(p===c){st.unlocked.add(puid);saveLS();hideAnswerPwd();renderPractice();renderProvision();}else{dom.answerPwdError.classList.remove('hidden');dom.answerPwdInput.value='';dom.answerPwdInput.focus();}}

// ============ ADMIN OVERLAY ============
function openAdmin(){if(st.tenant!=='manager'){alert('请以管理者身份登录');return;}
  dom.adminViewStudent.textContent=st.studentId||'管理者';
  // Passwords
  const pq=st.practiceDrawn.map(id=>getAllPool().find(q=>q.id===id)).filter(Boolean);
  dom.adminPracticePasswords.innerHTML=pq.length?pq.map(q=>`<div class="pwd-row"><span>${q.title||'题'}（${q.subject}·${q.type}）</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">今日未抽题</p>';
  const pv=st.provisionDrawn.map(id=>provisionData.find(q=>q.id===id)).filter(Boolean);
  dom.adminProvisionPasswords.innerHTML=pv.length?pv.map(q=>`<div class="pwd-row"><span>法条定位题</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">今日未抽题</p>';
  dom.adminManagerPwd.value=localStorage.getItem('fk_mgr_pwd')||DEFAULT_MGR_PWD;
  renderStudentList();renderStats();
  // Show accounts tab by default
  dom.adminTabs.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('active'));
  dom.adminTabs.querySelector('[data-admin="accounts"]').classList.add('active');
  dom.adminBody.querySelectorAll('.admin-body-section').forEach(s=>s.classList.add('hidden'));
  dom.adminBody.querySelector('#admin-section-accounts').classList.remove('hidden');
  dom.adminOverlay.classList.remove('hidden');
}
function closeAdmin(){dom.adminOverlay.classList.add('hidden');}

function renderStudentList(){
  const ss=getStudents();
  dom.adminStudentList.innerHTML=!ss.length?'<p class="empty-hint">暂无学生账号</p>':ss.map(s=>{
    const p='fk_'+s.id+'_';const pd=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
    const pvd=JSON.parse(localStorage.getItem(p+'provision_drawn')||'[]');const ul=JSON.parse(localStorage.getItem(p+'unlocked')||'[]');
    return `<div class="student-row view-student" data-sid="${s.id}">
    <div class="student-info"><strong>${s.id}</strong><span class="student-meta">密码 ${s.pwd}</span><span class="student-meta">抽${pd.length+pvd.length} 解${ul.length}</span></div>
    <button class="btn-sec btn-sm del-student" data-id="${s.id}">删除</button></div>`;
  }).join('');
  dom.adminStudentList.querySelectorAll('.del-student').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();if(!confirm('删除 '+b.dataset.id+'？'))return;let ss=getStudents();saveStudents(ss.filter(s=>s.id!==b.dataset.id));renderStudentList();}));
  dom.adminStudentList.querySelectorAll('.view-student').forEach(r=>r.addEventListener('click',()=>viewStudentStats(r.dataset.sid)));
}

function viewStudentStats(id){
  const p='fk_'+id+'_';const pd=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
  const pvd=JSON.parse(localStorage.getItem(p+'provision_drawn')||'[]');
  const subjects=JSON.parse(localStorage.getItem(p+'subjects')||'[]');
  const phase=localStorage.getItem(p+'phase')||'';
  const ul=JSON.parse(localStorage.getItem(p+'unlocked')||'[]');
  dom.adminViewStudent.textContent=id;
  const practiceItems=pd.map(id=>questionsData.find(q=>q.id===id)).filter(Boolean);
  dom.adminPracticePasswords.innerHTML=practiceItems.length?practiceItems.map(q=>`<div class="pwd-row"><span>${q.title||'题'}（${q.subject}）</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">无</p>';
  const provItems=pvd.map(id=>provisionData.find(q=>q.id===id)).filter(Boolean);
  dom.adminProvisionPasswords.innerHTML=provItems.length?provItems.map(q=>`<div class="pwd-row"><span>法条定位题</span><span class="pwd-code">${getPwdFor(q.id)}</span></div>`).join(''):'<p class="empty-hint">无</p>';
  // Switch to passwords tab
  dom.adminTabs.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('active'));
  dom.adminTabs.querySelector('[data-admin="passwords"]').classList.add('active');
  dom.adminBody.querySelectorAll('.admin-body-section').forEach(s=>s.classList.add('hidden'));
  dom.adminBody.querySelector('#admin-section-passwords').classList.remove('hidden');
}

function renderStats(){
  const adminQs=getAdminQuestions();
  const rows=SUBJ_TABS;
  // Only 模拟题/真题/每日练习 in columns (民事大综合 is a row)
  const cols=['模拟题','真题','每日练习'];
  let html='<div class="stats-table-wrap"><table class="stats-table"><tr><th>科目</th>';
  cols.forEach(t=>html+=`<th>${t}</th>`);
  html+='<th>合计</th></tr>';
  rows.forEach(tab=>{
    const ds=SUBJ_MAP[tab];html+=`<tr><td>${tab}</td>`;let total=0;
    cols.forEach(type=>{
      const def=questionsData.filter(q=>q.subject===ds&&q.type===type).length;
      const cust=adminQs.filter(q=>q.subject===ds&&q.type===type).length;const sum=def+cust;total+=sum;
      html+=`<td>${sum}${cust?`<span class="cust-badge">+${cust}</span>`:''}</td>`;
    });
    html+=`<td><strong>${total}</strong></td></tr>`;
  });
  html+='</table></div>';

  const students=getStudents();
  html+='<h4 style="margin:12px 0 6px">📊 学生进度</h4>';
  if(!students.length)html+='<p class="empty-hint">暂无学生</p>';
  else{
    html+='<div class="stats-table-wrap"><table class="stats-table"><tr><th>学生</th>';
    rows.forEach(t=>html+=`<th>${t}</th>`);
    html+='<th>总进度</th></tr>';
    students.forEach(s=>{
      const p='fk_'+s.id+'_';const pd=JSON.parse(localStorage.getItem(p+'practice_drawn')||'[]');
      html+=`<tr><td>${s.id}</td>`;let tA=0,dA=0;
      rows.forEach(tab=>{
        const ds=SUBJ_MAP[tab];const total=questionsData.filter(q=>q.subject===ds).length+adminQs.filter(q=>q.subject===ds).length;
        const done=pd.filter(id=>{const qq=[...questionsData,...adminQs].find(x=>x.id===id);return qq&&qq.subject===ds;}).length;
        tA+=total;dA+=done;html+=`<td>${done}/${total}</td>`;
      });
      html+=`<td><strong>${dA}/${tA}</strong> (${tA>0?Math.round(dA/tA*100):0}%)</td></tr>`;
    });
    html+='</table></div>';
  }

  if(adminQs.length){
    html+=`<h4 style="margin:12px 0 6px">📝 自定义 (${adminQs.length}题)</h4><div class="stats-table-wrap"><table class="stats-table"><tr><th>科目</th><th>题型</th><th>标题</th><th>操作</th></tr>`;
    adminQs.forEach((q,i)=>{const tab=REV_SUBJ[q.subject]||q.subject;html+=`<tr><td>${tab}</td><td>${q.type}</td><td>${q.title||'未命名'}</td><td><button class="btn-sec btn-sm del-admin-q" data-idx="${i}">删除</button></td></tr>`;});
    html+='</table></div>';
  }
  dom.statsContent.innerHTML=html;
  dom.statsContent.querySelectorAll('.del-admin-q').forEach(b=>b.addEventListener('click',()=>{
    const idx=parseInt(b.dataset.idx);const qs=getAdminQuestions();if(!confirm('删除「'+qs[idx].title+'」？'))return;
    qs.splice(idx,1);saveAdminQuestions(qs);renderStats();renderPractice();
  }));
}

// ============ EDITOR ============
function saveEditorQuestion(){
  const sb=dom.editorSubject.value;const tp=dom.editorType.value;
  const title=dom.editorTitle.value.trim();const c=dom.editorCase.value.trim();
  const p=dom.editorProblems.value.trim();const a=dom.editorAnswer.value.trim();
  if(!p){dom.editorStatus.textContent='❌ 问题不能为空';dom.editorStatus.className='editor-msg err';return;}
  if(!a){dom.editorStatus.textContent='❌ 答案不能为空';dom.editorStatus.className='editor-msg err';return;}
  const qs=getAdminQuestions();qs.push({id:Date.now(),subject:sb,type:tp,title:title||'自定义题',score:36,case:c,problems:p,answer:a});
  saveAdminQuestions(qs);
  dom.editorTitle.value='';dom.editorCase.value='';dom.editorProblems.value='';dom.editorAnswer.value='';
  dom.editorStatus.textContent=`✅ 已添加（${sb}·${tp}）共 ${qs.filter(q=>q.subject===sb&&q.type===tp).length} 题自定义`;
  dom.editorStatus.className='editor-msg ok';renderPractice();
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
  alert(`✅ 已发布！\n已下载 admin-questions.js\n放到 data/ 后双击同步GitHub.bat`);
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
  dom.navLinks.addEventListener('click',e=>{const b=e.target.closest('.nav-btn[data-module]');if(b)switchModule(b.dataset.module);});
  dom.hamburgerBtn.addEventListener('click',()=>dom.navLinks.classList.toggle('open'));
  dom.adminToggle.addEventListener('click',openAdmin);
  dom.adminClose.addEventListener('click',closeAdmin);
  dom.adminOverlay.addEventListener('click',e=>{if(e.target===dom.adminOverlay)closeAdmin();});
  dom.loginSwitch.addEventListener('click',()=>{st=freshState(null);document.querySelectorAll('.fullscreen-overlay').forEach(o=>o.classList.add('hidden'));dom.loginLearner.classList.remove('hidden');dom.loginManager.classList.remove('hidden');dom.studentLoginArea.classList.add('hidden');dom.managerPwdArea.classList.add('hidden');dom.loginError.classList.add('hidden');dom.studentLoginError.classList.add('hidden');dom.studentIdInput.value='';dom.studentPwdInput.value='';showLogin();});

  // Admin tabs
  dom.adminTabs.addEventListener('click',e=>{
    const b=e.target.closest('.admin-tab');if(!b)return;
    dom.adminTabs.querySelectorAll('.admin-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    const sec=b.dataset.admin;
    dom.adminBody.querySelectorAll('.admin-body-section').forEach(s=>s.classList.add('hidden'));
    dom.adminBody.querySelector('#admin-section-'+sec).classList.remove('hidden');
    if(sec==='stats')renderStats();
  });

  // Multi-select for subject + type tabs
  document.querySelectorAll('.tabs-bar').forEach(bar=>{
    bar.addEventListener('click',e=>{
      const btn=e.target.closest('.tab-btn');if(!btn)return;
      // Toggle: if it's the only active one in this bar, don't let them de-select everything
      const siblings=bar.querySelectorAll('.tab-btn');
      const activeCount=[...siblings].filter(s=>s.classList.contains('active')).length;
      if(btn.classList.contains('active')&&activeCount<=1)return; // keep at least one
      btn.classList.toggle('active');
      const id=bar.id;
      if(id==='practiceSubjectTabs'||id==='practiceTypeTabs')renderPractice();
      else if(id==='reciteSubjectTabs')renderRecite();
      else if(id==='videoSubjectTabs')renderVideos();
      else if(id==='materialSubjectTabs')renderMaterials();
    });
  });

  dom.practiceDrawBtn.addEventListener('click',()=>{
    if(st.tenant==='manager'){alert('管理者不记录抽题数据');return;}
    drawFrom(getCurrentPool(),st.practiceDrawn,Math.max(1,parseInt(dom.practicePlanCount.value)||1));
    st.practiceIdx=st.practiceDrawn.length-1;renderPractice();
  });
  dom.practiceResetBtn.addEventListener('click',()=>{if(st.tenant==='manager'){alert('管理者无抽题数据');return;}if(!confirm('重置今日抽题？'))return;st.practiceDrawn=[];st.practiceIdx=0;saveLS();renderPractice();});
  dom.provisionDrawBtn.addEventListener('click',()=>{if(st.tenant==='manager'){alert('管理者不记录抽题数据');return;}drawFrom(provisionData,st.provisionDrawn,Math.max(1,parseInt(dom.provisionPlanCount.value)||1));st.provisionIdx=st.provisionDrawn.length-1;renderProvision();});
  dom.provisionResetBtn.addEventListener('click',()=>{if(st.tenant==='manager'){alert('管理者无抽题数据');return;}if(!confirm('重置今日法条定位？'))return;st.provisionDrawn=[];st.provisionIdx=0;saveLS();renderProvision();});
  dom.answerPwdCancel.addEventListener('click',hideAnswerPwd);
  dom.answerPwdConfirm.addEventListener('click',confirmAnswerPwd);
  dom.answerPwdModal.addEventListener('click',e=>{if(e.target===dom.answerPwdModal)hideAnswerPwd();});
  dom.answerPwdInput.addEventListener('keydown',e=>{if(e.key==='Enter')confirmAnswerPwd();if(e.key==='Escape')hideAnswerPwd();});
  dom.answerPwdInput.addEventListener('input',function(){this.value=this.value.replace(/\D/g,'').slice(0,4);});
  dom.adminSaveManagerPwd.addEventListener('click',()=>{const p=dom.adminManagerPwd.value.trim();if(p.length<4){alert('至少4位');return;}localStorage.setItem('fk_mgr_pwd',p);alert('已更新');});
  dom.adminAddStudentBtn.addEventListener('click',()=>{const r=dom.adminNewStudentId.value.trim();if(!r){alert('输入ID');return;}const ss=getStudents();if(ss.find(s=>s.id===r)){alert('已存在');return;}const p=genPwd();ss.push({id:r,pwd:p,created:new Date().toISOString()});saveStudents(ss);dom.adminNewStudentId.value='';renderStudentList();alert(`学生 ${r} 创建成功！密码：${p}`);});
  dom.adminNewStudentId.addEventListener('keydown',e=>{if(e.key==='Enter')dom.adminAddStudentBtn.click();});
  dom.editorSaveBtn.addEventListener('click',saveEditorQuestion);
  dom.publishBtn.addEventListener('click',publishAndExport);
  dom.editorToggle.addEventListener('click',()=>dom.editorBody.classList.toggle('hidden'));
  document.addEventListener('click',e=>{if(dom.navLinks.classList.contains('open')&&!dom.navLinks.contains(e.target)&&!dom.hamburgerBtn.contains(e.target))dom.navLinks.classList.remove('open');});
}

function init(){initDom();bindEvents();showLogin();}
document.addEventListener('DOMContentLoaded',init);

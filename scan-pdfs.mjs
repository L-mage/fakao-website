/**
 * 📂 法考PDF自动导入工具 v2
 *
 * 适配您的目录结构：
 *   主观题题目和背诵/
 *   ├── 刷题/刑法/民法/刑诉/民诉/行政法/理论法/民事综合模拟/
 *   ├── 法条定位/
 *   ├── 背诵/
 *   ├── 网课资源/
 *   └── 机构教材/
 *
 * 用法：双击 提取PDF.bat 或 node scan-pdfs.mjs
 */

import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// ===================== 配置 =====================
const DOCS_DIR = 'C:/Users/lenovo/Documents/主观题题目和背诵';
const QUESTIONS_FILE = './data/questions.js';
const PROVISION_FILE = './data/provision.js';
const TRACKING_FILE = './data/.processed.json';

// 科目名称映射表（文件夹名 → 网站显示名）
const SUBJECT_MAP = {
  '刑法': '刑法',
  '民法': '民法',
  '民事诉讼法': '民事诉讼法',
  '民诉': '民事诉讼法',
  '刑事诉讼法': '刑事诉讼法',
  '刑诉': '刑事诉讼法',
  '行政法': '行政法与行政诉讼法',
  '行政法与行政诉讼法': '行政法与行政诉讼法',
  '理论法': '理论法',
  '民事综合模拟': '民事诉讼法',
  '民事大综合': '民事诉讼法',
};

// 题型映射（文件夹名 → 题型）
const TYPE_MAP = {
  '民事综合模拟': '民事大综合',
  '大综合': '民事大综合',
};

// ===================== 扫描文件 =====================
function scanAllPDFs() {
  const results = [];
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    return results;
  }

  const topDirs = fs.readdirSync(DOCS_DIR, { withFileTypes: true });

  for (const item of topDirs) {
    const fullPath = path.join(DOCS_DIR, item.name);
    if (!item.isDirectory()) continue;

    // 判断顶层目录类型
    if (item.name === '刷题') {
      // 刷题/刑法/xxx.pdf — 按科目分二级目录
      const subjectDirs = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const sub of subjectDirs) {
        if (!sub.isDirectory()) continue;
        const subPath = path.join(fullPath, sub.name);
        const subject = SUBJECT_MAP[sub.name] || '未识别';
        let type = TYPE_MAP[sub.name] || '模拟题';
        const files = fs.readdirSync(subPath).filter(f => f.toLowerCase().endsWith('.pdf'));
        for (const f of files) {
          results.push({
            path: path.join(subPath, f),
            file: f,
            subject,
            type,
            category: 'questions',
            source: `刷题/${sub.name}`,
          });
        }
      }
    } else if (item.name === '法条定位') {
      // 法条定位/xxx.pdf
      const files = fs.readdirSync(fullPath).filter(f => f.toLowerCase().endsWith('.pdf'));
      for (const f of files) {
        // 从文件名猜科目
        let subject = '刑事诉讼法'; // 默认刑诉
        for (const [k, v] of Object.entries(SUBJECT_MAP)) {
          if (f.includes(k)) { subject = v; break; }
        }
        results.push({
          path: path.join(fullPath, f),
          file: f,
          subject,
          type: '法条定位',
          category: 'provision',
          source: '法条定位',
        });
      }
    } else if (['背诵', '网课资源', '机构教材'].includes(item.name)) {
      // 这些目录暂时只记录，不自动导入题库
      const files = fs.readdirSync(fullPath).filter(f => f.toLowerCase().endsWith('.pdf'));
      for (const f of files) {
        results.push({
          path: path.join(fullPath, f),
          file: f,
          subject: '未识别',
          type: item.name,
          category: item.name,
          source: item.name,
        });
      }
    }
  }
  return results;
}

// ===================== PDF文字提取 =====================
async function extractText(pdfPath) {
  const buf = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data: buf }).promise;
  let allText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    allText += content.items.map(item => item.str).join('') + '\n';
  }
  return allText;
}

// ===================== 解析引擎 =====================

/** 解析法条定位格式：XX.问题：... 答：... */
function parseProvision(text) {
  let clean = text
    .replace(/\s+/g, ' ')
    .replace(/答\s*[：:]\s*/g, '答：')
    .replace(/问题\s*[：:]\s*/g, '问题：')
    .trim();

  // 按题目分割
  const parts = clean.split(/(?<!\d)(?=\d+[.、]\s*问题：)/).filter(p => p.trim());
  const items = [];

  for (const part of parts) {
    const numMatch = part.match(/(\d+)[.、]/);
    if (!numMatch) continue;
    const afterNum = part.substring(numMatch[0].length);
    const qMatch = afterNum.match(/问题：\s*(.*)/);
    if (!qMatch) continue;

    const body = qMatch[1];
    const aIdx = body.lastIndexOf('答：');
    let qText = '', aText = '';

    if (aIdx >= 0) {
      qText = body.substring(0, aIdx).trim();
      aText = body.substring(aIdx + 2).trim();
    } else {
      const qMark = body.lastIndexOf('？');
      if (qMark >= 0) {
        qText = body.substring(0, qMark + 1).trim();
        aText = body.substring(qMark + 1).trim();
      }
    }

    // 清理
    qText = qText.replace(/\s+/g, ' ').trim();
    aText = aText.replace(/\s+/g, ' ').trim();

    if (qText && qText.length > 5) {
      items.push({ q: qText, a: aText || '暂无答案' });
    }
  }
  return items;
}

/** 解析柏神风格：第X题 → 案情 → 问题 → 参考答案 */
function parseBaipeng(text) {
  let clean = text
    .replace(/［间题］/g, '［问题］')
    .replace(/关千/g, '关于')
    .replace(/井/g, '并')
    .replace(/教竣/g, '教唆')
    .replace(/诽品/g, '毒品')
    .replace(/展于/g, '属于')
    .replace(/屈千/g, '属于')
    .replace(/子以/g, '予以')
    .replace(/全某/g, '金某')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = clean.split(/(?=第[一二三四五六七八九十]题)/g).filter(p => p.trim());
  const items = [];

  for (const part of parts) {
    const titleMatch = part.match(/(第[一二三四五六七八九十]题)/);
    if (!titleMatch) continue;
    const title = titleMatch[1];
    const scoreMatch = part.match(/[（(]\d+\s*分[）)]/);
    const score = scoreMatch ? parseInt(scoreMatch[0].replace(/[（(]/, '').replace(/分[）)]/, '')) : 36;

    // 案情
    const caseMatch = part.match(/(?:［案情］)?\s*(.*?)(?=［问题］)/s);
    const caseText = caseMatch ? caseMatch[1].trim() : '';

    // 问题
    const probMatch = part.match(/［问题］\s*(.*?)(?=［参考答案］)/s);
    const probText = probMatch ? probMatch[1].trim() : '';

    // 答案
    let ansText = '';
    const ansMatch = part.match(/［参考答案］\s*(.*)/s);
    if (ansMatch) {
      ansText = ansMatch[1].trim()
        .replace(/主观题刑法攻略[^。]*[。\s]/g, '')
        .replace(/\d+\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if ((caseText || probText) && probText.length > 5) {
      items.push({ title, score, case: caseText, problems: probText, answer: ansText });
    }
  }
  return items;
}

/** 通用解析：先试柏神格式 → 再试法条定位格式 → 否则保存原始 */
function parseSmart(text, fileName) {
  // 柏神风格（含第X题）
  if (/第[一二三四五六七八九十]题/.test(text)) {
    const r = parseBaipeng(text);
    if (r.length >= 1) return { type: 'question', items: r };
  }

  // 法条定位风格
  if (/问题[：:]/.test(text) && /答[：:]/.test(text)) {
    const r = parseProvision(text);
    if (r.length >= 2) return { type: 'provision', items: r };
  }

  // 都解析不出来
  return { type: 'unknown', items: [], raw: text };
}

// ===================== 数据文件读写 =====================

function readArrayFromFile(filePath, varName) {
  if (!fs.existsSync(filePath)) return [];
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content
      .replace(/^\/\*[\s\S]*?\*\//, '')
      .replace(/^\/\/.*$/gm, '')
      .replace(new RegExp('const\\s+' + varName + '\\s*=\\s*'), '')
      .trim()
      .replace(/;?\s*$/, '');
    return new Function('return ' + content)();
  } catch {
    return [];
  }
}

function writeQuestionsFile(existing, newItems) {
  const all = [...existing, ...newItems];
  fs.writeFileSync(QUESTIONS_FILE,
`/**
 * 主观题题库数据 - 自动更新于 ${new Date().toLocaleString('zh-CN')}
 * 共 ${all.length} 题
 */
const questionsData = ${JSON.stringify(all, null, 2)};
`, 'utf8');
  return all.length;
}

function writeProvisionFile(existing, newItems) {
  const all = [...existing, ...newItems];
  fs.writeFileSync(PROVISION_FILE,
`/**
 * 法条定位题库 - 自动更新于 ${new Date().toLocaleString('zh-CN')}
 * 共 ${all.length} 题
 */
const provisionData = ${JSON.stringify(all, null, 2)};
`, 'utf8');
  return all.length;
}

function saveRaw(fileName, text, info) {
  const dir = './data/待整理';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safeName = fileName.replace(/\.pdf$/i, '') + '.txt';
  const content =
`# 待整理文件：${fileName}
# 来源：${info.source}
# 科目：${info.subject}
# 类型：${info.type}
# 自动解析失败，请把下面内容复制发给我
${'='.repeat(50)}

${text}
`;
  fs.writeFileSync(path.join(dir, safeName), content, 'utf8');
  return path.join(dir, safeName);
}

// ===================== 主流程 =====================

async function main() {
  console.log('\n' + '='.repeat(55));
  console.log('   📚 法考PDF自动导入工具 v2');
  console.log('='.repeat(55) + '\n');

  // 1. 扫描
  console.log('📂 正在扫描文件夹...');
  const allPDFs = scanAllPDFs();

  if (allPDFs.length === 0) {
    console.log('❌ 没找到PDF文件！');
    console.log('   请把PDF放到对应文件夹：');
    console.log(`   ${DOCS_DIR}\\刷题\\刑法\\`);
    console.log(`   ${DOCS_DIR}\\法条定位\\`);
    console.log('');
    return;
  }

  // 按类型分类
  const questionPDFs = allPDFs.filter(p => p.category === 'questions');
  const provisionPDFs = allPDFs.filter(p => p.category === 'provision');
  const otherPDFs = allPDFs.filter(p => !['questions', 'provision'].includes(p.category));

  console.log(`📄 共找到 ${allPDFs.length} 个PDF文件：`);
  if (questionPDFs.length) console.log(`   📝 刷题：${questionPDFs.length} 个`);
  if (provisionPDFs.length) console.log(`   📜 法条定位：${provisionPDFs.length} 个`);
  if (otherPDFs.length) console.log(`   📂 其他：${otherPDFs.length} 个`);

  // 2. 检查已处理记录
  const processed = (() => {
    try { return fs.existsSync(TRACKING_FILE) ? JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8')) : { files: [] }; }
    catch { return { files: [] }; }
  })();

  // 3. 找出新文件（不在已处理列表中的）
  const newQuestions = questionPDFs.filter(p => !processed.files.includes(p.path));
  const newProvisions = provisionPDFs.filter(p => !processed.files.includes(p.path));
  const newOthers = otherPDFs.filter(p => !processed.files.includes(p.path));

  if (newQuestions.length === 0 && newProvisions.length === 0 && newOthers.length === 0) {
    console.log('\n✅ 没有新文件需要处理。放入新PDF后再运行本工具。\n');
    return;
  }

  console.log(`\n📦 需要导入的新文件：${newQuestions.length + newProvisions.length} 个\n`);

  // 5. 处理新文件
  let questionCount = 0, provisionCount = 0;
  const newQItems = [];
  const newPItems = [];

  // 5a. 处理刷题文件
  for (const pdf of newQuestions) {
    console.log(`\n⏳ [${pdf.file}] 正在提取...`);
    try {
      const text = await extractText(pdf.path);
      console.log(`   📄 ${text.length} 字符`);

      const result = parseSmart(text, pdf.file);
      if (result.type === 'question' && result.items.length >= 1) {
        const existing = readArrayFromFile(QUESTIONS_FILE, 'questionsData');
        const maxId = existing.reduce((m, q) => q.id > m ? q.id : m, 0);

        const items = result.items.map((r, i) => ({
          id: maxId + i + 1,
          subject: pdf.subject,
          type: pdf.type,
          title: r.title || `第${i+1}题`,
          score: r.score || 36,
          case: r.case || '',
          problems: r.problems || '',
          answer: r.answer || '',
        }));

        newQItems.push(...items);
        questionCount += items.length;
        console.log(`   ✅ 解析出 ${items.length} 题（${pdf.subject} - ${pdf.type}）`);
      } else if (result.type === 'provision' && result.items.length >= 1) {
        // 刷题文件夹里发现了法条定位格式
        const existing = readArrayFromFile(PROVISION_FILE, 'provisionData');
        const maxNum = existing.reduce((m, q) => {
          const n = parseInt((q.id || 'pv0').replace('pv', ''));
          return n > m ? n : m;
        }, 0);
        const items = result.items.map((r, i) => ({
          id: 'pv' + (maxNum + i + 1),
          subject: pdf.subject,
          q: r.q,
          a: r.a,
        }));
        newPItems.push(...items);
        provisionCount += items.length;
        console.log(`   ✅ 识别为法条定位，解析出 ${items.length} 题`);
      } else {
        const saved = saveRaw(pdf.file, text, pdf);
        console.log(`   ⚠️  未能自动识别格式，已保存到 ${saved}`);
        console.log(`      打开这个文件，把内容复制发给我，我来解析`);
      }
    } catch (e) {
      console.log(`   ❌ 提取失败：${e.message}`);
    }
    processed.files.push(pdf.path);
  }

  // 5b. 处理法条定位文件
  for (const pdf of newProvisions) {
    console.log(`\n⏳ [${pdf.file}] 正在提取...`);
    try {
      const text = await extractText(pdf.path);
      console.log(`   📄 ${text.length} 字符`);

      const items = parseProvision(text);
      if (items.length >= 1) {
        const existing = readArrayFromFile(PROVISION_FILE, 'provisionData');
        const maxNum = existing.reduce((m, q) => {
          const n = parseInt((q.id || 'pv0').replace('pv', ''));
          return n > m ? n : m;
        }, 0);

        const pItems = items.map((r, i) => ({
          id: 'pv' + (maxNum + i + 1),
          subject: pdf.subject,
          q: r.q,
          a: r.a,
        }));

        newPItems.push(...pItems);
        provisionCount += items.length;
        console.log(`   ✅ 解析出 ${items.length} 道法条定位题`);
      } else {
        const saved = saveRaw(pdf.file, text, pdf);
        console.log(`   ⚠️  未能解析，已保存到 ${saved}`);
      }
    } catch (e) {
      console.log(`   ❌ 提取失败：${e.message}`);
    }
    processed.files.push(pdf.path);
  }

  // 5c. 处理其他文件（背诵/网课/教材 — 目前仅记录）
  for (const pdf of otherPDFs) {
    if (!processed.files.includes(pdf.path)) {
      processed.files.push(pdf.path);
      console.log(`\n📂 [${pdf.file}] 属于"${pdf.type}"模块，已记录`);
    }
  }

  // 6. 写入数据文件
  if (questionCount > 0) {
    const existing = readArrayFromFile(QUESTIONS_FILE, 'questionsData');
    const total = writeQuestionsFile(existing, newQItems);
    console.log(`\n📝 刷题题库：新增 ${questionCount} 题，共 ${total} 题`);
  }

  if (provisionCount > 0) {
    const existing = readArrayFromFile(PROVISION_FILE, 'provisionData');
    const total = writeProvisionFile(existing, newPItems);
    console.log(`\n📜 法条定位题库：新增 ${provisionCount} 题，共 ${total} 题`);
  }

  // 7. 保存处理记录
  processed.lastUpdated = new Date().toISOString();
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(processed, null, 2), 'utf8');

  // 8. 输出总结
  console.log('\n' + '='.repeat(55));
  console.log('   ✅ 全部完成！');
  console.log('='.repeat(55));
  if (questionCount > 0 || provisionCount > 0) {
    console.log('   🖥️  现在刷新网页即可看到新题目！');
  }
  console.log('');
}

main().catch(e => {
  console.error('\n❌ 程序出错：', e.message);
  console.error(e.stack?.slice(0, 300));
  console.log('\n💡 如果报 "找不到模块"，请先运行：');
  console.log('   打开终端 → cd 桌面/fakao-website → npm install pdfjs-dist');
});

#!/usr/bin/env node
// Quill skill 静态校验器 —— GitHub Actions 的免费第一道闸门。
//
// 定位：只做**确定性**检查（文件在不在、frontmatter 合不合法、版本对不对得上、
// eval 断没断链、示例文章有没有违反自己写的禁用清单）。凡是需要人或模型判断的
// 一律不做 —— 那些交给 evals/ 与人工评审。
//
// 零依赖，Node 18+。本地跑：`node scripts/validate-skill.mjs`
// 用法：`--format text|json` · `--strict`（把警告升级为错误）· `--root <dir>`

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(
  process.argv.includes('--root')
    ? process.argv[process.argv.indexOf('--root') + 1]
    : join(fileURLToPath(import.meta.url), '..', '..'),
);
const STRICT = process.argv.includes('--strict');
const FORMAT = process.argv.includes('--format')
  ? process.argv[process.argv.indexOf('--format') + 1]
  : 'text';

const results = [];
const add = (level, group, id, message, detail) =>
  results.push({ level, group, id, message, detail });

const pass = (group, id, message, detail) => add('pass', group, id, message, detail);
const warn = (group, id, message, detail) => add('warn', group, id, message, detail);
const fail = (group, id, message, detail) => add('error', group, id, message, detail);

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const has = (rel) => existsSync(join(ROOT, rel));

// ---------------------------------------------------------------- YAML 子集解析
// SKILL.md 的 frontmatter 只需要：顶层标量 + 一层嵌套 map。不引第三方解析器。
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const body = text.slice(end + 4);
  const out = {};
  let currentKey = null;
  for (const raw of block.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      const i = line.indexOf(':');
      if (i === -1) continue;
      currentKey = line.slice(0, i).trim();
      out[currentKey] = unquote(line.slice(i + 1).trim());
    } else if (currentKey) {
      const i = line.indexOf(':');
      if (i === -1) continue;
      const key = line.slice(0, i).trim();
      out[currentKey] ??= {};
      if (typeof out[currentKey] === 'string') out[currentKey] = {};
      out[currentKey][key] = unquote(line.slice(i + 1).trim());
    }
  }
  return { data: out, body };
}

const unquote = (v) =>
  (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v;

// =========================================================== A. Agent Skills 规范
// https://agentskills.io/specification
const SPEC_ALLOWED = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];

function checkSpec() {
  const G = 'A · 规范';
  if (!has('SKILL.md')) return fail(G, 'A0', 'SKILL.md 不存在');

  const text = read('SKILL.md');
  const fm = parseFrontmatter(text);
  if (!fm) return fail(G, 'A1', 'SKILL.md 缺少可解析的 YAML frontmatter');
  const { data, body } = fm;

  if (!data.name) fail(G, 'A2', 'frontmatter 缺 name');
  else if (data.name.length > 64) fail(G, 'A2', 'name 超 64 字符（' + data.name.length + '）');
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.name))
    fail(G, 'A2', 'name 只能是小写字母/数字/连字符，且不能以连字符开头或结尾：' + data.name);
  else pass(G, 'A2', 'name 合规（' + data.name + '）');

  const desc = data.description == null ? '' : String(data.description);
  if (!desc) fail(G, 'A3', 'frontmatter 缺 description');
  else if (!desc.trim()) fail(G, 'A3', 'description 为空');
  else if (desc.length > 1024) fail(G, 'A3', 'description 超 1024 字符（' + desc.length + '）');
  else pass(G, 'A3', 'description 合规（' + desc.length + '/1024 字符）');

  if (!data.license) warn(G, 'A4', '未声明 license（本 skill 用 CC BY-NC-SA 4.0，建议写进 frontmatter）');
  else pass(G, 'A4', 'license: ' + data.license);

  if (data.compatibility && String(data.compatibility).length > 500)
    fail(G, 'A5', 'compatibility 超 500 字符');

  if (data.metadata && typeof data.metadata === 'object') {
    const bad = Object.entries(data.metadata).filter(([, v]) => typeof v !== 'string');
    if (bad.length) fail(G, 'A6', 'metadata 的值必须是字符串', bad.map(([k]) => k).join(', '));
    else pass(G, 'A6', 'metadata 键均为字符串（' + Object.keys(data.metadata).join(', ') + '）');
  }

  const unknown = Object.keys(data).filter((k) => !SPEC_ALLOWED.includes(k));
  if (unknown.length) warn(G, 'A7', '非规范字段：' + unknown.join(', ') + '（规范允许：' + SPEC_ALLOWED.join(', ') + '）');

  // 渐进式披露：规范建议 SKILL.md 控制在 500 行 / 5000 token 内
  const lines = text.split(/\r?\n/).length;
  if (lines > 500) fail(G, 'A8', 'SKILL.md ' + lines + ' 行，超过规范建议的 500 行');
  else pass(G, 'A8', 'SKILL.md ' + lines + ' 行（规范建议 <500）');

  const cjk = (body.match(/[\u4e00-\u9fff]/g) || []).length;
  const est = Math.round(cjk + (body.length - cjk) / 4);
  if (est > 5000) {
    // 已知债务，不阻断 CI：SKILL.md 每次激活都要全量进上下文。
    // 见 docs/research/skill-ci-continuous-improvement.md 的「待偿债务」。
    warn(G, 'A9', 'SKILL.md 正文约 ' + est + ' token，超出规范建议的 5000（已知债务，待拆分）',
      '每次激活都全量加载；把「风格与禁用」与句子级规则下沉到 references/ 可回收约 3000 token');
  } else pass(G, 'A9', 'SKILL.md 正文约 ' + est + ' token（规范建议 <5000）');
}

// ======================================================= B. 仓库完整性（quill 专属）
function listFiles(dir, ext) {
  const p = join(ROOT, dir);
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((f) => f.endsWith(ext)).map((f) => dir + '/' + f).sort();
}

function checkIntegrity() {
  const G = 'B · 完整性';
  const skill = read('SKILL.md');

  // B1 SKILL.md 里提到的每个仓库内路径都必须存在（skill 腐坏的第一个症状）
  const referenced = new Set(
    [...skill.matchAll(/`((?:references|assets|evals|scripts|docs)\/[A-Za-z0-9_\-./]+\.(?:md|mjs|js|svg|json))`/g)].map((m) => m[1]),
  );
  const missing = [...referenced].filter((p) => !has(p));
  if (missing.length) fail(G, 'B1', 'SKILL.md 引用了不存在的文件', missing.join(', '));
  else pass(G, 'B1', 'SKILL.md 引用的 ' + referenced.size + ' 个仓库文件全部存在');

  // B2 渐进式披露清单必须覆盖全部 references —— 没登记的参考文档等于不存在
  const refs = listFiles('references', '.md');
  const undisclosed = refs.filter((r) => !skill.includes(r));
  if (undisclosed.length)
    fail(G, 'B2', 'references/ 里有文件未登记进 SKILL.md「渐进式披露」，Agent 不会去加载', undisclosed.join(', '));
  else pass(G, 'B2', refs.length + ' 份 reference 全部登记在渐进式披露清单中');

  const tpl = listFiles('assets/templates', '.md');
  const tplMissing = tpl.filter((t) => !skill.includes(t) && !skill.includes(t.replace('assets/templates/', '')));
  if (tplMissing.length) warn(G, 'B3', '模板未在 SKILL.md 中提及', tplMissing.join(', '));
  else pass(G, 'B3', tpl.length + ' 份模板均被 SKILL.md 引用');

  // B4 / B5 版本对齐：SKILL.md metadata ↔ CHANGELOG
  if (!has('CHANGELOG.md')) return warn(G, 'B4', 'CHANGELOG.md 不存在，无法校验版本一致性');
  const changelog = read('CHANGELOG.md');
  const entries = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/gm)];
  if (!entries.length) return fail(G, 'B4', 'CHANGELOG.md 里没有 `## [x.y.z] - yyyy-mm-dd` 格式的条目');
  const topVer = entries[0][1];
  const topDate = entries[0][2];
  const meta = parseFrontmatter(skill).data.metadata || {};

  if (meta.version !== topVer)
    fail(G, 'B4', '版本不一致：SKILL.md metadata.version=' + meta.version + '，CHANGELOG 最新=' + topVer);
  else pass(G, 'B4', '版本一致：' + topVer);
  if (meta.date !== topDate)
    fail(G, 'B5', '日期不一致：SKILL.md metadata.date=' + meta.date + '，CHANGELOG 最新=' + topDate);
  else pass(G, 'B5', '日期一致：' + topDate);

  // B6 CHANGELOG 底部必须有该版本的链接引用，否则 release 链接 404
  for (const m of entries) {
    const ver = m[1];
    if (!changelog.includes('[' + ver + ']:')) warn(G, 'B6', 'CHANGELOG 缺少 ' + ver + ' 的链接引用定义');
  }

  // B7 README 的目录结构必须跟上仓库现状。
  // README 把 references/、templates/ 这类目录折叠成「# N 个」注释，所以核对的是
  // 那个 N ——「5 个模板」写成 6 个文件时，只有这条检查能发现。
  if (has('README.md')) {
    const readme = read('README.md');
    const start = readme.indexOf('## 目录结构');
    const nextSection = start === -1 ? -1 : readme.indexOf('\n## ', start + 1);
    const tree = start === -1 ? '' : readme.slice(start, nextSection === -1 ? undefined : nextSection);
    if (!tree) {
      warn(G, 'B7', 'README 里没有「## 目录结构」小节，无法核对目录树');
    } else {
      // 「N 个」对不同目录含义不同：references/ 数 .md，evals/ 数用例条数。
      const countMd = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.md') && !f.startsWith('.')).length;
      const counters = {
        references: () => countMd('references'),
        'assets/templates': () => countMd('assets/templates'),
        'assets/examples/sample-article': () => countMd('assets/examples/sample-article'),
        'docs/research': () => countMd('docs/research'),
        evals: () => {
          try { return JSON.parse(read('evals/evals.json')).evals.length; } catch { return -1; }
        },
      };

      const problems = [];
      for (const line of tree.split(/\r?\n/)) {
        const m = line.match(/([\w\-./]+)\/\s*#\s*(\d+)\s*(?:个|份|条)/);
        if (!m) continue;
        const token = m[1].replace(/\/$/, '');
        const dir = Object.keys(counters).find((d) => d === token || d.endsWith('/' + token));
        if (!dir) continue;
        const actual = counters[dir]();
        if (actual !== Number(m[2])) problems.push(m[1] + '/ 声明 ' + m[2] + '，实际 ' + actual);
      }

      const topLevel = ['SKILL.md', 'CHANGELOG.md', 'references/', 'assets/', 'docs/', 'evals/', 'LICENSE', 'README.md'];
      const unlisted = topLevel.filter((n) => !tree.includes(n));
      if (unlisted.length) problems.push('目录树缺少顶层条目：' + unlisted.join(', '));

      if (problems.length) warn(G, 'B7', 'README 目录树与仓库现状不一致', problems.join('; '));
      else pass(G, 'B7', 'README 目录树的条目数与仓库现状一致');
    }
  }
}

// ============================================== C. 禁用清单 vs 示例正文（quill 专属）
// Quill 的示例文章是 Agent 的风格范本。范本里出现禁用词，等于在教模型写违例稿。
// 词表直接从 SKILL.md 的「风格与禁用」抽取 —— 新增禁用词会自动纳入检查。
function extractBannedTerms(skill) {
  const idx = skill.indexOf('## 风格与禁用');
  if (idx === -1) return { terms: [], note: '未找到「风格与禁用」小节' };
  const terms = new Set();
  for (const line of skill.slice(idx).split(/\r?\n/)) {
    if (!/^\s*[-*>]+\s*\*\*禁/.test(line)) continue;
    for (const quoted of line.match(/[“"]([^”"]+)[”"]/g) || []) {
      for (const part of quoted.split(/\s*\/\s*/)) {
        const t = part.trim();
        if (/[：:→]/.test(t)) continue; // 排除「标题：说明」这类按基线放行的结构性标签
        if (t.length < 2 || t.length > 12) continue;
        if (!/^[\u4e00-\u9fff、]+$/.test(t)) continue;
        terms.add(t);
      }
    }
  }
  return { terms: [...terms], note: '' };
}

function checkSelfConsistency() {
  const G = 'C · 自洽';
  const skill = read('SKILL.md');
  const { terms, note } = extractBannedTerms(skill);
  if (note) return warn(G, 'C1', note);

  const prose = ['assets/examples/sample-article/draft.md', 'assets/examples/sample-article/ai-draft.md'];
  const hits = [];
  for (const file of prose) {
    if (!has(file)) continue;
    // 去掉 frontmatter；ai-draft 的元评论小节（起草说明 / 建议 / 反驳）不是正文，不扫
    const body = read(file)
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
      .replace(/^##\s*(起草说明|对你草稿的建议|反驳记录)[\s\S]*?(?=\n##\s|$)/gm, '');
    for (const line of body.split(/\r?\n/)) {
      const text = line.replace(/^#+\s*/, '');
      for (const t of terms) if (text.includes(t)) hits.push({ file, term: t, line: line.trim().slice(0, 60) });
    }
  }
  if (hits.length)
    fail(G, 'C1', '示例正文出现 ' + hits.length + ' 处禁用词 —— 范本在教模型写违例稿',
      hits.map((h) => h.file + '「' + h.term + '」').join('; '));
  else pass(G, 'C1', '示例正文未出现 ' + terms.length + ' 个禁用词');
}

// ================================================================ D. eval 套件完整性
const CHECK_KINDS = new Set([
  'file_exists', 'file_absent', 'glob_count', 'frontmatter_has',
  'text_absent', 'text_max_count', 'unchanged', 'manual',
]);

function checkEvals() {
  const G = 'D · eval';
  if (!has('evals/evals.json')) return fail(G, 'D0', 'evals/evals.json 不存在');
  let suite;
  try {
    suite = JSON.parse(read('evals/evals.json'));
  } catch (e) {
    return fail(G, 'D0', 'evals/evals.json 不是合法 JSON', e.message);
  }
  const evals = suite.evals || [];
  if (!evals.length) return fail(G, 'D0', 'evals 为空');

  const ids = evals.map((e) => e.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) fail(G, 'D1', 'eval id 重复', [...new Set(dupes)].join(', '));
  else pass(G, 'D1', evals.length + ' 条 eval，id 唯一');

  // D2 每条 eval 至少要有一个机械可跑的断言，否则等于没测
  const bare = evals.filter((e) => !(e.checks || []).some((c) => c.kind !== 'manual'));
  if (bare.length) fail(G, 'D2', '存在没有机械断言的 eval', bare.map((e) => '#' + e.id).join(', '));
  else pass(G, 'D2', '每条 eval 至少有一个机械断言');

  // D3 断言类型必须被 check-workspace.mjs 真正实现，否则是死断言
  const bad = [];
  for (const e of evals)
    for (const c of e.checks || []) if (!CHECK_KINDS.has(c.kind)) bad.push('#' + e.id + ':' + (c.id || c.kind));
  if (bad.length) fail(G, 'D3', '未实现的断言类型（死断言）', bad.join(', '));
  else pass(G, 'D3', '断言类型均已实现');

  // D4 fixture 路径必须存在
  const fixtures = evals.flatMap((e) => e.files || []);
  const gone = fixtures.filter((p) => !has(p));
  if (gone.length) fail(G, 'D4', 'eval 声明的 fixture 路径不存在', gone.join(', '));
  else pass(G, 'D4', fixtures.length + ' 个 fixture 路径全部存在');

  // D5 evals/README.md 必须声明用例数，且与实际一致。声明缺失也要报错——
  //    否则「改条数」这件事没人会发现，静默通过比不检查更糟。
  if (has('evals/README.md')) {
    const rd = read('evals/README.md');
    const claimed = Number((rd.match(/共\s*(\d+)\s*条\s*eval/) || [])[1]);
    if (!Number.isFinite(claimed))
      fail(G, 'D5', 'evals/README.md 里没有「共 N 条 eval」这样的用例数声明');
    else if (claimed !== evals.length)
      fail(G, 'D5', 'evals/README.md 声明 ' + claimed + ' 条，实际 ' + evals.length + ' 条');
    else pass(G, 'D5', 'README 用例数与 evals.json 一致');
  }

  // D6 负例必须有（只测正例会让「永远触发」的 skill 看起来很完美）
  const negatives = evals.filter((e) => JSON.stringify(e).match(/不激活|负例|不触发|不创建/));
  if (!negatives.length) warn(G, 'D6', '没有负例 eval —— 永远触发的 skill 会看起来很完美');
  else pass(G, 'D6', negatives.length + ' 条负例 eval 在守触发边界');
}

// ============================================================================ 输出
checkSpec();
checkIntegrity();
checkSelfConsistency();
checkEvals();

const errors = results.filter((r) => r.level === 'error');
const warnings = results.filter((r) => r.level === 'warn');
const failing = STRICT ? errors.concat(warnings) : errors;

if (FORMAT === 'json') {
  console.log(JSON.stringify(
    { root: ROOT, strict: STRICT, results, summary: { errors: errors.length, warnings: warnings.length } },
    null, 2,
  ));
} else {
  const groups = new Map();
  for (const r of results) {
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group).push(r);
  }
  const icon = { pass: '  ok  ', warn: ' warn ', error: ' FAIL ' };
  for (const [g, rows] of groups) {
    console.log('\n' + g);
    for (const r of rows) {
      console.log('  [' + icon[r.level] + '] ' + r.message);
      if (r.detail) console.log('           ' + r.detail);
    }
  }
  console.log('\n' + '-'.repeat(60));
  console.log(
    results.filter((r) => r.level === 'pass').length + ' 通过 · ' +
    warnings.length + ' 警告 · ' + errors.length + ' 错误' +
    (STRICT ? '（--strict：警告计入失败）' : ''),
  );
}

if (failing.length) {
  console.error('\nQuill skill 校验未通过：' + failing.length + ' 项。');
  process.exit(1);
}
console.log('\nQuill skill 静态校验通过。');
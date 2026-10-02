#!/usr/bin/env node
// Quill eval 的机械断言执行器 —— GitHub Actions 里判定「这次跑有没有守住承诺」。
//
// 职责边界（照抄 skilljack-evals 的分工）：
//   这里只回答「做没做」——文件在不在、frontmatter 对不对、用户草稿有没有被动过。
//   「做得好不好」不归这里管，那是 expectations 里的散文断言，由人工或模型裁判判。
//   每个 eval 至少要有一条 checks（机械断言），否则它等于没测 —— validate-skill.mjs 会拦。
//
// 用法：
//   跑之前：node evals/check-workspace.mjs --workspace <dir> --snapshot before.json
//   跑之后：node evals/check-workspace.mjs --eval 2 --workspace <dir> --snapshot before.json
// 零依赖，Node 18+。

import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);
const REPO = resolve(HERE, '..', '..');

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? dflt : process.argv[i + 1];
};
const WORKSPACE = resolve(arg('workspace', process.cwd()));
const SNAPSHOT = arg('snapshot', null);
const OUT = arg('out', null);
const EVAL_ID = arg('eval', null);
const ONLY_EVALS = arg('eval-ids', null);

// ------------------------------------------------------------------ 小工具
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// 按**路径段**匹配，不做朴素字符串匹配。
// 这一步很关键：`40-Writing/**/draft.md` 必须匹配不到 `ai-draft.md` ——
// 若把 `**` 当普通正则 `.*`，字面量 `draft.md` 就会匹配到 `ai-draft.md` 的尾巴，
// 于是「Agent 没新建 draft.md」这条断言会永远为真，形同虚设。
//   **       → 跨任意层目录（含 0 层）
//   *        → 段内任意字符
//   其余字符  → 字面量，整段相等
function globToRegExp(pattern) {
  const segs = pattern.split('/');
  let re = '^';
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const last = i === segs.length - 1;
    if (s === '**') {
      // 独占一段的 ** ：匹配 0..n 层目录，后面的分隔符由它一并带上
      re += last ? '(?:[^/]+/)*' : '(?:[^/]+/)*';
      continue;
    }
    re += s.replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === '*' ? '[^/]*' : '\\' + m));
    if (!last) re += '/';
  }
  return new RegExp(re + '$');
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(relative(WORKSPACE, p).split(sep).join('/'));
  }
  return out;
}

const ALL_FILES = walk(WORKSPACE);
const match = (pattern) => ALL_FILES.filter((f) => globToRegExp(pattern).test(f));

function parseFrontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const out = {};
  let key = null;
  for (const line of text.slice(4, end).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const i = line.indexOf(':');
    if (i === -1) continue;
    if (indent === 0) { key = line.slice(0, i).trim(); out[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
    else if (key) { out[key] ??= {}; if (typeof out[key] === 'string') out[key] = {}; out[key][line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
  }
  return out;
}

const readIn = (rel) => readFileSync(join(WORKSPACE, rel), 'utf8');

// -------------------------------------------------------------- 断言实现
// 每种断言只回答一件事（一条断言只查一件事，失败原因才好定位）。
const KINDS = {
  file_exists: (c) => {
    const hits = match(c.path);
    return { pass: hits.length >= 1, note: hits.length ? hits.join(', ') : '没有文件匹配 ' + c.path };
  },
  file_absent: (c) => {
    const hits = match(c.path);
    return { pass: hits.length === 0, note: hits.length ? '不该存在却存在：' + hits.join(', ') : '' };
  },
  glob_count: (c) => {
    const hits = match(c.path);
    const ok = c.min == null ? true : hits.length >= c.min;
    const okMax = c.max == null ? true : hits.length <= c.max;
    return { pass: ok && okMax, note: '匹配 ' + hits.length + ' 个（期望 ' + (c.min ?? '≥0') + '..' + (c.max ?? '∞') + '）：' + hits.slice(0, 5).join(', ') };
  },
  frontmatter_has: (c) => {
    const hits = match(c.path);
    if (!hits.length) return { pass: false, note: '没有文件匹配 ' + c.path };
    const bad = [];
    for (const f of hits) {
      const fm = parseFrontmatter(readIn(f));
      if (!fm) { bad.push(f + '（无 frontmatter）'); continue; }
      const v = fm[c.key];
      const ok = c.value == null ? v !== undefined : String(v) === c.value;
      if (!ok) bad.push(f + ' 的 ' + c.key + '=' + JSON.stringify(v));
    }
    return { pass: !bad.length, note: bad.length ? bad.join('; ') : 'ok' };
  },
  text_absent: (c) => {
    const hits = match(c.path);
    if (!hits.length) return { pass: false, note: '没有文件匹配 ' + c.path };
    const bad = [];
    for (const f of hits) {
      const body = readIn(f).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
      for (const term of c.terms) if (body.includes(term)) bad.push(f + ' 出现「' + term + '」');
    }
    return { pass: !bad.length, note: bad.join('; ') };
  },
  text_max_count: (c) => {
    const hits = match(c.path);
    if (!hits.length) return { pass: true, note: '没有文件匹配 ' + c.path + '，跳过' };
    let worst = 0; const where = [];
    for (const f of hits) {
      const body = readIn(f).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
      const n = (body.match(new RegExp(c.regex, 'g')) || []).length;
      if (n > worst) worst = n;
      if (n > c.max) where.push(f + ' 出现 ' + n + ' 次');
    }
    return { pass: !where.length, note: where.length ? where.join('; ') : '最多 ' + worst + ' 次（上限 ' + c.max + '）' };
  },
  unchanged: (c, ctx) => {
    if (!ctx.snapshot) return { pass: false, note: '需要 --snapshot 才能验证「跑之前 = 跑之后」' };
    const bad = [];
    for (const pattern of c.patterns) {
      for (const f of match(pattern)) {
        const before = ctx.snapshot[f];
        if (before == null) { bad.push(f + ' 不在跑之前的快照里'); continue; }
        const after = sha256(readFileSync(join(WORKSPACE, f)));
        if (after !== before) bad.push(f + ' 被改动了（用户文件只读不写）');
      }
    }
    return { pass: !bad.length, note: bad.join('; ') || '受保护文件逐字节未变' };
  },
  manual: (c) => ({ pass: true, manual: true, note: c.note || '' }),
};

// ============================================================================ 主流程
const suite = JSON.parse(readFileSync(arg('evals', join(REPO, 'evals', 'evals.json')), 'utf8'));

// 模式一：跑之前拍快照
if (!EVAL_ID) {
  if (!existsSync(WORKSPACE)) {
    console.error('工作目录不存在：' + WORKSPACE);
    process.exit(2);
  }
  const snapshot = {};
  for (const f of ALL_FILES) snapshot[f] = sha256(readFileSync(join(WORKSPACE, f)));
  const target = SNAPSHOT || join(WORKSPACE, '.quill-snapshot.json');
  writeFileSync(target, JSON.stringify(snapshot, null, 2));
  console.log('已为 ' + ALL_FILES.length + ' 个文件拍快照 → ' + target);
  process.exit(0);
}

// 模式二：判定
let snapshot = null;
if (SNAPSHOT && existsSync(SNAPSHOT)) snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));

const wanted = ONLY_EVALS ? ONLY_EVALS.split(',').map(Number) : null;
const evals = suite.evals.filter((e) => (wanted ? wanted.includes(e.id) : String(e.id) === EVAL_ID));
if (!evals.length) {
  console.error('找不到 eval：' + EVAL_ID);
  process.exit(2);
}

const rows = [];
for (const e of evals) {
  for (const c of e.checks || []) {
    const impl = KINDS[c.kind];
    if (!impl) {
      rows.push({ eval: e.id, id: c.id || c.kind, kind: c.kind, pass: false, note: '未实现的断言类型' });
      continue;
    }
    let r;
    try { r = impl(c, { snapshot }); }
    catch (err) { r = { pass: false, note: '执行出错：' + err.message }; }
    rows.push({ eval: e.id, id: c.id || c.kind, kind: c.kind, ...r });
  }
}

const machine = rows.filter((r) => !r.manual);
const failed = machine.filter((r) => !r.pass);

const w = Math.max(...rows.map((r) => String(r.id).length), 4);
console.log('工作目录：' + WORKSPACE);
console.log('─'.repeat(64));
for (const r of rows) {
  const tag = r.manual ? '人工' : r.pass ? '  ok ' : ' FAIL';
  console.log('  [' + tag + '] #' + r.eval + ' ' + String(r.id).padEnd(w) + (r.note ? '  ' + r.note : ''));
}
console.log('─'.repeat(64));
console.log(
  '机械断言 ' + (machine.length - failed.length) + '/' + machine.length + ' 通过' +
  ' · 需人工判断 ' + rows.filter((r) => r.manual).length + ' 条（见 evals.json 的 expectations）',
);
if (failed.length) console.log('机械断言失败的 id：' + failed.map((r) => '#' + r.eval + ':' + r.id).join(', '));

if (OUT) writeFileSync(OUT, JSON.stringify({ workspace: WORKSPACE, rows, failed: failed.length }, null, 2));
process.exit(failed.length ? 1 : 0);
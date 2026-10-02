#!/usr/bin/env node
// 跑 evals，并把结果汇成可以判放行的 summary。
//
// 两条腿（这是整个文件的关键）：每条 eval 都跑两遍 —— 带 skill、不带 skill。
// 其它条件（模型、工作目录、fixture、prompt、断言）全部对齐，唯一变量是 SKILL.md。
// 差值就是 Skill Lift：装这个 skill 到底有没有让结果变好。
//
// 不跑基线的话，一条「没起作用甚至有害」的 skill 会一直显示绿灯 ——
// arXiv:2608.20614 在 947 组配对样本里测到平均 Lift 只有 0.2134，72.8% 为正。
//
// 用法：
//   node evals/run.mjs --dry-run      只打印计划，不调 agent（本地/CI 冒烟用）
//   node evals/run.mjs                 跑全部
//   node evals/run.mjs --report        读 results/summary.json 出报告 + 判定放行
//
// 环境变量：
//   EVAL_IDS=1,2,7   BASELINE=false   JUDGE=1
//   RUNNER=claude|codex   ANTHROPIC_API_KEY / OPENAI_API_KEY
//   MIN_RESOLUTION=0.8   MIN_LIFT=0.1   TRIALS=1

import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(import.meta.url), '..', '..');
const RESULTS = join(REPO, 'results');
const WORKSPACES = join(RESULTS, 'workspaces');
const SUITE = JSON.parse(readFileSync(join(REPO, 'evals', 'evals.json'), 'utf8'));

const flag = (n) => process.argv.includes('--' + n);
const env = (n, d) => process.env[n] ?? d;

const RUNNER = env('RUNNER', 'claude');
const TRIALS = Number(env('TRIALS', '1'));
const BASELINE = env('BASELINE', '1') !== '0' && env('BASELINE', '1') !== 'false';
const JUDGE = env('JUDGE', '0') === '1';
const MIN_RESOLUTION = Number(env('MIN_RESOLUTION', '0.8'));
const MIN_LIFT = env('MIN_LIFT', '') === '' ? null : Number(env('MIN_LIFT'));

const IDS = env('EVAL_IDS', '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);
const evals = SUITE.evals.filter((e) => (IDS.length ? IDS.includes(e.id) : true));

// 基线腿要把 skill 从发现路径里摘掉，所以每条 eval 建两个独立工作目录。
function makeWorkspace(evalId, arm) {
  const ws = join(WORKSPACES, 'eval-' + evalId + '-' + arm);
  rmSync(ws, { recursive: true, force: true });
  mkdirSync(ws, { recursive: true });
  if (evalId === 2) {
    const fixture = join(REPO, 'evals', 'files', 'existing-draft');
    if (!existsSync(fixture)) throw new Error('eval 2 缺少 fixture：' + fixture);
    cpSync(fixture, ws, { recursive: true });
  }
  return ws;
}

function mountSkill(ws, arm) {
  const dir = RUNNER === 'codex' ? join(ws, '.agents', 'skills') : join(ws, '.claude', 'skills');
  if (arm === 'with-skill') {
    mkdirSync(join(dir, 'quill'), { recursive: true });
    for (const item of ['SKILL.md', 'references', 'assets'])
      cpSync(join(REPO, item), join(dir, 'quill', item), { recursive: true });
  } else {
    mkdirSync(dir, { recursive: true }); // 目录存在但没有 skill —— 基线就是「裸 agent」
  }
}

// CLI runner 会自动批准每一次工具调用，没有沙箱。只在 GitHub 的一次性 runner 上跑，
// 而且工作目录里只放 fixture 和 skill —— 绝不指向有凭据的仓库。
function agentCommand(prompt) {
  return RUNNER === 'codex'
    ? { cmd: 'codex', args: ['exec', '--json', '--skip-git-repo-check', '--ignore-user-config', '--ephemeral', prompt] }
    : { cmd: 'claude', args: ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--setting-sources', 'project'] };
}

function runAgent(ws, prompt) {
  const { cmd, args } = agentCommand(prompt);
  const r = spawnSync(cmd, args, {
    cwd: ws,
    env: process.env,
    encoding: 'utf8',
    timeout: Number(env('AGENT_TIMEOUT_MS', '600000')),
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error ? String(r.error.message) : null };
}

// 复用 check-workspace.mjs：判定逻辑只写一遍，CI 与本地跑的是同一套
function verify(evalId, ws, outFile) {
  const snapshot = join(ws, '.quill-snapshot.json');
  spawnSync(process.execPath, [join(REPO, 'evals', 'check-workspace.mjs'), '--workspace', ws, '--snapshot', snapshot], { encoding: 'utf8' });
  const r = spawnSync(process.execPath, [
    join(REPO, 'evals', 'check-workspace.mjs'), '--eval', String(evalId),
    '--workspace', ws, '--snapshot', snapshot, '--out', outFile,
  ], { encoding: 'utf8' });
  let rows = [];
  try { rows = JSON.parse(readFileSync(outFile, 'utf8')).rows; } catch { /* 没生成就按失败算 */ }
  return { pass: r.status === 0, rows, output: r.stdout + r.stderr };
}

const pct = (n) => (n == null ? '—' : Math.round(n * 100) + '%');

// ------------------------------------------------------------------------ 分支
if (flag('report')) {
  const summaryPath = join(RESULTS, 'summary.json');
  if (!existsSync(summaryPath)) {
    console.error('没有 results/summary.json —— 先跑 node evals/run.mjs');
    process.exit(2);
  }
  const s = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const withRate = s.resolution.withSkill;
  const baseRate = s.resolution.baseline;
  const lift = baseRate == null ? null : withRate - baseRate;

  const lines = [];
  lines.push('## Quill skill evals', '');
  lines.push('| eval | 带 skill | 基线（不带 skill） | 通过 |');
  lines.push('|---|---|---|---|');
  // 这条 eval 到底是「skill 挣来的」还是「裸 agent 也能过」——逐条写清楚，
  // 光看一个总通过率会漏掉「装 skill 反而把一条搞挂了」。
  const verdict = (t) => {
    if (t.baseline == null) return '—';
    if (t.withSkill && !t.baseline) return '✅ 这条是 skill 挣来的';
    if (!t.withSkill && t.baseline) return '⛔ 装了 skill 反而挂';
    return '同分（这条拦不住它）';
  };
  for (const t of s.tasks)
    lines.push('| #' + t.id + ' ' + t.name + ' | ' + (t.withSkill ? '✅' : '❌') + ' | ' +
      (t.baseline == null ? '—' : (t.baseline ? '✅' : '❌')) + ' | ' + verdict(t) + ' |');
  lines.push('');
  lines.push('- 带 skill 通过率：**' + pct(withRate) + '**');
  if (lift != null) lines.push('- 基线通过率：' + pct(baseRate) + '　→　**Skill Lift = ' + (lift >= 0 ? '+' : '') + lift.toFixed(3) + '**');
  else lines.push('- 基线没跑，**Lift 未知**。没跑基线就等于没量过这个 skill 有没有用。');
  lines.push('- trial 数：' + s.meta.trials + '　runner：' + s.meta.runner);

  const gates = [];
  if (withRate < MIN_RESOLUTION) gates.push('通过率 ' + pct(withRate) + ' < 阈值 ' + MIN_RESOLUTION);
  if (MIN_LIFT != null) {
    if (lift == null) gates.push('设了 MIN_LIFT=' + MIN_LIFT + ' 却没跑基线 —— 闸门无法判定，按失败处理');
    else if (lift < MIN_LIFT) gates.push('Skill Lift ' + lift.toFixed(3) + ' < 阈值 ' + MIN_LIFT);
  }
  lines.push('');
  lines.push(gates.length ? '⛔ 放行判定：**不通过** —— ' + gates.join('；') : '✅ 放行判定：通过');

  const md = lines.join('\n');
  writeFileSync(join(RESULTS, 'summary.md'), md);
  console.log(md);
  process.exit(gates.length ? 1 : 0);
}

// ------------------------------------------------------------------------ 跑
if (!evals.length) { console.error('没有匹配的 eval'); process.exit(2); }

console.log('runner=' + RUNNER + '  trials=' + TRIALS + '  baseline=' + BASELINE + '  judge=' + JUDGE);
console.log('eval：' + evals.map((e) => '#' + e.id).join(', '));

if (flag('dry-run')) {
  for (const e of evals)
    for (const arm of BASELINE ? ['with-skill', 'baseline'] : ['with-skill'])
      console.log('  #' + e.id + ' [' + arm + '] ' + makeWorkspacePreview(e, arm));
  console.log('\n（dry-run：没调用任何 agent）');
  process.exit(0);

  function makeWorkspacePreview(e, arm) {
    const ws = join('results', 'workspaces', 'eval-' + e.id + '-' + arm);
    const bits = ['cwd=' + ws, 'fixture=' + (e.fixture_root ? e.fixture_root : '（无）'),
      'skill=' + (arm === 'with-skill' ? '挂载' : '不挂载'), '断言=' + (e.checks || []).length + ' 条'];
    return bits.join('  ');
  }
}

mkdirSync(RESULTS, { recursive: true });
mkdirSync(WORKSPACES, { recursive: true });

const tasks = [];
for (const e of evals) {
  const arms = BASELINE ? ['with-skill', 'baseline'] : ['with-skill'];
  const record = { id: e.id, name: e.expected_output.slice(0, 40), withSkill: false, baseline: null, runs: [] };

  for (const arm of arms) {
    for (let trial = 1; trial <= TRIALS; trial++) {
      const ws = makeWorkspace(e.id, arm);
      mountSkill(ws, arm);
      const outFile = join(RESULTS, 'eval-' + e.id + '-' + arm + '-t' + trial + '.json');
      const prompt = e.prompt;

      console.log('\n>>> #' + e.id + ' [' + arm + '] trial ' + trial);
      const agent = runAgent(ws, prompt);
      writeFileSync(join(RESULTS, 'eval-' + e.id + '-' + arm + '-t' + trial + '.log'),
        agent.stdout + '\n--- stderr ---\n' + agent.stderr);
      if (agent.error) console.log('    agent 启动失败：' + agent.error);

      const v = verify(e.id, ws, outFile);
      const ok = v.pass && agent.code === 0;
      record.runs.push({ arm, trial, pass: ok, agentExit: agent.code });
      console.log('    机械断言 ' + (v.pass ? '通过' : '不通过') + ' · agent 退出码 ' + agent.code);
      for (const line of (v.output || '').split('\n').filter((l) => l.includes('FAIL'))) console.log('      ' + line.trim());
    }
    const passes = record.runs.filter((r) => r.arm === arm && r.pass).length;
    const total = record.runs.filter((r) => r.arm === arm).length;
    if (arm === 'with-skill') record.withSkill = total > 0 && passes / total >= 1;
    else record.baseline = total > 0 && passes / total >= 1;
  }
  tasks.push(record);
}

const rate = (arm) => {
  const runs = tasks.flatMap((t) => t.runs).filter((r) => r.arm === arm);
  return runs.length ? runs.filter((r) => r.pass).length / runs.length : null;
};

const summary = {
  meta: { runner: RUNNER, trials: TRIALS, baseline: BASELINE, judge: JUDGE, generated: new Date().toISOString() },
  resolution: { withSkill: rate('with-skill'), baseline: rate('baseline') },
  tasks,
};
writeFileSync(join(RESULTS, 'summary.json'), JSON.stringify(summary, null, 2));
console.log('\n带 skill 通过率 ' + pct(summary.resolution.withSkill) +
  '　基线 ' + pct(summary.resolution.baseline) +
  '　Lift ' + (summary.resolution.baseline == null ? '未知（没跑基线）'
    : (summary.resolution.withSkill - summary.resolution.baseline).toFixed(3)));
console.log('→ node evals/run.mjs --report');
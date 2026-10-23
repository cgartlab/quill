#!/usr/bin/env node
// unchanged 断言的回归测试 —— 这条断言守的是 Quill 最核心的承诺（用户草稿只读不写），
// 它自己失灵过两次，所以它得有人盯着：
//   1) 只遍历跑之后存在的文件 → 草稿被删掉也判「逐字节未变」（0.11.0 的真实漏洞）
//   2) run.mjs 在 agent 跑完之后才拍快照 → 拿跑完的状态跟自己比，永远为真
// 第二个由 run.mjs 的调用顺序保证，这里守第一个：删除 / 改动 / 新增 / 空匹配都要被判出来。
//
// 用法：node evals/selftest-unchanged.mjs   （零依赖，退出码 0 = 断言行为正确）

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);
const CHECKER = join(dirname(HERE), 'check-workspace.mjs');

const PATTERN = '40-Writing/**/我的文章.md';
const DRAFT = '40-Writing/2026-09-20-remote-work/我的文章.md';

// 临时工作目录 + 一份只含 unchanged 断言的合成用例
const root = mkdtempSync(join(tmpdir(), 'quill-selftest-'));
const suitePath = join(root, 'suite.json');
writeFileSync(suitePath, JSON.stringify({
  evals: [{
    id: 999, prompt: 'selftest', expected_output: 'unchanged 断言行为正确',
    checks: [{ id: 'protected', kind: 'unchanged', patterns: [PATTERN] }],
  }],
}));

const ws = join(root, 'ws');
const snapshotPath = join(root, 'before.json');

function seed(files) {
  rmSync(ws, { recursive: true, force: true });
  mkdirSync(ws, { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(ws, rel)), { recursive: true });
    writeFileSync(join(ws, rel), body);
  }
}

function snapshot() {
  const r = spawnSync(process.execPath, [CHECKER, '--workspace', ws, '--snapshot', snapshotPath], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('拍快照失败：' + r.stdout + r.stderr);
}

function judge() {
  const r = spawnSync(process.execPath, [CHECKER, '--eval', '999', '--workspace', ws, '--snapshot', snapshotPath, '--evals', suitePath], { encoding: 'utf8' });
  return { pass: r.status === 0, out: r.stdout + r.stderr };
}

const cases = [];
const record = (name, ok, detail) => cases.push({ name, ok, detail });

// ① 原样不动 → 必须通过
seed({ [DRAFT]: '初稿正文\n', 'notes/其他.md': '不相干\n' });
snapshot();
{
  const r = judge();
  record('原样不动 → 通过', r.pass, r.out.trim().split('\n').pop());
}

// ② 改动一个字节 → 必须失败
seed({ [DRAFT]: '初稿正文\n' });
snapshot();
writeFileSync(join(ws, DRAFT), '初稿正文改了一个字\n');
{
  const r = judge();
  record('草稿被改动 → 失败', !r.pass && r.out.includes('被改动'), r.out.trim().split('\n').pop());
}

// ③ 删掉草稿 → 必须失败（0.11.0 的漏洞：删了反而通过）
seed({ [DRAFT]: '初稿正文\n' });
snapshot();
unlinkSync(join(ws, DRAFT));
{
  const r = judge();
  record('草稿被删除 → 失败', !r.pass && r.out.includes('被删除'), r.out.trim().split('\n').pop());
}

// ④ 删掉整个目录 → 必须失败
seed({ [DRAFT]: '初稿正文\n' });
snapshot();
rmSync(join(ws, '40-Writing'), { recursive: true, force: true });
{
  const r = judge();
  record('草稿所在目录被删除 → 失败', !r.pass && r.out.includes('被删除'), r.out.trim().split('\n').pop());
}

// ⑤ 跑完又新建一个同名草稿 → 必须失败（换个位置重写等同于改了草稿）
seed({ [DRAFT]: '初稿正文\n' });
snapshot();
mkdirSync(join(ws, '40-Writing', '2026-10-01-new'), { recursive: true });
writeFileSync(join(ws, '40-Writing', '2026-10-01-new', '我的文章.md'), '新写的\n');
{
  const r = judge();
  record('出现新的受保护文件 → 失败', !r.pass && r.out.includes('跑之后才出现'), r.out.trim().split('\n').pop());
}

// ⑥ 快照里一个匹配都没有 → 必须失败（死保护指令不许假装在守东西）
seed({ 'notes/其他.md': '不相干\n' });
snapshot();
{
  const r = judge();
  record('保护指令没匹配到任何文件 → 失败', !r.pass && r.out.includes('没有任何匹配'), r.out.trim().split('\n').pop());
}

rmSync(root, { recursive: true, force: true });

let failed = 0;
for (const c of cases) {
  if (!c.ok) failed++;
  console.log('  [' + (c.ok ? '  ok ' : ' FAIL') + '] ' + c.name + (c.ok ? '' : '  → ' + (c.detail || '')));
}
console.log('\n' + (cases.length - failed) + '/' + cases.length + ' 条通过');
process.exit(failed ? 1 : 0);

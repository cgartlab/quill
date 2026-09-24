# Quill 结构性 Evals

用 [skill-creator](https://github.com/deepseek-ai) 的 eval 框架为 Quill 编写的**结构性**测试：只断言机械可验证的行为，不评分主观写作质量。

## 范围

**断言什么**（客观、可脚本核验）：
- 七文件项目结构是否创建、frontmatter 是否合规
- 文件边界是否守住（用户的草稿只读不写，Agent 内容写 `ai-draft.md`）
- 构思提问是否真的被调用（而非直接开写）
- 负例是否**不**触发（诗、小说、短文本）
- claim / evidence 的最低质量底线（非占位符、有来源、标待核查）

**不断言什么**：论点是否深刻、文笔是否好、证据是否真有说服力——这些是主观判断，靠人工评审。

## 六个 Eval

| id | 场景 | 核心断言 |
|----|------|---------|
| 1 | 新文章项目 | 七文件创建 + frontmatter 合规 + 提问触发 + 不碰用户草稿 |
| 2 | 已有草稿（文件名非 draft.md） | 文件名无关检测 + 用户草稿字节级不变 + 分析进 ai-draft.md |
| 3 | 负例：写一首诗 | 不激活 Quill、不建十文件结构 |
| 4 | 构思不清 | 调提问工具、三轮问题齐、回答前不写正文 |
| 5 | claim/evidence 底线 | 论点具体可反驳、证据有来源、标待核查、不编来源 |
| 6 | 少数派首页 | 加载 sspai-format、中英文空格、直角引号、披露 callout |

Eval 2 的 fixture：`evals/files/existing-draft/40-Writing/2026-09-20-remote-work/`（含 Agent 六文件 + 用户草稿 `我的文章.md`）。

## 怎么跑

skill-creator 的 `run_eval.py` 硬依赖 `claude` CLI（本机无）。可用等价 harness 替代：把每个 eval 的 prompt 放进**干净的临时工作目录**，让 harness 带着 Quill 执行，再核验 `expectations`。

```powershell
# DSH 例（headless 跑单条 prompt）
$tmp = New-Item -ItemType Directory -Path "$env:TEMP\quill-eval-1" -Force
Push-Location $tmp
dsh --profile headless "读取 D:\2-Area\github-repos\quill\SKILL.md 并严格按它执行：帮我写一篇关于「AI 与设计师的关系」的文章"
Pop-Location
# 然后按 evals.json 的 expectations 逐条核验 $tmp 下的文件
```

同理可用 `codex` / `opencode` 执行同一 prompt。判定方式：每条 expectation 记录 passed/failed + evidence，汇总成 skill-creator 的 `grading.json` 形状即可用 `eval-viewer/generate_review.py` 看结果。

## 本机环境注意（踩过的坑）

| 现象 | 原因 | 绕过 |
|------|------|------|
| `python` 无输出、exit 9009 | Windows Store 的 `python.exe` 存根 | 用 `py`，或直接用 uv 的 python.exe 全路径 |
| `py <script>` 报 "No suitable Python runtime found" | 脚本 shebang 是 `python3`，launcher 找不到该环境名 | 直接用 `C:\Users\cgart\AppData\Roaming\uv\python\cpython-3.12.13-windows-x86_64-none\python.exe` |
| `import yaml` 失败 | 基础环境无 PyYAML | `uv run --with pyyaml python <script>` |
| `uv run` 报 `Failed to initialize cache ... 拒绝访问` | 沙箱不许写 `%LOCALAPPDATA%\uv\cache` | 设 `$env:UV_CACHE_DIR` 到 workspace 内路径 |
| 读 SKILL.md 报 `UnicodeDecodeError: 'gbk' codec` | 脚本用平台默认编码读 UTF-8 文件 | 设 `$env:PYTHONUTF8=1` |

## skill-creator 工具问题（审计中发现，待上游修）

**问题 1 — `scripts/quick_validate.py` 硬编码平台默认编码**

第 22 行 `content = skill_md.read_text()` 未指定 `encoding`。在非 UTF-8 默认 locale（如中文 Windows 的 GBK）上读含中文的 SKILL.md 会抛 `UnicodeDecodeError: 'gbk' codec can't decode byte 0xa1`，验证直接崩，与 skill 本身是否合规无关。

建议修法：`skill_md.read_text(encoding='utf-8')`。临时绕过：`$env:PYTHONUTF8=1`。

**问题 2 — eval / description 脚本硬依赖 `claude` CLI**

`scripts/run_eval.py`、`scripts/run_loop.py`、`scripts/improve_description.py` 都以 `claude -p` 子进程执行，且注释明说"uses the session's Claude Code auth"。在 DSH / Codex / OpenCode 等非 Claude Code 环境里无法直接运行——即便这些环境完全具备等价能力（`dsh --profile headless "..."`）。

建议修法：把执行器抽成可配置（如 `--runner claude|dsh|codex|opencode` + 对应命令行模板），或至少让脚本在缺少 `claude` 时给出明确的降级提示而非直接失败。

**补充** — `quick_validate.py` 的 `ALLOWED_PROPERTIES = {name, description, license, allowed-tools, metadata, compatibility}` 不含 `whenToUse`，而 DSH 的 skill 提供方支持 `whenToUse`。两套规范的允许字段集不一致；Quill 选择只保留交集（name/description/license/metadata），把触发信息并进 `description`。

## 断言编写原则

- **可机械核验**：文件存在性、frontmatter 键、字节级不变、正则匹配——不写"论点深刻"这类无法判定的断言。
- **负例必测**：只测正例会让"永远触发"的 skill 看起来完美。
- **边界必测**：Quill 的核心承诺是"不碰用户草稿"，这条必须有断言守住。
- **一条断言只查一件事**：便于定位失败原因。

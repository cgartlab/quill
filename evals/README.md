# Quill 结构性 Evals

用 [skill-creator](https://github.com/deepseek-ai) 的 eval 框架为 Quill 编写的**结构性**测试：只断言机械可验证的行为，不评分主观写作质量。

## 两层断言

每条 eval 的断言分两层，**两层都要有**：

| 层 | 字段 | 谁判 | 回答什么 |
|---|---|---|---|
| 机械 | `checks` | `check-workspace.mjs`，CI 自动 | **做没做** |
| 散文 | `expectations` | 人工，或模型裁判（不参与放行） | **做得好不好** |

这个分工照抄 [skilljack-evals](https://github.com/olaservo/skilljack-evals) 的 `checks:` / `assertions:`，和 [promptfoo](https://www.promptfoo.dev/docs/guides/test-agent-skills/) 那条"确定性断言优先"——能用正则和文件存在性判的，不要交给模型裁决。

**只有 `expectations` 没有 `checks` 的 eval 会被静态校验拦下**，因为它等于没测：prompt 会变，模型会变，但"文件在不在"永远可判。

## 断言类型

`check-workspace.mjs` 实现的全部类型（`validate-skill.mjs` 会核对，声明了没实现的类型会报"死断言"）：

| kind | 判定 |
|---|---|
| `file_exists` / `file_absent` | glob 匹配到的文件数 ≥1 / =0 |
| `glob_count` | 匹配数落在 `min`..`max` 之间 |
| `frontmatter_has` | 匹配文件的 frontmatter 有该键（可指定值） |
| `text_absent` | 正文（去 frontmatter）不含任一禁用词 |
| `text_max_count` | 正文中某模式出现次数不超上限 |
| `unchanged` | 受保护文件相对跑之前的快照逐字节未变 |
| `manual` | 机械判不了，只报告不判定 |

`path` / `patterns` 走**路径段**匹配，不是朴素字符串：`40-Writing/**/draft.md` 匹配不到 `ai-draft.md`。（若把 `**` 当普通正则 `.*`，字面量 `draft.md` 会匹配到 `ai-draft.md` 的尾巴，于是"Agent 没新建 draft.md"这条断言永远为真，形同虚设。）

## 范围

**断言什么**（客观、可脚本核验）：
- 七文件项目结构是否创建、frontmatter 是否合规
- 文件边界是否守住（用户的草稿只读不写，Agent 内容写 `ai-draft.md`）
- 构思提问是否真的被调用（而非直接开写）
- 负例是否**不**触发（诗、小说、短文本）
- claim / evidence 的最低质量底线（非占位符、有来源、标待核查）
- 成稿是否混进禁用词

**不断言什么**：论点是否深刻、文笔是否好、证据是否真有说服力——这些是主观判断，写在 `expectations` 里交给人工。

## 七个 Eval

共 7 条 eval。

| id | 场景 | 机械断言 |
|----|------|---------|
| 1 | 新文章项目 | 七文件创建 + frontmatter 合规 + 未建 draft.md |
| 2 | 已有草稿（文件名非 draft.md） | **用户草稿逐字节未变** + 未建 draft.md + 分析进 ai-draft.md |
| 3 | 负例：写一首诗 | 不建 claim / evidence / _index / ai-draft |
| 4 | 构思不清 | 建了项目（`interactive`，三轮提问本身需人工判） |
| 5 | claim/evidence 底线 | claim 非占位符 + evidence 存在 |
| 6 | 少数派首页 | style/ai-draft 存在 + 未建 draft.md（格式规则人工判） |
| 7 | 最小优先 | 成稿无空洞总结/说白了等填充词 |

Eval 2 的 fixture：`evals/files/existing-draft/40-Writing/2026-09-20-remote-work/`（含 Agent 六文件 + 用户草稿 `我的文章.md`）。

## 怎么跑

### 在 CI 里（推荐）

`.github/workflows/skill-evals.yml` → `evals/run.mjs`。每条 eval 跑两遍：

- **with-skill**：工作目录里挂上 `.claude/skills/quill/`
- **baseline**：同一个目录、同一份 fixture、同一模型、同样的 prompt 与断言，**只是不挂 skill**

唯一变量是 `SKILL.md`，差值即 **Skill Lift**。设了 `MIN_LIFT` 却没跑基线 → 判定失败（fail closed），不静默放过。

```bash
node evals/run.mjs --dry-run          # 只打印计划，不调 agent
node evals/run.mjs                     # 跑全部
node evals/run.mjs --report            # 出 summary.md 并判定放行
EVAL_IDS=2,7 BASELINE=1 node evals/run.mjs
```

### 本地手工跑单条

skill-creator 的 `run_eval.py` 硬依赖 `claude` CLI。可用等价 harness 替代：把 prompt 放进干净的临时工作目录，让 harness 带着 Quill 执行，再跑断言执行器。

```powershell
# DSH 例：headless 跑单条 prompt
$ws = New-Item -ItemType Directory -Path "$env:TEMP\quill-eval-1" -Force
node evals/check-workspace.mjs --workspace $ws --snapshot "$ws\before.json"   # 跑之前拍快照
Push-Location $ws
dsh --profile headless "读取 D:\2-Area\github-repos\quill\SKILL.md 并严格按它执行：帮我写一篇关于「AI 与设计师的关系」的文章"
Pop-Location
node evals/check-workspace.mjs --eval 1 --workspace $ws --snapshot "$ws\before.json"
```

快照那一步不能省——`unchanged` 断言靠它证明"用户草稿跑前跑后逐字节相同"。没有快照，这条承诺无从验证。

同理可用 `claude` / `codex` / `opencode` 执行同一 prompt。

## 成本与安全

- 每个 trial 是一次真实模型调用；跑基线等于成本翻倍。默认 `TRIALS=1`。
- CLI runner（`claude -p` / `codex exec`）会**自动批准每一次工具调用，在宿主机上没有写限制**——这是 skilljack-evals README 里明确警告过的。只在 GitHub 的一次性 runner 上跑，且工作目录里只放 fixture 与 skill，**绝不指向有凭据的仓库**。
- 产物写进 `results/`（已 gitignore）。

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

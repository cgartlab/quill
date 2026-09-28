<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-inverse.svg">
    <img src="./assets/logo.svg" alt="Quill" width="128">
  </picture>
</p>

# Quill

> 结构为骨，自由为魂，真诚为血，高信噪比为气。

**Quill** 装进你的 Agent，把长文写作拆成四个可检查的文件。它按自己的理解写出一篇完整草稿放在 `ai-draft.md`，**你的文章它只读不写**。

适配 DSH、Claude Code、Codex、OpenCode、Obsidian Agent Client。当前版本 0.3.0，开发中（见 [CHANGELOG.md](./CHANGELOG.md)）。

**许可非商用。** 商业用途请先联系作者。

---

## 设计理念

- **结构为骨**：四文件是思维标本的骨架
- **自由为魂**：骨架之上，写作是即兴的
- **真诚为血**：不编来源、不把推测写成事实、不替你定稿
- **高信噪比为气**：短句优先、具体例子、少空泛形容词

---

## 安装

### 最快：把这段发给 Agent

```
安装并加载写作 skill「Quill」：

1. git clone https://github.com/cgartlab/quill.git quill
   （仓库私有就用你已认证的 gh：gh repo clone cgartlab/quill quill）

2. 把 quill/ 放进当前 harness 的 skills 目录（你自动探测该放哪）：
   - DSH → ~/.dsh/skills/
   - Claude Code → ~/.claude/skills/ 或 .claude/skills/
   - Codex → ~/.agents/skills/
   - OpenCode → .opencode/skills/ 或 ~/.config/opencode/skills/
   - Obsidian Agent Client → Agent 的 skills 目录
   若 ~/.cc-switch/ 存在，源放 ~/.cc-switch/skills/quill/

3. 读 quill/SKILL.md 注册为可用 skill。
   触发条件：用户要写博客、通讯、论文、专栏或任何非虚构长文；或想把零散想法整理成有论点有证据的文章；或已有草稿但理不清主线。只要意图是把想法变成有论点的长文就激活，即使用户没明说"写文章"。

4. 激活后先做环境探测，用一句话告诉我检测到的环境与适配方式，然后等我的写作意图。

5. 硬约束（激活即生效）：
   - 全程模型驱动，不跑脚本
   - 不编来源、不编事实、不把推测写成事实、不留 AI 占位文本
   - 列不出五件具体材料就不写长文——研究、追问或缩短
   - 不修改用户的草稿——只读不写；你按自己的理解写出一篇完整草稿放进 ai-draft.md
   - 保留最终写作权——定观点、定去留、定声音

装好后回复「Quill 已就绪」即可。
```

仓库地址换成你的 fork 或本地路径。私有仓库先 `gh auth login`。

### 手动装

```bash
# DSH（推荐 junction，改动即时反映，无需管理员）
mklink /J "%USERPROFILE%\.dsh\skills\quill" "D:\path\to\quill"     # Windows
ln -s /path/to/quill ~/.dsh/skills/quill                              # macOS / Linux

# Claude Code
cp -r quill ~/.claude/skills/quill

# Codex
cp -r quill ~/.agents/skills/quill

# OpenCode
cp -r quill .opencode/skills/quill

# 或直接复制（改了要重新复制）
cp -r quill ~/.dsh/skills/quill
```

装好后 DSH 会话目录出现 `quill`，模型用 `skill({ name: "quill" })` 加载。

CC Switch 托管时源在 `~/.cc-switch/skills/quill/`，改 skill 改源，别改链接副本。

---

## 装完会得到什么

一个文章文件夹，七个文件：

```
40-Writing/
└── 2026-09-26-my-article/
    ├── _index.md      # 入口 + 状态 checklist
    ├── claim.md       # 核心论点
    ├── evidence.md    # 证据与逻辑
    ├── audience.md    # 读者认知状态
    ├── style.md       # 风格与修辞
    ├── ai-draft.md    # Agent 写的完整草稿
    └── draft.md       # 你的文章（文件名不限，Agent 只读）
```

前六个由 Agent 读写。`draft.md` 归你，它读来参照和自检，绝不修改，无论你叫它什么名字。

---

## 它做什么

**材料不够就不动笔。** 非虚构长文动笔前要清点至少五件具体材料。列不出时只有三条路：去研究、问你（最多三问）、或把篇幅缩短。目标字数和"直接写"都不能把材料变多。

**分清材料是什么，才判它可不可信。** 五类身份：可靠事实、机构自述、旁人回忆、作者推断、未知。身份决定它怎么被写进正文，可信度决定它能不能进关键支撑链。机构自述不能当事实用。你说"看见"，它不会扩写成"试过"。

**先立骨架，再写散文。** 十一个步骤，从建项目、清点材料、构思提问、定义论点与证据，到写出草稿、找反例反驳、逐项验证。全部由模型自己读写判断，不跑脚本。

**形式跟着文章类型走。** 观点评论、个人叙事、教程方法、评测、行业解读、人物历史、知乎回答、论坛长帖、公众号博客、口播演讲、短文社交，各有一套开篇、推进、结尾要点。第二步定下类型后按需加载。

**硬规则拦 AI 腔。** 禁翻案腔（"不是A而是B"及其九种变形）、三项以上同构排比、名词化（"进行了优化"）、破折号、提示性冒号、商业黑话、模型路标、借喻包装。覆盖标题、小标题、正文、图片说明。

**改稿有流程。** 六遍改稿、冷读五问、可量化自检（相邻句结构同款、段落可交换、连词密度、借喻聚集等形状判据），逐项过。

---

## 什么时候别用

- 写小说、诗歌、剧本
- 写邮件、评论、即时消息
- 纯资料整理，无论点也无受众

---

## 目录结构

```
quill/
├── SKILL.md                      # 清单 + 工作流 + 环境探测 + 硬规则
├── CHANGELOG.md                  # 版本变更
├── references/                   # 8 份按需加载的参考
│   ├── environment-detection.md  # 环境探测与适配
│   ├── conception-guide.md       # 构思引导：三轮提问 + 说话位置五问
│   ├── framework.md              # 四文件架构
│   ├── evidence-guide.md         # 材料身份五分法 + 用户经历边界
│   ├── form-guide.md             # 11 种文体的写法要点
│   ├── writing-craft.md          # 句子级规则 + 六遍改稿 + 冷读
│   ├── obsidian-adaptation.md    # Obsidian 适配
│   └── sspai-format.md           # 少数派首页格式
├── assets/
│   ├── logo.svg                  # 标志（黑，浅色底）
│   ├── logo-inverse.svg          # 标志反白（深色底）
│   ├── logo-tile.svg             # 圆角图标版
│   ├── templates/                # 5 个模板
│   └── examples/sample-article/  # 完整七文件示范
├── evals/                        # 7 条结构性用例 + fixture
├── LICENSE
└── README.md
```

渐进式披露：`SKILL.md` 只放核心逻辑，参考文档用到才加载。

---

## 发版

版本号记在 `SKILL.md` 的 `metadata.version`。`0.x` 表示尚未稳定，破坏性变更是常事。

改版本时同步三处，缺一即漂移：

1. `SKILL.md` 的 `metadata.version`
2. 本文件的顶部说明
3. `CHANGELOG.md` 顶部新增条目

```powershell
$a = (Select-String -Path SKILL.md -Pattern 'version:').Line -replace '.*"(.*)".*','$1'
$b = (Select-String -Path CHANGELOG.md -Pattern '^## \[(\d+\.\d+\.\d+)\]').Matches[0].Groups[1].Value
if ($a -eq $b) { "OK  $a" } else { "MISMATCH  SKILL=$a  CHANGELOG=$b" }
```

```powershell
git add -A
git commit -m "feat: v<版本> — <这版改了什么>"
git tag -a v<版本> -m "v<版本>"
git push origin main --follow-tags
# Release 说明用 --notes-file 读 CHANGELOG 片段，避免引号被转义
gh release create v<版本> --title "v<版本>" --notes-file <片段文件>
```

> 从 0.1.0 起打 tag。此前曾用 2.x 编号的迭代没有 tag，那套编号不作为版本记录，需要回溯用 `git log`。



---

## 许可证

[CC BY-NC-SA 4.0](./LICENSE)

## 参考

| 主题 | 来源 | 许可 |
|------|------|------|
| Agent Skills 格式规范 | [agentskills.io](https://agentskills.io) · [规范全文](https://agentskills.io/specification) · [规范仓库](https://github.com/agentskills/agentskills) | 开放标准 |
| 风格与价值观（AGENTS.md、创作风格契约） | [cgartlab-obsidian](https://github.com/cgartlab/cgartlab-obsidian) | 私有 |
| 写作流程（碎片化四步的出处） | 《[碎片写作——建立一具思维标本](https://cgartlab.com/posts/fragmented-writing/)》 | CC BY-NC-SA 4.0 |
| 少数派首页写作格式 | [少数派创作手册·风格指南](https://manual.sspai.com/rules/manual-of-style/) | — |
| 材料门槛、材料身份、句子级规则、形式分流 | [human-writing](https://github.com/cgartlab/human-writing)（活人感写作） | MIT |
| Skill 目录结构范式 | [edic-design-system](https://github.com/cgartlab/edic-design-system) | — |
| CC Switch（多 harness 分发） | [farion1231/cc-switch](https://github.com/farion1231/cc-switch) | — |
| 本 skill 的开发与评测框架 | [DeepSeek](https://github.com/deepseek-ai) · skill-creator | — |

`human-writing` 的规则已按 Quill 的四文件架构与模型驱动原则重写，非直接搬运。

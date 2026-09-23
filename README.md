# Quill

> 结构为骨，自由为魂，真诚为血，高信噪比为气。

**Quill** 是一个结构化长文写作 Skill——把模糊的写作意图，转化为可验证、可追溯的结构化数据。它不是写作工具，而是**写作判断层**：替你挡低级错误、维持风格一致性、把事实与推测分开。定价值观、定观点、定去留的权力，始终留给创作者。

适用于 DSH（DeepSeek Harness）、Claude Code、Codex、OpenCode、Obsidian Agent Client 等 Agent Skills 标准（[agentskills.io](https://agentskills.io)）环境。

---

## 为什么需要它

长文写作的失败，绝大多数不是"没东西可写"，而是"材料丰富却理不清"。

人脑能同时持有的工作记忆容量极小；当论点、证据、读者、风格四件事同时占用心智，写作就会卡住或跑题。

Quill 的解法：把这四件事从大脑里"卸载"到四个独立文件中。每个文件只回答一个问题，互相不耦合，但通过 `_index.md` 互相关联。

## 四文件架构

每篇文章是一个文件夹（`YYYY-MM-DD-slug/`），包含七个文件：

| 文件 | 只回答的问题 | 完成的标志 |
|------|------------|----------|
| `claim.md` | 这篇文章最想传递什么？ | 一句话核心论点 + 3-5 条支撑要点 |
| `evidence.md` | 我凭什么这么说？ | 每条证据有来源、可信度、链接 |
| `audience.md` | 我在对谁说？他读前读后有何不同？ | 读前状态 + 读后状态 |
| `style.md` | 用什么语气和结构来说？ | 语调、开篇钩子、隐喻、结尾 |
| `_index.md` | 文章入口与状态 | frontmatter + 完成度 checklist |
| `ai-draft.md` | Agent 的草稿与提议 | 碎片、骨架、起草、修句建议 |
| `draft.md` | 文章正文（用户写，文件名不限） | 草稿 |

```
40-Writing/
└── 2026-09-20-ai-design-system/
    ├── _index.md          # 文章入口 + 状态 checklist（Agent 写）
    ├── claim.md           # 核心论点（Agent 写）
    ├── evidence.md        # 证据与逻辑（Agent 写）
    ├── audience.md        # 读者认知状态（Agent 写）
    ├── style.md           # 风格与修辞（Agent 写）
    ├── ai-draft.md        # Agent 的草稿与提议（Agent 写）
    └── draft.md           # 用户的文章草稿（用户写，Agent 只读；文件名不限）
```

## 十步工作流（全程模型驱动，无脚本）

1. **创建文章项目** — 模型直接创建文件夹与六个结构文件；检测用户是否已有草稿，没有则引导创建（文件名不限）
2. **构思引导（结构化提问）** — 用提问工具引导用户定方向 / 定读者 / 定风格（三轮）
3. **定义核心论点（精修）** — 在预填基础上精修一句话论点 + 支撑要点
4. **收集证据** — 每条证据可点击核验，画推理链
5. **定义受众状态** — 读前/读后认知差
6. **定义风格与修辞** — 语调、钩子、隐喻、结尾
7. **写作（全流程支持）** — 碎片化写作四步：捡骨头 → 搭建骨架 → 组装完整 → 持续完善
8. **反驳** — 草稿写完立即找反例反驳（事实/逻辑/范围/价值反例）
9. **验证** — 模型读取七文件，按 9 项标准判断
10. **生成写作简报**（可选）— 合并四文件供投稿对齐

所有操作（创建、校验、汇总、反驳）由模型自身读写与判断完成，**不依赖任何脚本**。这与作者知识库 AGENTS.md 的红线一致：禁止脚本批量修改笔记，读取 > 建议 > 手动修改。

## 环境自动探测

激活时自动检测当前 harness/agent 环境（Codex / Claude Code / OpenCode / Obsidian Agent Client / DSH / CC Switch 托管），按环境特征适配安装路径、文件工具、frontmatter 约定。详见 `references/environment-detection.md`。

## 安装

> 下面这段提示词可直接粘贴到任何 Agent 对话框（Claude Code、Codex、OpenCode、Obsidian Agent Client 等），让 Agent 自动安装并激活 Quill。

### 一键安装提示词（可粘贴）

```
安装并加载写作 skill「Quill」：

1. 从 GitHub 克隆或下载 skill 包：
   git clone https://github.com/cgartlab/quill.git quill
   （若仓库私有，用你已认证的 gh：gh repo clone cgartlab/quill quill）

2. 把 quill/ 目录放到当前 harness 的 skills 目录（你自动探测应放哪）：
   - Claude Code → ~/.claude/skills/ 或 .claude/skills/
   - Codex → ~/.agents/skills/
   - OpenCode → .opencode/skills/ 或 ~/.config/opencode/skills/
   - Obsidian Agent Client → Agent 的 skills 目录
   若 ~/.cc-switch/ 存在（CC Switch 托管），源放 ~/.cc-switch/skills/quill/

3. 读取 quill/SKILL.md，将其注册为可用 skill。
   触发条件：用户要写博客、通讯、论文或任何非虚构长文；或想把零散想法整理成有论点有证据的文章；或已有草稿但理不清主线。

4. 激活后先做环境探测（读 SKILL.md「环境自动探测与适配」段），
   用一句话告诉我检测到的环境与适配方式，然后等待我的写作意图。

5. 硬约束（来自 SKILL.md，激活即生效）：
   - 全程模型驱动，不跑脚本
   - 不编来源、不编事实、不把推测写成事实、不留 AI 占位文本
   - 不用空泛情绪词（震撼/颠覆/史诗级）替代证据
   - 你保留最终写作权——定观点、定去留、定声音

装好后回复「Quill 已就绪」即可。
```

> 提示词里的仓库地址换成你的 fork 或本地路径即可。私有仓库需先 `gh auth login`。

### DSH (DeepSeek Harness)

DSH 自动从 `~/.dsh/skills/`（用户级，rank 400）和 `<project>/.dsh/skills/`（项目级，rank 100）发现 skill。无需手动注册——放入即被 watcher 发现。

```bash
# 用户级安装——推荐用 junction/symlink，repo 改动即时反映：
# Windows (junction，无需管理员)
mklink /J "%USERPROFILE%\.dsh\skills\quill" "D:\path\to\quill"
# macOS / Linux (symlink)
ln -s /path/to/quill ~/.dsh/skills/quill

# 或直接复制（改动后需重新复制）
cp -r quill ~/.dsh/skills/quill
```

安装后 DSH 会话目录自动出现 `quill`，模型可调用 `skill({ name: "quill" })` 加载完整指令。

### Claude Code

```bash
# 全局
cp -r quill ~/.claude/skills/quill
# 或项目级
cp -r quill .claude/skills/quill
```

### Codex

```bash
cp -r quill ~/.agents/skills/quill
```

### OpenCode

```bash
# 项目级（优先）
cp -r quill .opencode/skills/quill
# 或全局
cp -r quill ~/.config/opencode/skills/quill
```

### Obsidian Agent Client

将 `quill` 目录放入 Agent 的 skills 目录，重启 Agent Client。Quill 会自动探测 Vault 环境并在 `40-Writing/` 下建项目。

### CC Switch 托管

若由 CC Switch 管理，skill 源在 `~/.cc-switch/skills/quill/`（符号链接进各 app）。改 skill 本身时改源，勿改链接副本。

## 目录结构

```
quill/
├── SKILL.md                      # Skill 清单 + 十步工作流 + 环境探测 + 模型自检
├── references/
│   ├── environment-detection.md  # 环境自动探测与适配
│   ├── conception-guide.md       # 构思引导：三轮结构化提问
│   ├── framework.md              # 四文件架构说明
│   ├── evidence-guide.md         # 证据收集指南 + 证据反模式
│   ├── writing-craft.md          # 写作工艺：碎片化四步 + 文章骨架 + 句子声音 + 起草规则 + 写作自检
│   ├── obsidian-adaptation.md    # Obsidian 适配（frontmatter/双链/Dataview）
│   └── sspai-format.md           # 少数派首页写作格式规范
├── assets/
│   ├── templates/                # 五文件模板（claim/evidence/audience/style/ai-draft）
│   └── examples/
│       └── sample-article/       # 完整七文件示范
├── LICENSE
├── README.md
└── writing-skill-dev-doc.md      # 开发文档
```

## 渐进式披露

Quill 遵循"渐进式披露"——Skill 清单（`SKILL.md`）只含核心逻辑，详细参考按需加载：

- 激活时 → `references/environment-detection.md`
- 构思引导 → `references/conception-guide.md`
- 问架构 → `references/framework.md`
- 收证据 → `references/evidence-guide.md`
- 进写作 → `references/writing-craft.md`
- 用 Obsidian → `references/obsidian-adaptation.md`
- 发少数派 → `references/sspai-format.md`

## 设计理念

- **结构为骨**：四文件是思维标本的骨架
- **自由为魂**：骨架之上，写作是即兴的
- **真诚为血**：不编来源、不把推测写成事实、不代笔全文
- **高信噪比为气**：短句优先、具体例子、少空泛形容词

## 许可证

[CC BY-NC-SA 4.0](./LICENSE) — 署名-非商业性-相同方式共享 4.0 国际。

## 致谢

- 风格与价值观源自 [cgartlab-obsidian](https://github.com/cgartlab/cgartlab-obsidian) 知识库的 AGENTS.md 与创作风格契约
- 写作流程源自 cgartlab.com《碎片写作——建立一具思维标本》
- 少数派格式规范源自 [少数派创作手册·风格指南](https://manual.sspai.com/rules/manual-of-style/)
- 架构范式参考 [edic-design-system](https://github.com/cgartlab/edic-design-system)


<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-inverse.svg">
    <img src="./assets/logo.svg" alt="Quill" width="128">
  </picture>
</p>

# Quill

> 结构为骨，自由为魂，真诚为血，信噪比为气。

**Quill** 装进你的 Agent，把长文写作拆成四个可检查的文件。  
它按自己的理解写出一篇完整草稿放在 `ai-draft.md`。  
**你的文章它只读不写**。

适配任何 Agent 应用。

**许可非商用。** 商业用途请先联系作者。

---

## 设计理念

- **结构为骨**：文件是思维标本的骨架
- **自由为魂**：骨架之上，写作是即兴的
- **真诚为血**：不编来源、不把推测写成事实、不替你定稿
- **高信噪比为气**：精炼短句优先、呈现具体例子、摒除泛形容词

---

## 安装

### 最快：把这段发给 Agent

```
安装并加载写作 skill「Quill」：

1. git clone https://github.com/cgartlab/quill.git quill
   （仓库私有就用你已认证的 gh：gh repo clone cgartlab/quill quill）

2. 把 quill/ 放进当前 harness 的 skills 目录（你自动探测该放哪）。

3. 读 quill/SKILL.md 注册为可用 skill。
   触发条件：用户要写博客、通讯、论文、专栏或任何非虚构长文；或想把零散想法整理成有论点有证据的文章；或已有草稿但理不清主线。只要意图是把想法变成有论点的长文就激活，即使用户没明说"写文章"。

4. 激活后先做环境探测，用一句话告诉我检测到的环境与适配方式，然后等我的写作意图。

5. 硬约束（激活即生效）：
   - 全程模型驱动，不跑脚本
   - 不编来源、不编事实、不把推测写成事实、不留 AI 占位文本
   - 材料可以少，但不能假——列不出五件照常写，缺口标 ［请作者补：…］，短而真好过长而假
   - 不修改用户的草稿——只读不写；你按自己的理解写出一篇完整草稿放进 ai-draft.md
   - 保留最终写作权——定观点、定去留、定声音

装好后回复「Quill 已就绪」即可。
```

---

## 装完会得到什么

一个文章文件夹，七个文件：

```
Your Project/
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
├── references/                   # 13 份按需加载的参考
│   ├── author-profiling.md       # 读作者：从近 10 篇学价值观/习惯/审美/偏好（第零步）
│   ├── draft-routing.md          # 按草稿状态分流：无草稿/部分/完整三条线
│   ├── environment-detection.md  # 环境探测与适配
│   ├── conception-guide.md       # 构思引导：核心疑问 + 三轮提问 + 说话位置五问
│   ├── framework.md              # 四文件架构
│   ├── evidence-guide.md         # 材料身份五分法 + 用户经历边界
│   ├── form-guide.md             # 11 种文体的写法要点
│   ├── writing-craft.md          # 句子级规则 + 六遍改稿 + 冷读
│   ├── style-and-bans.md         # 风格规则 + 20 项禁用清单（校订期加载）
│   ├── refutation.md             # 反驳：五类反例 + 驳回判据（第八步加载）
│   ├── obsidian-adaptation.md    # Obsidian 适配
│   ├── sspai-format.md           # 少数派首页格式
│   └── platform-compliance.md    # 跨平台发布合规红线（第六步之后 + 第九步加载）
├── assets/
│   ├── logo.svg                  # 标志（黑，浅色底）
│   ├── logo-inverse.svg          # 标志反白（深色底）
│   ├── logo-tile.svg             # 圆角图标版
│   ├── templates/                # 5 个模板
│   └── examples/sample-article/  # 完整七文件示范
├── evals/                        # 8 条结构性用例 + fixture
│   ├── evals.json                # 用例定义：checks（机械断言）+ expectations（散文断言）
│   ├── check-workspace.mjs       # 机械断言执行器：文件 / frontmatter / 用户草稿是否被改
│   ├── run.mjs                   # 跑测编排：带 skill 与不带 skill 两条腿，量 Skill Lift
│   └── files/                    # eval 2 的 fixture
├── scripts/
│   └── validate-skill.mjs        # 静态校验器：规范 / 路径 / 版本 / 自洽 / eval 完整性
├── .github/workflows/            # 两道闸门
│   ├── skill-quality.yml         # 免费：每次 PR 跑静态校验
│   └── skill-evals.yml           # 花钱：手动或每周跑真实 eval
├── docs/research/                # 设计依据调研
├── LICENSE
└── README.md
```

渐进式披露：`SKILL.md` 只放核心逻辑，参考文档用到才加载。

---

## 质量是怎么被守住的

skill 会腐坏——引用断链、版本号漂移、示例文章混进自己禁掉的词。这些都不需要模型来发现。

每次 push / PR，`.github/workflows/skill-quality.yml` 跑 `scripts/validate-skill.mjs`（零依赖，只要 Node，**不花钱**），查四类问题：

- **规范**：`name` / `description` / `metadata` 是否符合 [Agent Skills 规范](https://agentskills.io/specification)
- **完整性**：`SKILL.md` 引用的路径是否都存在；`references/` 里的文件是否都登记进「渐进式披露」（**没登记等于 Agent 永远不会加载**）；版本与日期是否与 CHANGELOG 对得上
- **自洽**：把 `SKILL.md` 里的禁用词自动抽出来，扫示例文章正文——**范本里出现禁用词，等于在教模型写违例稿**
- **eval**：每条用例至少有一条机械断言，断言类型必须真的被实现，fixture 必须存在，负例必须留着

要花模型调用的那道闸门单独放在 `skill-evals.yml`（手动或每周一）。它为每条用例建两个工作目录，一条挂 skill、一条不挂，同模型同 prompt 同断言，**唯一变量是 `SKILL.md`**——差值就是 Skill Lift。

> 为什么不跑基线就没有意义：在 947 组配对样本上，真实 skill 的平均 Lift 只有 0.2134，且只有 72.8% 为正（[ACES, arXiv:2608.20614](https://arxiv.org/abs/2608.20614)）。**约四分之一的 skill 对结果没有贡献甚至有害**——只跑带 skill 的那条腿，你永远不会知道。

设计取舍与出处见 [`docs/research/skill-ci-continuous-improvement.md`](./docs/research/skill-ci-continuous-improvement.md)。

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

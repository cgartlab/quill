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
   - 列不出五件具体材料就不写长文——研究、追问或缩短
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
├── docs/research/                # 设计依据（logo SVG 生成调研）
├── evals/                        # 7 条结构性用例 + fixture
├── LICENSE
└── README.md
```

渐进式披露：`SKILL.md` 只放核心逻辑，参考文档用到才加载。

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

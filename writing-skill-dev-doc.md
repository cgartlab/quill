# Quill Skill 开发文档

**版本**：0.4.0
**状态**：0.x 开发中（模型驱动 + 少数派格式 + 环境自动探测 + 文件边界 + 材料门槛 + 材料身份 + 完整草稿 + 写作工艺 + 形式分流 + 硬规则 + 禁令后置与分档）。流程与文件约定尚未稳定，破坏性变更是常事。
**最后更新**：2026-09-28

---

## 一、项目概述

Quill 是 CGArtLab 的个人长文写作 Skill：以「结构为骨，自由为魂，真诚为血，信噪比为气」为纲，通过四个文件（核心论点 / 证据 / 受众 / 风格）把模糊的写作意图转化为可验证、可追溯的结构化数据，适配任何 Agent 应用（含 Obsidian Markdown 工作流），并融入少数派首页的写作格式与标准规范。激活时自动探测当前 harness/agent 环境并适配；草稿写完后立即由模型找反例反驳草稿。

**核心定位**：写作判断层，不是写作工具。替人挡低级错误、维持风格一致性、把事实与推测分开；定价值观、定观点、定去留的权力始终留给创作者。

**设计原则**（源自作者知识库 AGENTS.md 与创作风格契约）：

- 模型驱动，无脚本：所有阅读、理解、检查、判断、评估、分析、确认、反驳由大模型自身完成。
- 禁止清单 > 鼓励清单；内容优先 > 格式一致 > 结构完美。
- 读取 > 建议 > 手动修改；AI 在边界内稳定生产。
- 不偏离原本设计的 Skill 架构（四文件文章结构 + references + templates + examples），仅以模型自身能力替代脚本。

## 二、为什么去掉脚本（保留原架构）

原架构用 `scaffold.mjs / verify.mjs / compile.mjs` 做机械创建与校验。按用户新方向移除脚本，理由：

1. **作者价值观**：知识库 AGENTS.md 明确「禁止编写脚本批量修改笔记」「读取 > 建议 > 手动修改」。写作判断本就不该机械化。
2. **校验失真**：脚本能数字符、查链接存在性，查不出"这句话像不像作者""证据是不是二手当一手"——这些恰是写作真正的质量点。
3. **架构不变**：四文件文章结构、references、templates、examples 全部保留；只是把"创建 / 校验 / 汇总 / 反驳"四项操作从脚本改为 SKILL.md 内的模型指令（由你直接读写与判断）。

## 三、调研依据（价值观与风格）

- 知识库 `D:\2-Area\github-repos\cgartlab-obsidian`：AGENTS.md（PARA / 原子笔记 / Agent 边界 / 红线）、`01-项目/创作风格契约.md`、`编辑风格系统.md`、`把发布检查做成写作工作流里的 skill.md`、`01-项目/少数派/我的上帝模式….md`（少数派实战格式）。
- 主站 cgartlab.com：《碎片写作——建立一具思维标本》确认发表态声音与四步流程、签名收束、反 AI 误述姿态。
- 少数派创作手册·风格指南（https://manual.sspai.com/rules/manual-of-style/）：正文格式与标准规范的权威来源，已蒸馏为 `references/sspai-format.md`。
- 活人感写作 `human-writing`（[cgartlab/human-writing](https://github.com/cgartlab/human-writing)，上游 KKKKhazix/human-writing v1.1.0，MIT）：材料门槛、材料身份五分法、句子级规则、多遍改稿与冷读、形式分流、可量化自检的判据来源。已按 Quill 的四文件架构与模型驱动原则重写，非直接搬运；其只读检查脚本未采纳（Quill 坚持无脚本）。
- 既有 skill：`edic-design-system`（结构范式：SKILL.md + references 全大写概念文件 + 按需加载 + 模型自检清单）；`creative-write`（已不存在，motto 由 Quill 继承）。

## 四、Skill 包结构（保留原架构，无 scripts/）

```
quill/
├── SKILL.md                      # manifest + 工作流 + 环境自动探测 + 硬规则
├── CHANGELOG.md                  # 版本变更（面向使用者）
├── references/                   # 8 份按需加载的参考
│   ├── environment-detection.md  # 环境自动探测与适配
│   ├── conception-guide.md       # 构思引导：三轮提问 + 说话位置五问
│   ├── framework.md              # 四文件架构（标注模型驱动）
│   ├── evidence-guide.md         # 材料身份五分法 + 用户经历边界 + 正文归属 + 检索痕迹
│   ├── form-guide.md             # 形式分流：11 种文体的开篇·推进·结尾·常见错误
│   ├── obsidian-adaptation.md    # Obsidian 适配
│   ├── sspai-format.md           # 少数派首页写作格式
│   └── writing-craft.md          # 论点深度 / 声音校准 / 结构接缝 + 句子级规则 + 六遍改稿 + 冷读
├── assets/
│   ├── logo.svg                  # 标志（黑，浅色底）
│   ├── logo-inverse.svg          # 标志反白（深色底）
│   ├── logo-tile.svg             # 圆角图标版
│   ├── templates/                # 5 个模板
│   │   ├── claim.md              # 核心论点
│   │   ├── evidence.md           # 证据与逻辑
│   │   ├── audience.md           # 读者认知状态
│   │   ├── style.md              # 风格与修辞（纲领/声音/禁用清单/发布平台勾选）
│   │   └── ai-draft.md           # Agent 的完整草稿
│   └── examples/sample-article/  # 完整七文件示范
│       ├── _index.md
│       ├── claim.md
│       ├── evidence.md
│       ├── audience.md
│       ├── style.md
│       ├── ai-draft.md
│       └── draft.md
├── docs/research/                # 设计依据（logo SVG 生成调研）
├── evals/                        # 结构性 evals
│   ├── evals.json                # 7 个结构性测试用例（38 条断言）
│   ├── README.md                 # 运行方法 + skill-creator 工具问题记录
│   └── files/existing-draft/     # 已有草稿 fixture（文件名无关检测用）
├── LICENSE                       # CC BY-NC-SA 4.0
├── README.md                     # 面向使用者的说明
└── writing-skill-dev-doc.md      # 本文档
```

无 `scripts/`。原 `scaffold / verify / compile` 三项操作以模型指令形式留在 SKILL.md 的第一、九、十步；反驳是新增的第八步。

## 五、模型驱动的校验（替代脚本）

SKILL.md 第九步内置"验证（模型驱动）"清单，模型读取七文件后按以下标准判断，不跑脚本、不数字符（用户的草稿是用户文件，只读不写，文件名不限）：文件完整性 / claim 非空 / evidence 附链接 / style 已选 / draft 达意 / 真诚 / 写作自检已做 / 反驳已做 / 平台格式（少数派则对 `sspai-format.md` 硬规则）。任一不过回到对应步骤。

## 六、少数派格式规范的融入

- 新增 `references/sspai-format.md`：蒸馏官方风格指南 + 作者实战（frontmatter `client/platform`、图片 `![描述|宽度]`、AI 辅助披露 callout、`## 写在前面` 起手、中英文空格、直角引号、标题层级、链接文本、题图尺寸、科技名词等）。
- `style.md` 模板加"发布平台"勾选，选少数派即触发加载 `sspai-format.md`。
- SKILL.md 第七步（写作）与第九步（验证）加少数派指针。

## 七、写作工艺（全流程写作支持）

- 新增 `references/writing-craft.md`：把碎片化写作四步（捡骨头 → 搭建骨架 → 组装完整 → 持续完善）、文章骨架（写作前自问 → 一句话结论 → 开篇场景 → 主体 → 最小可交付）、句子与声音规则、起草规则、写作自检整合为模型可执行的写作支持流程。
- SKILL.md 第七步改写为"写作（全流程支持）"：读 `references/writing-craft.md`，按四步推进；AI 协助收集碎片、提议骨架、起草段落、修句润色、做写作自检；你保留最终写作权。
- 起草规则：不编来源、不编事实、推测标明、用具体例子、标注需人审核处。
- 与第八步（反驳）的区别：写作自检向内找草稿自身的声音/证据/逻辑/骨架/信噪比问题；反驳向外找反例反驳草稿。自检在前，反驳在后。
- 边界：AI 协助写作但不代笔全文——不替你做判断，不编来源，不编事实，不把推测写成事实。

## 八、环境自动探测（阶段三落地能力）

- 新增 `references/environment-detection.md`：探测信号（环境变量 / 配置目录 / Vault 特征 / 可用工具 / 上下文提示 / CC Switch（按需））+ 逐环境适配要点（Codex / Claude Code / OpenCode / Obsidian Agent Client / DSH / CC Switch 托管 / 其他）+ 通用不变量 + 探测结果记录。
- SKILL.md 设"环境自动探测与适配"段：激活时先探测、综合判断、按环境适配、一句话向用户确认；不确定则列候选请用户确认。
- 这是自动探测功能，不是手动配置；所有探测由模型读取环境得出，不跑脚本。
- CC Switch 探测（按需，仅在技术上有真实需要时）：查 ~/.cc-switch/（cc-switch.db / settings.json / skills/）。若 Quill 由 CC Switch 托管，skill 源在 ~/.cc-switch/skills/quill/（符号链接进各 app）；改 skill 本身时改源、勿改链接副本。provider 切换对写作任务无直接影响。

## 九、草稿反驳规则（阶段四落地能力）

- SKILL.md 第八步"反驳"：草稿写完后**立即**由模型找反例反驳草稿——这是规则，不是可选步骤，也不靠定期更新。
- 反例分四类：事实反例（证据错/过时/二手当一手）、逻辑反例（推理链漏洞）、范围反例（论点过宽）、价值反例（更重要视角被忽略）。
- 对每条反例判断：吸收（修正论点/补边界）/ 驳倒（给反驳理由）/ 确认破例并标明。
- 反例与处理记回 `claim.md` / `evidence.md`（潜在漏洞、待核查项），必要时把修改建议写进 `ai-draft.md`（不直接改用户草稿）。
- 反例按以下优先级寻找：① 本地（Obsidian 知识库与本地仓库）② cgartlab.com 历史案例（已发布文章）③ github.com/cgartlab 开发案例（用户 GitHub 仓库）④ 联网（通用检索）。先在自己的语料里找反例，再向外扩展。

## 十、Obsidian 适配（折叠进 references/obsidian-adaptation.md 与 SKILL.md）

- 文章单文件 + YAML frontmatter（type / status / tags / created / updated / description / published / draft / lang）。
- 状态流 idea → draft → in-progress → review → done → archived；位置随生命周期流动。
- 双链 `[[笔记]]`、脚注 `[^N]` 溯源、概念优先链接原子笔记；`_index.md` 含 `type: index` 供 Dataview 查询。

## 十一、结构性 evals

- 新增 `evals/evals.json`：7 个结构性测试用例（38 条断言），只断言机械可验证的行为——七文件结构、frontmatter 合规、文件边界（用户草稿只读）、构思提问触发、负例不触发、claim/evidence 质量底线。
- Eval 2 的 fixture `evals/files/existing-draft/`：预置 Agent 六文件 + 用户草稿 `我的文章.md`（故意不叫 draft.md），验证文件名无关检测与字节级只读。
- `evals/README.md`：运行方法（skill-creator 的 run_eval.py 依赖 claude CLI，本机无，改用 dsh headless / codex / opencode 执行）+ 本机环境绕过 + skill-creator 工具问题记录。
- 用官方 `quick_validate.py` 验证：`Skill is valid!`（需 `PYTHONUTF8=1` 绕过其编码 bug）。
- 范围边界：主观写作质量（论点是否深刻、文笔如何）不作断言，靠人工评审。
## 十二、路线图

- 阶段一（done）：模型驱动版落地，原架构保留，少数派格式规范融入。
- 阶段二（用户手动测试）：在 Obsidian + Agent Client 中实测触发与按需加载（由作者本人手动进行）。
- 阶段三（done）：环境自动探测与适配——Skill 激活时自动检测当前 harness/agent 环境（含按需探测 CC Switch 托管：`~/.cc-switch/`），按环境特征与上下文适配（安装路径、文件工具、frontmatter、CLI、skill 源位置）。见 `references/environment-detection.md`。
- 阶段四（done）：草稿反驳规则——写完 draft 后立即由模型找反例反驳草稿（事实/逻辑/范围/价值反例），吸收或驳倒，记回 claim/evidence。是 SKILL.md 第八步的规则，非定期维护任务。
- 阶段五（done）：写作工艺——references/writing-craft.md 整合碎片化写作四步、文章骨架、句子与声音规则、起草规则、写作自检；SKILL.md 第七步改为全流程写作支持。
- 阶段六（done）：构思引导——新增 references/conception-guide.md，SKILL.md 第二步用结构化提问工具引导用户定方向 / 定读者 / 定风格（三轮八问），充分利用 DSH / Codex / OpenCode 等 harness 的多选提问功能。
- 阶段七（done）：文件边界——Agent 只读写自己创建的文件夹；`claim` / `evidence` / `audience` / `style` / `_index` / `ai-draft` 由 Agent 读写，用户的草稿（文件名不限，第一步智能检测是否已有、没有则引导创建）Agent 只读绝不修改；Agent 的草稿与提议写 `ai-draft.md`，由用户决定是否采纳。新增 `assets/templates/ai-draft.md` 与示例。
- 阶段八（done）：结构性 evals——新增 `evals/`（7 用例 + fixture + README），断言文件结构、frontmatter、只读边界、提问触发、负例与最小性；官方 quick_validate 通过。
- 阶段九（done）：写作质量（最小优先）——针对「AI 产出偏长、用户要自己删减」的反馈，反转起草默认：默认交最短版本、逐句删除测试、长度预算（段 ≤5 句）、填充词禁令、禁止自加总结段；`先砍后修` 纳入持续完善；写作自检加「可删性」项。eval 7 机械核验。
- 阶段十（done）：写作质量（深度 / 声音 / 接缝）——针对「论点浅、声音不像我、结构接缝」三项反馈，`writing-craft.md` 新增三套可执行测试：**论点深度**六道测试（已知 / 机制 / 主流 / 推论 / 具体 / 换框）、**声音校准**（读作者 3–5 篇旧文提取声音指纹：句长 / 段长 / 人称 / 句式 / 节奏 / 惯用词 / 开头习惯，起草时对照 + 并排测试）、**结构接缝**六条判据（合并 / 独立 / 顺序 / 承接 / 层级 / 一节一主张）。SKILL.md 第三步加深度测试、第七步加声音指纹与接缝判据、硬规则加「反浅 / 像作者 / 接缝」三条。
- 阶段十一（done）：skill 自身工程质量——消除重复与补鲁棒性缺口，见「十三、skill 工程质量」节。
- 阶段十二（done）：吸收活人感写作（第一轮）——新增**材料门槛**（五件材料规则 + 研究/追问/缩短三种兜底，SKILL.md 第一步半 + `evidence.md` 材料清点区）、**句子级规则**十条、**多遍改稿框架**、**扩展禁用清单**（翻案腔 / 同构排比 / 抽象抒情 / 名词化 / 破折号 / 提示性冒号 / 商业黑话 / 模型路标 / 借喻包装）、**说话位置五问**（conception-guide.md）。
- 阶段十三（done）：吸收活人感写作（第二轮，深入）——① **材料身份五分法**（①可靠事实 ②机构自述 ③旁人回忆 ④作者推断 ⑤未知）与"身份决定怎么写进正文、可信度决定能不能进支撑链"两条轴，`evidence-guide.md` + `evidence.md` 模板双轴列；② **用户经历不能代写**（"看见"≠"试过"，最多问三句）；③ **正文归属与检索痕迹**（②③类首次交代归属、未知只交代一次、核验笔记不接管正文、纯公开材料时开头留一处检索痕迹）；④ **形式分流**新增 `references/form-guide.md`（十一种形式的开篇·推进·结尾·常见错误），让第二步 Q1 的类型有下游规则；⑤ 改稿第三遍补**假深刻 / 假具体 / 假口语 / 抽象名词 / 比喻换场**五类圈法，末尾加**冷读五问**；⑥ `writing-craft.md` 新增**篇章推进**（局部问题表）与**判断要带着来路与边界**；⑦ SKILL.md 新增**规则冲突优先级**（五级）与**交付规范**；⑧ 第九步验证清单从 9 项扩到 13 项。
- 阶段十四（done）：吸收活人感写作（第三轮，检测逻辑）——把其 `check_prose.py` 的**检测逻辑**改写为模型目测的「可量化自检」表（句长太齐 / 连词太多 / 长前置成分 / 重定语句 / 段落开场重复 / 段落过度单一 / 连续短促单句段 / 借喻聚集 / 金句过密 / 洞察路标超量），每项给出判据与动作；明确「只发现形状，不判断有没有人」且文体可覆盖。另补 `forum-prose.md` 的**写给眼前这个读者**（向读者说话靠解释顺序，不靠称呼）与**幽默来自降格**（落差写出来就够，笑点落下不停下来解释）。Quill 坚持无脚本，故只吸收判据不引入脚本。
- 阶段十五（done）：吸收活人感写作（第四轮，收尾）——① 改稿第二遍加**逐段材料出处标注**（只能写出"进一步解释"的段落即无新东西）；② 新增**数字写完继续走一步**（核对时间/单位/样本/口径/比较对象，百分比与百分点分开；数字后接"对读者意味着什么"，一个案例只说明一角）；③ 新增**没有亲历时的范围纪律**（只抓最有把握的一两个原因，文章不必包办整个问题；抽象解释后尽快落到具体动作）。至此 human-writing 中适配 Quill 非虚构长文定位的部分已全部吸收完毕。
- 阶段十六（done）：知乎回答形式深化——按用户实际使用场景，把 `form-guide.md` 的知乎一节从 4 条扩为完整写法：**先回答 → 后解释 → 最后给动作**的三段结构（附结构示范）、"动力来自为什么和你怎么知道"、**没有亲历时的处理**（走一遍可核验的普通流程并标明是常见情形，不伪造精确经历；只抓一两个原因，不必包办整个问题）、短答与长文的**规模分流**（短答直接用规则写，不必建项目文件夹）。
- 阶段十七（done）：示范文章合规重写 + 禁令适用范围澄清——发现 `assets/examples/sample-article/` 是按旧规则写的，正好踩在新加的形式级禁令上（`draft.md` 5 处破折号、4 处提示性冒号、结尾翻案腔"这不是一场裁员，这是一次职责的重新分层"、护城河/护栏/翻车等借喻；`ai-draft.md` 3 处破折号）。示范在教模型做 skill 明令禁止的事，已重写 `draft.md` / `ai-draft.md` / `claim.md`（保留论点、论据与结构，只换表达），三个文件经禁令清单核验为零命中。同时在 SKILL.md 禁用清单加**适用范围**说明：形式级禁令覆盖成稿（标题/小标题/正文/图片说明/引用转述），Agent 的结构化工作文件（字段、清单标签、链接表）不受标点禁令约束，但其中的成段议论与起草片段仍按成稿标准写。
- 阶段十八（done）：**ai-draft 改为 Agent 的完整草稿**——行为调整：Agent 按自己的理解写出一篇完整文章（标题、开篇、正文、结尾齐全）放进 `ai-draft.md`，用户决定采纳多少。此前 `ai-draft.md` 是"碎片收集 + 骨架提议 + 段落起草 + 修句建议 + 反驳记录"五段建议清单。连带改动：① 模板与示范改为「全文 + 起草说明 + 对你草稿的建议 + 反驳记录」，frontmatter 加 `based-on: [claim, evidence, audience, style]`；② `writing-craft.md` 碎片化写作四步的"模型角色/不要做"反转——原写"不要直接生成完整散文段落冒充你的声音"、"不要在这一步就生成完整段落"，现改为"写出完整草稿写进 `ai-draft.md`，不要写进用户的文件"；③ 起草规则标题改为"写 Agent 草稿时"，长度预算里"只起草用户要求的那一部分"改为"草稿写成一篇，不要写成建议清单"；④ SKILL.md 第七步、第八步、目录约定、核心理念与第九步验证（新增"ai-draft 成篇"项）同步；⑤ 读取边界不变——用户草稿仍只读不写（用户确认维持现状，见阶段七）。

## 十三、skill 工程质量

**单一事实源**（同一条规则两处定义必然漂移）：

| 内容 | 唯一归属 |
|------|---------|
| 通用写作硬规则（最小优先 / 反浅 / 像作者 / 接缝 / 声音 / 事实 / 禁用清单） | `SKILL.md`「风格与禁用（硬规则）」——常驻加载，符合作者「禁止清单 > 鼓励清单」 |
| 规则冲突优先级与交付规范 | `SKILL.md`「规则冲突时的优先级」「交付」 |
| 构思提问的三轮八问与说话位置五问 | `references/conception-guide.md` |
| 写作测试方法（论点深度六道 / 声音校准四步 / 句子级规则十一条 / 篇章推进 / 判断边界 / 读者与会话感 / 结构接缝六条 / 起草规则 / 六遍改稿 + 冷读 + 可量化自检 / 写作自检） | `references/writing-craft.md` |
| 材料门槛（五件材料规则 + 缩短兜底） | `SKILL.md`「第一步半：材料清点」+ `evidence.md` 模板 |
| 材料身份五分法 / 用户经历不能代写 / 正文归属 / 检索痕迹 | `references/evidence-guide.md` + `evidence.md` 模板 |
| 形式分流（十一种形式的开篇·推进·结尾·常见错误） | `references/form-guide.md` |
| 少数派排版细则（中英文空格 / 直角引号 / 图片语法 / 引用） | `references/sspai-format.md` |
| Obsidian 约定（frontmatter / 双链 / Dataview） | `references/obsidian-adaptation.md` |

**已消除的重复**：

- `SKILL.md` 第二步的八问列表（原与 conception-guide.md 完全重复）→ 改为三轮摘要 + 指针
- `writing-craft.md` 的硬规则段（原与 SKILL.md 硬规则约 90% 重复）→ 改为「硬规则归属与排版细则」指针，SKILL.md 为唯一事实源
- 中英文空格 / 直角引号（原三处重复）→ 归 `sspai-format.md`

**已补的鲁棒性缺口**：

- 声音校准在取不到作者语料时（离线 / 本地无语料）必须**明说"这版会比较通用"**，不得假装有指纹、不得静默退回通用 AI 腔；可让用户粘贴 2–3 句旧句当样本。

**成本**（字符数，≈token 代理）：`SKILL.md` 12553（常驻）；references 合计 31089（按需全载）；走完十步的典型 session 约 38.3K（常驻 + 激活探测 + 构思 + 证据 + 形式 + 工艺），面向少数派再加 `sspai-format.md` 约 41.0K。
## 十四、已知边界

- "发布后回看"靠日历提醒，模型替不了。
- 风格契约与少数派规范需定期对齐官方手册更新（手册更新日期 2026-09-18）。
- 环境自动探测依赖模型能读到环境信号；信号不足时需用户确认，不默认假设。
- skill 不判断"这个观点要不要发"——那是创作者的权力。
- Agent 绝不修改用户的草稿——只读不写（文件名不限）；Agent 的草稿写 `ai-draft.md`，由用户决定是否采纳。
- 材料门槛依赖用户/模型诚实清点——"研究后仍不足五件"是模型判断，不是硬校验。
- 句子级规则与禁用清单在起草时由模型执行，无脚本自动检查——模型能力决定执行质量。
- 版本号手写同步两处（`SKILL.md` 与本文件），无自动化校验——改版本时必须两处都改，并核对 `CHANGELOG.md`。

## 十五、发版流程

手动发版，不跑脚本。五个动作，缺一不可。

### 1. 改版本号（两处，必须同步）

| 位置 | 行 | 字段 |
|------|-----|------|
| `SKILL.md` | 6 | `metadata.version` |
| `writing-skill-dev-doc.md` | 3 | `**版本**：` |

```powershell
# 改完自检，两处必须一致
$a = (Select-String -Path SKILL.md -Pattern 'version:').Line -replace '.*"(.*)".*','$1'
$b = (Select-String -Path writing-skill-dev-doc.md -Pattern '^\*\*版本\*\*').Line -replace '.*：(\S+).*','$1'
if ($a -eq $b) { "OK  $a" } else { "MISMATCH  SKILL=$a  dev-doc=$b" }
```

### 2. 写 CHANGELOG

在 `CHANGELOG.md` 顶部加一条，格式见现有条目。新版本在文件最上方（倒序）。

版本号语义：`0.y.z` 尚未稳定，破坏性变更照常发生；`1.0.0` 起承诺稳定性。

### 3. 提交

```
git add -A
git commit -m "feat: v<版本> — <一句话说明这版改了什么>"
```

### 4. 打 tag 并推送

```powershell
git tag -a v<版本> -m "v<版本>"
git push origin main --follow-tags
```

打 tag 前确认工作区干净、版本自检通过。

### 5. 发布 GitHub Release

```powershell
# 用 --notes-file 读 CHANGELOG 片段，避免引号在命令行里被转义
gh release create v<版本> --title "v<版本>" --notes-file <片段文件>
```

### 装成 skill 之后

`~/.dsh/skills/quill`（或其他 harness 的 skills 目录）若是指向本仓库的 junction / symlink，push 完即生效，无需重装。复制安装的用户需要重新复制。

### 补历史 tag

本项目从 0.1.0 起打 tag。0.1.0 之前的 2.x 迭代未打 tag，那套编号也不作为版本记录——需要回溯时用 `git log --oneline` 查提交。











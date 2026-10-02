# Skill 的自动化学习与持续改进：方法与案例

调研时间 2026-10-03。问题只有一个：**一个 skill 怎么用 GitHub Actions 让自己持续变好，而不是靠人想起来去改。**

答案不是"跑个测试"。是把 skill 当成**可执行产物**，像代码一样给它三样东西：能自动跑的机械断言、能自动量的效果指标、以及从真实使用里自动收集的反馈信号。

---

## 一、先说结论

三条独立的轴，缺一不可：

| 轴 | 回答的问题 | 能不能自动判 | 成本 |
|---|---|---|---|
| **静态闸门** | 文件在不在、引用断没断、规范合不合 | 能，完全确定性 | 0 |
| **执行闸门** | agent 真跑一遍，承诺守没守住 | 能（机械部分） | 有模型调用 |
| **效果闸门** | 装了 skill 到底比不装强多少 | 能，但**必须跑基线** | 约 2 倍 |

第三条最容易被跳过，也最要命。理由见第三节。

---

## 二、静态闸门：把 skill 当代码扫

几乎所有成熟项目都有这一层，而且实现惊人地一致。

**Agent Skills 官方规范**（[agentskills.io/specification](https://agentskills.io/specification)）本身就把约束写死了：

- `name` ≤ 64 字符，只允许小写字母、数字、连字符
- `description` ≤ 1024 字符
- `compatibility` ≤ 500 字符
- `metadata` 的值必须是字符串
- SKILL.md 建议 < 500 行 / < 5000 token（渐进式披露）
- 文件引用用相对路径，**只允许一层深**
- 官方提供 `skills-ref validate ./my-skill` 做校验

**[damanisme/agentskills-ci](https://github.com/damanisme/agentskills-ci)** 把这套做成了可复用的 composite action，`pipx install agentskills-ci`：

```yaml
- uses: damanisme/agentskills-ci@main
  with:
    path: skills
    min-score: "80"   # 每个 skill 0-100 分，低于阈值就红
```

它查的东西值得直接抄：frontmatter 合规、`references/` `templates/` `scripts/` `assets/` 里**被引用但不存在**的路径、`rm -rf` / `curl | bash` 这类危险命令、没有审批闸门的副作用指令。还能生成 badge。

**[letsloose501/sqs-skills](https://github.com/letsloose501/sqs-skills)** 把它推得更远：101 条编码规则，每条规则都有一个测试用例在盯着它（"each one watched firing on a test case"），CI 里有一条专门的 job 叫 **"no rule left unobserved"**。它还有两个别处没见的自律：

```yaml
# Actions 钉到 commit，tag 写在注释里：tag 可以被移动，commit 不能
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7
```

以及一个叫 self-check 的 job——**用这个 linter 去扫它自己**。注释写得很直白："A linter whose own repository does not pass it is a linter nobody has read."

> **可复用的模式**：静态闸门的价值不在于多写规则，而在于**规则必须被测试覆盖**。一条没人验证过的检查规则，本身就是第二个可能失灵的东西。

---

## 三、执行闸门：跑起来，然后**跑两遍**

这是本次调研最重要的发现。

### 3.1 Skill Lift：装 skill 到底有没有用

**NVIDIA 等人的 ACES 论文**（[arXiv:2608.20614](https://arxiv.org/abs/2608.20614)，*Evaluating Skills, Not Just Agents*，已发表于 Agent Skills '26 / ACM CAIS 2026 与 KDD 2026 Workshop）在 145 个真实 skill 上做了配对实验：

- 947 组配对样本，58/64 个生产 skill，4 个 harness
- **平均 composite Skill Lift = 0.2134**（95% CI [0.1967, 0.2301]）
- composite lift 为正的配对样本只占 **72.8%**
- 静态扫描闸门和 LLM 评判量的**不是一回事**：Spearman ρ = **0.14**

两个后果，都很实际：

1. **约四分之一的 skill 对最终产物没有贡献，甚至有害。** 只跑带 skill 的那条腿，测试永远是绿的，你永远不会知道这件事。
2. **静态扫描过了不代表 skill 有用。** ρ=0.14 意味着结构合规与实际效果几乎正交。所以两层闸门必须都有，不能拿一层顶替另一层。

**Skill Lift 的定义**：固定 task、harness、workspace、scorer，只换 SKILL.md，量差值。

### 3.2 [olaservo/skilljack-evals](https://github.com/olaservo/skilljack-evals)

目前把这件事工程化做得最完整的开源项目（SkillsBench 风格）。它明确写着服务两个工作流，同一套架构：

- **Authoring loop（TDD for skills）**：先写 task，看它挂，再改 SKILL.md，直到 eval 过
- **CI benchmark gating**：同一批 task 跑在 GitHub Actions 上，带阈值

四个指标：Resolution Rate、Pass@k、Skill Lift、Skill Invocation Rate。

关键的工程细节，每一条都是踩过的坑：

- **基线是默认开的**。任务带 skill 时自动跑一条"同样 prompt、不挂 skill"的对照腿，用 `--no-baseline` 关掉。`--compare-skill <dir>` 可以换成另一个版本做 A/B。
- **阈值 fail closed**。设了 `--threshold-lift` 却没跑基线（lift 不可得），运行**直接失败并说明原因**，而不是默默放过。
- **Oracle gate**：`validate` 会先跑一遍 `oracle/solve.mjs` 的参考解，要求 verifier 打出 reward 1.0。这是防"任务本身做不到 / verifier 写错了"。
- **Judge 只诊断，不放行**。`--judge` 加 LLM 评判（adherence、output-quality、失败归类到 `discovery_failure` / `false_positive` / `instruction_ambiguity` / `missing_guidance` / `agent_error`），但**永不改变 pass/fail**。
- **反触发任务**：`expect_skill_invocation: false` 专门测误触发。skilljack 还会警告"如果一个 task 的唯一信号就是 skill 被调用了，那基线会平凡通过，Skill Lift 就没有意义"。
- **反馈闭环**：`--generate-feedback` 跑完生成一份人填的反馈模板，下次 `--feedback <file>` 喂回 judge prompt。
- **缓存按内容寻址**：key 含 skills hash，改了 SKILL.md 自动失效，只付变化那部分的钱。

它自带的 GitHub Action 输出：`passed` / `resolution-rate` / `pass-at-k` / `skill-lift` / `invocation-rate` / `has-regressions`，读 `summary.json`，可以和上一次运行的产物做 diff。

**安全提醒值得单独抄**：它的 README 坦白 CLI runner 会自动批准每一次工具调用，**在宿主机上没有写限制**。只有 `claude-sdk` runner 会用 PreToolUse hook 限制写路径。跑不可信的 skill/task 时这是真实的风险。

### 3.3 [promptfoo](https://github.com/promptfoo/promptfoo) —— 最"CI-native"的一个

三个东西可以直接抄：

**(a) PR 上的 before/after 对比**。[promptfoo-action](https://www.promptfoo.dev/docs/integrations/github-action/) 在每个改了 prompt 的 PR 上自动跑前后对比，并把结果贴回 PR：

```yaml
on:
  pull_request:
    paths: ['prompts/**']
jobs:
  evaluate:
    permissions:
      pull-requests: write      # 用来往 PR 上贴评论
    steps:
      - uses: promptfoo/promptfoo-action@v1
        with:
          prompts: 'prompts/**/*.json'
          config: 'prompts/promptfooconfig.yaml'
          cache-path: ~/.cache/promptfoo
```

**(b) 专测 skill 的指南**。[Test Agent Skills](https://www.promptfoo.dev/docs/guides/test-agent-skills/) 给出三个问题：agent 该不该用这个 skill？用了之后结果好不好？相邻的 skill 会不会抢活？

做法是同一批 task 对着两个版本并排跑，**模型、任务文件、权限全固定，只换 SKILL.md**。断言分几层加：

```yaml
defaultTest:
  assert:
    - type: skill-used          # 分辨"答对了"和"按你设计的流程走出来的"
      value: review-standards
    - type: javascript          # 给召回率打分，而不是只判对错
      threshold: 0.7
      value: |
        const r = typeof output === 'string' ? JSON.parse(output) : output;
        const hits = context.vars.expectedIssues.filter(id => (r.issues||[]).some(i=>i.id===id));
        return { pass: hits.length/context.vars.expectedIssues.length >= 0.75, score: hits.length };
    - type: cost
      threshold: 0.50
    - type: latency
      threshold: 120000
```

两个 provider 用 YAML anchor 共用同一个输出 schema，`working_dir` 指向各自的 fixture 目录。同一份 eval 也能换 Codex SDK / OpenCode SDK 跑——这就是"跨 harness 可比"。

**(c) 一条很实用的教学原则**（它自己的 skill 里反复强调）：**确定性断言优先**。能用 `contains` / `is-json` / `javascript` 判的，不要用 `llm-rubric`。它还专门指出一个反模式——"只检查输出是不是合法 JSON"的断言，对错误答案一样会通过。

> promptfoo 自己也是 skill 的重度用户：它发布 `promptfoo-evals` 等四个 skill，专门教 agent 怎么写 eval（文档：[Agent Skills for Evals and Red Teaming](https://www.promptfoo.dev/docs/integrations/agent-skill/)）。

---

## 四、反馈轴：从真实使用里长出来的改进

前三层都是"我们自己写测试"。第四层是"看用户实际怎么用，然后改"。这一层目前最不成熟，但思路最值得注意。

**[okdk7788/skill-evolution](https://github.com/okdk7788/skill-evolution)** —— 把 GEPA（Genetic-Pareto）式的反思优化做成 Claude Code 插件，三步：

1. **结果遥测**：`Stop` hook 记录每次用完某个 skill 之后的工作**像成功还是像失败**（后续出现 `is_error` 工具结果，或用户纠正 ⇒ 判失败），写进 `skill_outcomes.json`。它是纯记录器，不影响任何别的行为。
2. **反思式优化**：`/optimize-skill` 收集该 skill 的失败轨迹 → 生成 2–3 个候选改写 → 按失败原因构建 rubric 用 LLM 评判打分 → 取 Pareto 最优（质量优先，体量作 tiebreak）→ **给人看 diff，人批准了才应用**。
3. **`/evolution-status`**：按 `使用次数 × 失败率` 排序，告诉你要不要进化它。

它有三条设计原则值得原样抄进我们的纪律里：

- **绝不自动提交**。"mutation/evaluation/selection 是自动的，实际改文件必须人批。"
- **没数据就不进化**。没有失败轨迹时 `/optimize-skill` 直接停下，而不是猜。
- **归因要诚实**：这是个"这段工作有没有干净收尾"的粗信号，不是因果证明。

**[letsloose501/sqs-skills]** 走的是另一条：**读本机 Claude Code transcript**（只读、不外传），看 agent 实际加载了哪些 skill、哪些脚本反复被读、哪些调用反复失败，然后列出"该修哪个 skill"。还有一本 **mistakes journal**——每次 agent 自我发现犯的错记四行，评审后变成规则和闸门。

**[selftune-dev/selftune](https://github.com/selftune-dev/selftune)** 做的是更窄一件事：**自动重写 skill 的 description**，让触发条件贴近用户真实的说话方式。它盯的是"undertriggering"——skill 从没被触发，所以没有任何报错，也没有任何信号。

**[Evol-ai/SkillCompass](https://github.com/Evol-ai/SkillCompass)** 六维打分 + 版本追踪，slogan 是"评估 → 找最弱的一环 → 修 → 证明修好了 → 下一环"。

---

## 五、落到 quill：我们实际做了什么

调研的结论不是"要不要上 CI"，而是"skill 的质量有三个独立的失效面，quill 一个都没被机械地守过"。仓库里原先有 7 条 eval，但**没有任何机制会执行它们**，也没有 `.github/`。

于是按上面三层建了三样东西，全部零依赖、Node 18+。

### 1. `scripts/validate-skill.mjs` —— 免费的那道，每次 PR 必跑

18 项检查，分四组：

- **A 规范**：`name` / `description` / `license` / `metadata` 是否合规，SKILL.md 行数与 token 估算
- **B 完整性**：SKILL.md 引用的每个路径是否存在；`references/` 里每个文件是否登记进「渐进式披露」（**没登记 = Agent 永远不会加载它**）；版本与日期是否与 CHANGELOG 对得上；README 目录树的条目数是否与仓库现状一致
- **C 自洽**：把 SKILL.md「风格与禁用」里的禁用词**自动抽出来**，扫示例文章的正文。范本里出现禁用词，等于在教模型写违例稿
- **D eval**：id 唯一、每条 eval 至少有一条机械断言、断言类型必须真的被实现（防死断言）、fixture 存在、README 用例数一致、必须有负例

### 2. `evals/check-workspace.mjs` —— 断言执行器

每条 eval 现在有两层断言：

- `checks`：**机械可跑**，CI 判定。回答"做没做"
- `expectations`：散文断言，机械判不了，交给人或模型裁判。回答"做得好不好"

这正是 skilljack 的 `checks:` / `assertions:` 和 promptfoo 的"确定性断言优先"。**只有 expectations 的 eval 会被静态校验拦下**，因为它等于没测。

新增的核心能力是 `unchanged`：跑之前给受保护文件拍 sha256 快照，跑完比对。这就是 **"Agent 不碰你的草稿"这条承诺的机器验证方式**——以前它只是一句写在 SKILL.md 里的话。

### 3. `.github/workflows/`

- **`skill-quality.yml`**：push/PR 触发，只要 Node，不要 key。除了跑校验器，还跑一条**校验器自检**——故意往 SKILL.md 塞一个坏路径，确认校验器确实会报错。失灵的检查器比没有检查器更危险。
- **`skill-evals.yml`**：手动或每周。`evals/run.mjs` 为每条 eval 建两个独立工作目录，一条挂 skill、一条不挂，同模型、同 fixture、同 prompt、同断言，**唯一变量是 SKILL.md**。`--report` 出 `summary.md`，按 `MIN_RESOLUTION` / `MIN_LIFT` 判定放行。

`run.mjs` 继承了三条外部经验：

- **基线默认开**，逐条 eval 标出「这条是 skill 挣来的」/「装了 skill 反而挂」/「同分，这条拦不住它」
- **fail closed**：设了 `MIN_LIFT` 却没跑基线 ⇒ 判定失败，而不是跳过
- 报告写进 `$GITHUB_STEP_SUMMARY`，原始产物上传 artifact

---

## 六、没采纳的，和它的理由

- **skilljack-evals 本身**：模型最完整，但它是 TypeScript 项目 + npm 依赖，引入成本远大于收益；且它的 runner 需要 `ANTHROPIC_API_KEY` 与 harness 特权。对一个写作 skill 来说，先把确定性能抓的那部分拿到手更划算。
- **promptfoo**：生态和断言类型最成熟，但它的配置面向 prompt / RAG / 应用，测"七文件结构有没有建对"用不上它那套。**留作将来要量主观写作质量时的选项**——那时它的 `llm-rubric` 加来源内联才有意义。
- **SQS 的 101 条规则**：覆盖面远超需要，且规则取向偏"安全 / 结构"，与写作质量无关。
- **自动改写 skill 文本（selftune / skill-evolution 的改写环节）**：全部要人批准才落盘。这个纪律我们认同，但**前提是先有可信的失败信号**——quill 目前还没有。第 2 层闸门跑出稳定的失败分布之前，接自动改写等于让噪声去改规则。

---

## 七、已知的债

**SKILL.md 正文约 8030 token，超出规范建议的 5000。** 静态校验器把它报成警告而非错误，因为拆它是独立的一次重构，不该跟这次建闸门混在一起。

拆的方向已经清楚：把「风格与禁用」整段和句子级规则下沉到 `references/`，SKILL.md 只留纲领 + 工作流 + 指针。**但要注意反向成本**——禁用清单是这套 skill 最有辨识度的部分，放进 reference 后，Agent 在起草期可能不去读它。0.3.0 那次把禁令拆成 A/B 两档时已经踩过"过度执行会改硬"的坑，拆之前应当先量一次触发后 reference 的实际加载率。

其余待办：eval 4 需要能应答提问的 harness，headless CI 只能验到"建了项目、没抢先写正文"；`expectations` 那层散文断言目前仍无自动化裁决。

---

## 来源

| 主题 | 来源 |
|---|---|
| 效果闸门的方法学与数据 | [arXiv:2608.20614](https://arxiv.org/abs/2608.20614)（ACES）· [NVIDIA/SkillEvaluator](https://github.com/NVIDIA/SkillEvaluator) |
| 执行闸门工程化 | [olaservo/skilljack-evals](https://github.com/olaservo/skilljack-evals) |
| CI 原生 eval / skill 对比 | [promptfoo](https://github.com/promptfoo/promptfoo) · [Test Agent Skills](https://www.promptfoo.dev/docs/guides/test-agent-skills/) |
| 静态闸门 | [damanisme/agentskills-ci](https://github.com/damanisme/agentskills-ci) · [letsloose501/sqs-skills](https://github.com/letsloose501/sqs-skills) |
| 反馈与自我进化 | [okdk7788/skill-evolution](https://github.com/okdk7788/skill-evolution) · [selftune-dev/selftune](https://github.com/selftune-dev/selftune) · [Evol-ai/SkillCompass](https://github.com/Evol-ai/SkillCompass) |
| 格式规范 | [agentskills.io/specification](https://agentskills.io/specification) |
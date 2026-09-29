# AI/ML SVG Generation — State of the Art in **Clean, Minimal Path Data**

**Desk research briefing.** Focus: how modern text-to-SVG and image-to-SVG systems produce *compact, clean, human-looking* path data — not marketing claims.

---

## 0. Method, access constraints, and verification status

**Access note (affects reproducibility):** the session's `web_search` tool was rate-limited/unavailable for the whole run (HTTP 429 / no `web_search_tool_result`), and `github.com` HTML returned only a proxy stub. I therefore worked through:

- **arXiv API + arXiv full-text HTML** (`arxiv.org/html/<id>`) → full method sections and metric tables. This worked for essentially every paper.
- **GitHub REST API** (`api.github.com/repos/<r>/readme`, base64-decoded) and, once the API rate limit hit, **jsDelivr CDN** (`cdn.jsdelivr.net/gh/<owner>/<repo>@<branch>/README.md`, incl. raw source files).

Everything quoted below comes from those artifacts. Local copies of all fetched material are in `.research/svg-gen/` (`readmes/`, `fulltext/`, `arxiv/`).

**Trust markers:** ✅ = read directly in the primary source. ⚠️ = single-source, inferred, or a competing paper's re-measurement. ❓ = could not verify.

**Terminology warning that matters a lot:** every "token count" below is from a **different tokenizer**, so cross-paper token numbers are only comparable *within* a paper. I flag the source of each number.

---

## 1. Executive summary — the actionable techniques

Ranked by how much they actually reduce path data.

| # | Technique | Who does it | Concrete effect |
|---|---|---|---|
| 1 | **Use semantically correct SVG primitives instead of `<path>`** (circle, rect, ellipse, polygon, text, gradients) | **StarVector** (unique here) | ✅ ~**3k tokens vs ~18k** for LIVE, ~**4.2k–20k** for VTracer; a `<circle/>` replaces a long path |
| 2 | **Curve fitting with Schneider (cubics) + Ramer–Douglas–Peucker (polylines)**, with **corner splitting** and **max-segment-length capping** | **DeepSVG** (explicit); **vtracer** (`--simplify`, "paper.js-style") | ✅ vtracer: "fewest cubics within this tolerance… **typically halving file size**" |
| 3 | **Semantic-aware re-fit / topology sanitisation** (self-intersection loss, one path per semantic component) | **LIVE** (`Xing` loss), **SVGDreamer** (`SIVE`), **Chat2SVG** | ✅ prevents tangled/jagged paths; Chat2SVG optimises for *path regularity* explicitly |
| 4 | **Canonicalise + normalise geometry**: one atomic command set, relative coords, rounded precision, flatten `<defs>`/`<class>` | **OmniSVG** (M/L/C/A/Z + F via `picosvg`), **SVGFusion**, **LLM4SVG** | ✅ SVGFusion: `<path>` coordinates **~11.7M → ~1.8M** (~6.5×) |
| 5 | **Tokenise at a *structural* level, not character level** — group a command with its coordinates | **HiVG** (segment tokens), **IconShop** (2D→1D row-major), **StrokeNUWA** (stroke tokens), **SVGFusion** (N=512 matrix) | ✅ IconShop: row-major `x*w+y` "**roughly halves the length of the token sequence**"; StrokeNUWA: **6.9% compression ratio**; HiVG: ~**9 atomic tokens** per segment token |
| 6 | **Explicit length/complexity penalty in the loss or RL reward** | **RLRF** (StarVector follow-up) | ✅ quadratic penalty on token length; on SVG-Emoji: MSE 6.39→4.93, DINO 90.99→93.50 **and ≈1,500 fewer tokens** |
| 7 | **Prune/remove unused primitives** (reinitialise low-opacity or tiny paths out of the SVG) | **VectorFusion**, **SVGDreamer** | ✅ +3.0% R-Precision from scratch, +12.5% when initialised from LIVE |
| 8 | **Deterministic post-hoc optimiser** (SVGO / scour / vtracer `--optimize`, `--path-precision`) | SVGO, scour, vtracer | ✅ SVGO targets "editor metadata, comments, hidden elements, default or suboptimal values… safely removed or converted without impacting rendering" |

**Key structural insight:** the single biggest lever is **not** curve fitting — it is *primitive selection*. A circle encoded as a path is dozens of commands; a circle encoded as `<circle>` is one element. Most of the field (DiffVG/LIVE/VectorFusion/SVGDreamer lineage) is architecturally **incapable** of this because differentiable rasterisers only parameterise paths.

**Second insight:** the field has quietly converged on a **fixed primitive budget** (fixed number of paths/commands) as its complexity knob, then fights the consequences. Every optimisation-based method either over-generates (huge token counts) or under-represents.

---

## 2. Output format map — what each system actually emits

| System | Element/command vocabulary | Typical budget / counts |
|---|---|---|
| **StarVector** ✅ | **Full SVG**: `<path>`, ellipse, rect, polygon, **`<text>`**, gradients | Avg. **~3k tokens** output; GT test sets avg **2,822–5,618 tokens** |
| **OmniSVG** ✅ | 5 atomic path commands **M, L, C, A, Z** + special **`F`** (hex fill) token | 4B: **3.8k tokens**; 8B: **5.7k tokens** (MMSVG-Bench) |
| **LLM4SVG** ✅ | **55 learnable semantic tokens** = 15 tag + 30 attribute + **10 path-command** tokens | 250k-SVG corpus; 4,096-token training cap |
| **Chat2SVG** ✅ | rect, circle, ellipse, line, polyline, polygon, **path ≤5 commands**; then converts *everything* to cubic Bézier | ✅ **0.6k–1.0k tokens** (lowest LLM-based, per OmniSVG) |
| **IconShop** ✅ | **M, L, C only**, all attributes stripped | max **512 commands**/icon sequence; 100×100 grid → 10,007-token vocab |
| **HiVG** ✅ | path commands incl. `c` (cubic), `a` (arc), `s` (smooth) | segment tokens ≈ **9 atomic tokens** median; curriculum stages 273→656 tokens, 3.5→6.7 paths, 54.8→144.2 commands |
| **SVGFusion** ✅ | broadest *canonical* set: **circle, rect, path with M/L/C/Q/A/Z** | **N = 512** max commands, structured matrix |
| **DeepSVG** ✅ | M, L, C (arcs/other shapes converted) | ≤8 groups, ≤30 commands/path |
| **LIVE** ✅ | **closed cubic Béziers only**, 4 segments/path default | path schedule `min(2^(i-1), 32)`; tested 5/16/32/60 and 8→256 paths |
| **DiffVG** ✅ | whatever you parameterise (closed Béziers, polygons, circles, gradients) | user-set; StarVector tested 15/60/120 paths |
| **VectorFusion** ✅ | closed cubics (icon), open cubics (sketch), square polygons (pixel art) | icons **64 paths × 4 segments**; sketches 16 strokes × 5 segments; pixel art 32×32 grid |
| **SVGDreamer** ✅ | primitive *type* is the style control (closed filled / open / polygonal) | tested **128 / 256 / 512 / 768 paths** |
| **StrokeNUWA** ✅ | "stroke tokens" over M/L/C | VQ codebook 4,096; **CR 6.9%**; CR-2/CR-4 variants |
| **vtracer** ✅ | cubic splines (`--mode spline`), polygons, pixel | ✅ emits **~18 paths** on StarVector's benchmark (vs AutoTrace ~**3k paths**) |
| **fogleman/primitive** ✅ | triangles, rects, ellipses, circles, rotated rects/ellipses, polygons, **beziers** (`-m 6`) | ✅ "Around **50 to 200 shapes** are needed to reach a result that is recognizable yet artistic and abstract" |
| **AutoTrace** ✅ | its own curve fitting | ✅ ~**3,000 paths** on StarVector's benchmark; 30.8k–94.0k tokens |
| **Potrace** ✅ | its own polygon+curve pipeline | 4.2k–12.0k tokens; ~10 s/sample |

---

## 3. The compactness league table (⚠️ heterogeneous tokenizers)

**Do not compare across rows blindly** — the tokenizer differs, and different papers measure on different datasets.

### 3a. OmniSVG's Table 2 — `# Tokens` (Qwen2.5-VL tokenizer, MMSVG-Bench) ⚠️

Some rows belong to different MMSVG subsets (Icon / Illustration / Character); I could not fully disambiguate the row grouping from the flattened table, so treat the *ordering* as reliable and exact pairing to a subset as uncertain.

| Method | # Tokens |
|---|---|
| DiffVG | **322.0k** |
| SVGDreamer | **132.0k** |
| VectorFusion | **66.1–66.2k** |
| LIVE | **52.2–52.5k** |
| Vtracer | **52.4k** |
| OmniSVG-L (8B) | **5.7k** |
| OmniSVG (4B) | **3.8k** |
| IconShop | **2.0–2.6k** |
| StarVector (8B) | **2.0k** |
| Chat2SVG | **0.6–1.0k** |
| GPT-4o | **0.3k** |

> Note the ~1,000× spread between DiffVG (322k) and GPT-4o (0.3k). GPT-4o's 0.3k also lines up with the widespread criticism that LLMs produce *oversimplified* SVGs.

### 3b. StarVector Table 1 — `Tokens` per dataset (StarVector tokenizer) ✅

Ground-truth averages (test sets): SVG-Stack **2,822** · SVG-Fonts **3,136** · SVG-Icons **3,305** · SVG-Emoji **5,618**

| Method | Stack | Fonts | Icons | Emoji |
|---|---|---|---|---|
| AutoTrace † | 59.1k | 30.8k | 56.7k | 94.0k |
| Potrace † | 7.5k | 4.2k | 12.0k | 9.7k |
| VTracer † | 9.7k | 4.5k | 20.0k | 15.7k |
| Im2Vec | 4.3k | 4.3k | 4.3k | 3.8k |
| LIVE | 18.3k | 18.3k | 18.2k | 18.3k |
| DiffVG | 19.7k | 19.7k | 19.8k | 19.7k |
| GPT-4-V | 443 | 279 | 524 | 672 |
| **StarVector-1B** | 3.7k | 2.4k | 3.5k | 4.8k |
| **StarVector-8B** | 5.3k | 3.0k | 2.8k | 6.7k |

✅ *"methods that perform well on MSE tend to utilize a large number of tokens, whereas StarVector shows remarkable compression."*
✅ *"LIVE's SVG outputs average around 18k tokens, while VTracer varies between 4.5k and 20k tokens. In contrast, StarVector averages approximately 3k tokens, closely matching the ground truth token count."*

⚠️ **Honest caveat:** StarVector-8B's own counts (3.0k–6.7k) sometimes *exceed* the ground truth (2,822–5,618). "Closely matching" is generous; on SVG-Emoji it is 6.7k vs 5,618 GT. It is dramatically better than LIVE/DiffVG/VTracer, not *minimal in absolute terms*.

### 3c. RLRF Table 1 — `Code Eff.` = negated mean (GT − predicted) token delta ✅

*"Positive values indicate more compact outputs. Ideally, the score is near zero."* Test set: SVG-Stack-Hard.

| Method | MSE | SSIM | DINO | LPIPS | Code Eff. | Time (s) |
|---|---|---|---|---|---|---|
| Qwen2.5VL-32B | 23.62 | 55.46 | 82.38 | 35.83 | +1.3k | 58 |
| GPT-4o-1120 | 16.92 | 66.91 | 89.00 | 27.55 | +1.3k | 60 |
| Claude 3.7 Sonnet | 17.73 | 69.33 | 79.80 | 28.42 | +1.4k | 62 |
| Im2VEC | 18.10 | 76.50 | 69.20 | 29.10 | −4.3k | <1 |
| Potrace | 8.15 | 77.28 | 89.23 | 19.10 | **−7.3k** | 12 |
| VTracer | 4.25 | 87.94 | 95.75 | 11.66 | **−12.9k** | <1 |
| DiffVG | 6.64 | 81.23 | 86.12 | 20.5 | **−19.7k** | 31 |
| LIVE | 2.22 | 88.11 | 93.45 | 7.23 | **−18.3k** | **1,243** |
| SuperSVG | 3.05 | 83.30 | 82.70 | 13.50 | **−65.6k** | <1 |
| PyAutoTrace | 4.71 | 87.44 | 95.68 | 10.71 | **−99.7k** | <1 |
| StarVector-1B-Base | 4.60 | 87.00 | 96.00 | 9.22 | **−800** | 64 |
| **+RLRF** | **3.46** | **88.00** | **98.00** | **7.51** | **−127** | 23 |

✅ The cleanest single picture of the fidelity↔verbosity trade-off: image-processing methods are best on pixel metrics and **60–100k tokens too long**; RLRF moves StarVector from −800 to −127 (≈**6× closer to human-length**).

### 3d. Beyond Pixels / S2VG2 — file size and tokens ✅

| Method | Mean size (bytes) | Mean tokens |
|---|---|---|
| **S2VG2** | **390.5** | **186.7** |
| LIVE | 6,776.2 | 3,625.0 |
| DiffVG | 28,354.4 | 15,736.1 |

✅ That is a **72× file-size** and **84× token** gap between DiffVG and S2VG2.

### 3e. Other hard numbers

- ✅ **SVGFusion**: cleaning pipeline drops `<path>` coordinates from **~11.7M to ~1.8M**; inference **24–36 s** vs **35–47 min** for optimisation baselines.
- ✅ **StrokeNUWA**: compression ratio **6.9%** (CR = len(tokenised SVG) / len(stroke tokens)); up to **94× inference speedup**; FID **6.513**, HPS **16.801**, CLIPScore **17.994**; ~**19 s** generation vs ~**30 min** for LIVE.
- ✅ **HiVG**: claims structural tokenisation gives "*substantial sequence compression (10 → 7 → 2)*" — ⚠️ this appears to be a *schematic example* in Fig. 1(c), not a reported average ratio. Treat as illustrative, not a benchmark.
- ✅ **SVGEditBench** (editing, not generation): compression ratio = output code length / input code length; GPT-4 reaches **94.5%**, GPT-3.5 **96.1%**, no-edit baseline 100% (lower = more compression).
- ✅ **VectorGym** curation applies a **2,000–8,000 token** filter to select "meaningful complexity" real-world SVGs.

---

## 4. Project dossiers

### 4.1 StarVector / SVG-Bench — [joanrod/star-vector](https://github.com/joanrod/star-vector) · [arXiv 2312.11556](https://arxiv.org/abs/2312.11556) · CVPR 2025 · ~4.6k stars

- **What:** multimodal LLM (StarCoder2-7B + SigLIP, 1B and 8B variants) doing image2SVG and text2SVG **as code generation**. Dataset **SVG-Stack** (2.1M train).
- **Output:** full SVG code space — *"precise use of primitives like ellipses, polygons, and text."* ✅
- **Minimisation technique:** **none explicit**. No curve fitting, no simplification step, no node penalty in the loss. Compactness is an **emergent consequence of working in SVG code space with full primitive coverage** ✅ — *"StarVector produces compact (3k tokens) and professional-grade SVGs by leveraging a variety of SVG primitives beyond paths."*
- **Inference-time knobs:** ✅ *"StarVector is sensible to temperature, length penalty, and logit bias, i.e., adding more weight to certain tokens, like the `<svg-end>` token."* Best config: nucleus sampling top-p **0.9**, temperature **0.5**.
- **SVG-Bench metrics (corrects a premise):** ⚠️ **SVG-Bench does NOT use path length, command count, or edit distance.** Metrics are **DinoScore, LPIPS, SSIM, MSE** (image-to-SVG), **FID, FID-CLIP, CLIP Score** (text-to-SVG), plus a **Tokens** column and a human study. The paper's stated motivation is the *opposite* of structural metrics: ✅ *"pixel-based metrics like MSE fail to capture the unique qualities of vector graphics."*
- **DinoScore leaderboard** ✅ (README): StarVector-8B **0.966 / 0.982 / 0.984 / 0.981 / 0.959** (Stack/Fonts/Icons/Emoji/Diagrams) vs LIVE **0.934/0.956/0.959/0.969/0.870**, VTracer **0.954/0.964/0.940/0.981/0.882**, AutoTrace 0.942/0.954/0.946/0.975/0.874, Potrace 0.898/0.967/0.972/0.882/0.875, DiffVG 0.810/0.821/0.952/0.814/0.822, GPT-4-V 0.852/0.842/0.848/0.850/–, Im2Vec 0.692/0.733/0.754/0.732/–.
- **Path counts + time (Table 3)** ✅: LIVE 5 paths → Dino 0.898, 190 s; 32 → 0.937, 650 s; 60 → 0.939, **1,412 s**. DiffVG 15 → 0.781, 21 s; 120 → 0.895, 45 s. VTracer **18 paths**, **0.09 s**. AutoTrace **~3k paths**. ✅ *"LIVE… takes more than 10 minutes to generate a single SVG, which makes it slow for a professional use case."*
- **On RDP/Schneider/primitive:** ❌ **no citation** anywhere in the paper or README. Not used. ✅ (verified by full-text grep)

### 4.2 OmniSVG — [OmniSVG/OmniSVG](https://github.com/OmniSVG/OmniSVG) · [arXiv 2504.06263](https://arxiv.org/abs/2504.06263)

- **What:** end-to-end multimodal SVG generation on Qwen2.5-VL; dataset **MMSVG-2M** (1.1M icons, 0.5M illustrations, 0.4M anime characters); benchmark **MMSVG-Bench**.
- **Output:** ✅ exactly **five atomic commands `{M, L, C, A, Z}`** plus a special **`F`** token for hex fill → `{M,L,C,A,Z,F}`. Rationale: *"parameterizing SVG coordinates and commands into discrete tokens, OmniSVG decouples structural logic from low-level geometry, mitigating the 'coordinate hallucination' problem."*
- **Minimisation technique:** ✅ **canonicalisation via `googlefonts/picosvg`** to *"remove grammars like 'group' and 'transform', and simplify the complex commands to atomic path commands."* This is *normalisation* (uniform, unambiguous, model-friendly), **not** size minimisation — atomic expansion of shapes can *increase* command count.
- **Notable:** ✅ adds elliptical **arcs (A)** where IconShop/DeepSVG do not; ✅ reports `# Tokens` as a first-class metric.
- **On RDP/Schneider/primitive:** ❌ no citation. ✅

### 4.3 LLM4SVG / SVGEditBench — [ximinng/LLM4SVG](https://github.com/ximinng/LLM4SVG) · [arXiv 2412.11102](https://arxiv.org/abs/2412.11102) · CVPR 2025

- **What:** makes **any** LLM/MLLM understand and emit SVG via **learnable semantic tokens**. SVGX-SFT dataset: 250k high-quality **human-designed** SVGs + **580k** instruction-following samples.
- **Output:** ✅ **55 semantic tokens** = 15 tag + 30 attribute + **10 path-command** tokens. *"These SVG tokens are used to replace all tags and attributes in the SVG source code, thus preventing the textual encoding of SVG tags and attributes as regular text."*
- **Explicit cleaning/minimisation pipeline** ✅ (Fig. S1 caption): removes *"XML declarations, comments, metadata, unused tags"*, **converts absolute coordinates to relative**, standardises canvas size — *"improves efficiency, readability, and scalability… significantly reducing file complexity."*
- **Tokenizer-level technique:** ✅ new tokens initialised as the **semantic average of their description text**, producing *"a compact, distributed representation for all SVG tokens"* — trainability, not output length.
- **Actionable for anyone prompting an LLM to emit SVG** ✅: *"in the Qwen models, all numbers and decimal points are tokenized as a single unit. This approach prevents Qwen from effectively handling continuous numerical data, resulting in poor performance in tasks such as coordinate prediction… In contrast, LLMs like GPT-2, which explicitly enumerate all numbers up to 1,000 as individual tokens, demonstrate a stronger numerical understanding."*
- **Metrics:** FID, CLIPScore, Aesthetic, HPS, **Gen. Time**, plus a human study with a **"Human SVG"** reference row. ✅
- **⚠️ Correction:** *SVGEditBench* is a **separate** benchmark ([2404.13710](https://arxiv.org/abs/2404.13710); V2 [2502.19453](https://arxiv.org/abs/2502.19453)) about **instruction-based SVG editing**, not generation. Metrics: **MSE + compression ratio**; no path edit distance.

### 4.4 Chat2SVG — [kingnobro/Chat2SVG](https://github.com/kingnobro/Chat2SVG) · [arXiv 2411.16602](https://arxiv.org/abs/2411.16602)

- **What:** hybrid — LLM writes an SVG **template** from basic primitives, SDEdit+ControlNet adds detail, then **dual-stage optimisation** (latent space via an SVG VAE, then direct control-point optimisation).
- **Output:** ✅ *"we constrain the shapes to a carefully selected set of basic primitives: rectangles, ellipses, lines, polylines, polygons, and short paths"*; prompt text is explicit: **"short path (up to 5 commands)"**, and *"Other elements like text, Gradient, clipPath, etc., are not allowed."* Then ✅ *"For consistency, we convert all other primitive shapes (e.g., rectangles and ellipses) in the SVG template into cubic Bézier curves."*
- **Minimisation technique — deliberately the *opposite*:** ✅ *"To achieve finer granularity in shape control, we split each cubic Bézier curve at its midpoint, effectively doubling the number of control points."* Also ✅ the pretrained SVG VAE *"expects a fixed number of commands (10 cubic Bézier curves)"* whereas their primitives have *"varying (typically fewer) commands"* → they invented a latent-inversion/EMD procedure to bridge it.
- **Best-in-class on length nonetheless** (per OmniSVG ⚠️): **0.6k–1.0k tokens** — because the LLM template is primitive-based, not path-based.
- **Most useful definition of "professional-looking"** ✅: *"fragmented paths, when viewed collectively, can yield visually appealing outputs, [but] they fundamentally conflict with professional design principles, where **each semantic component is intentionally crafted as a single, regularized path**."*
- **Path-level metric they invented (closest thing to a path-quality score found):** ✅ **Path-level Regularity** — train a DeepSVG-style transformer auto-encoder on FIGR-8-SVG, encode each drawing command to a latent vector, represent a path as the mean of its command embeddings, then compute **FID between generated-path representations and ground-truth paths**. Plus **image FID against a professional design collection** (SVGrepo) using CLIP features.
- **Honest ablation** ✅: removing dual-stage optimisation yields the **lowest (best) path FID** — *"primitives generated by LLMs naturally align with the path regularity presented in the ground-truth dataset"* — but worse visual detail. **LLM-drawn primitives are more "human-regular" than optimised ones.**
- **On RDP/Schneider/primitive:** ❌ no citation; uses `picosvg`. ✅

### 4.5 SVGDreamer / SVGDreamer++ — [ximinng/SVGDreamer](https://github.com/ximinng/SVGDreamer) · [arXiv 2312.16476](https://arxiv.org/abs/2312.16476) · CVPR 2024
### + [SVGDreamerV2 / SVGDreamer++](https://github.com/ximinng/SVGDreamerV2) · [arXiv 2411.17832](https://arxiv.org/abs/2411.17832) · T-PAMI 2025
### Shared codebase: [ximinng/PyTorch-SVGRender](https://github.com/ximinng/PyTorch-SVGRender)

- **Two components.** ✅ **SIVE** (Semantic-driven Image VEctorization): uses diffusion **cross-attention maps** to allocate control points per object token, plus an **attention-mask loss** for hierarchical optimisation — *"SIVE produces more concise SVG structures with clearer semantic decomposition."* ✅ **VPSD** (Vectorized Particle-based Score Distillation): models SVG parameters as a **distribution** over k particles (k=6), LoRA estimator + ReFL reward guidance; fixes SDS's *"over-smoothed geometry, over-saturated colors, limited diversity, and slow convergence."*
- **Minimisation technique:** ✅ **path pruning/reinitialisation** — *"many paths either shrink to a very small area or converge to low opacity, making them effectively unused. To encourage path utilization… we periodically reinitialize paths whose fill opacity or area falls below a threshold, following the strategy of VectorFusion."* SIVE's semantic grouping also reduces **entanglement** (duplicate/overlapping paths).
- **Complexity knob is explicit and large** ✅: ablates **128 / 256 / 512 / 768 paths**; at 128 *"the model captures only coarse color regions"*; at 768 *"edges are sharper… fine-grained elements such as reflections, foliage, and architectural contours are better preserved."* Conclusion: *"the number of paths is a key representational bottleneck."*
- **Stated limitation** ✅: *"the number of control points for each object in SIVE is currently not determined adaptively"* — **no automatic minimality guarantee**.
- **Cost:** ≥**31 GB** GPU, six SVGs in parallel; ReFL cuts 500→300 steps.
- **On RDP/Schneider/primitive:** ❌ no citation. ✅ (Its bibliography cites MARVEL, "primitive-wise deep reinforcement learning", which is unrelated.)

### 4.6 VectorFusion — [arXiv 2211.11319](https://arxiv.org/abs/2211.11319) (⚠️ no official repo; widely reimplemented)

- **What:** distil a pixel diffusion model into SVG via SDS through DiffVG; initialise from a Stable Diffusion sample optionally vectorised by LIVE.
- **Output:** ✅ *"Most of our experiments use closed Bézier curves."* Icons: **64 paths × 4 segments**. Sketches: **16 strokes × 5 segments, 6 px wide, black**. Pixel art: **32×32 grid of square polygons**.
- **Minimisation technique:** ✅ **path reinitialisation** — *"many paths learn low opacity or shrink to a small area and are unused. To encourage usage of paths… we periodically reinitialize paths with fill-color opacity or area below a threshold. Reinitialized paths are removed from optimization and the SVG, and recreated as a randomly located and colored circle."* Every 50 iterations; disabled for the last 200–500 iterations. ✅ Ablation: **+3.0% R-Precision** from scratch, **+12.5%** when initialised from LIVE.
- **Explicit non-solution** ✅: *"the number of primitive paths is a non-differentiable hyperparameter."* They settle on 64 by hand; *"Fewer paths leads to simpler, flatter icons, whereas details and more complex highlights appear with greater numbers of paths"* / *"Consistency improves with more paths, but there are diminishing returns."*
- **Context:** 10–20 min per SVG on an RTX 2080 Ti ✅; LIVE vectorisation *"hurts caption consistency (-14.9% OpenCLIP R-Prec) even with 20 rejection samples."*

### 4.7 LIVE (Layer-wise Image Vectorization) — [Picsart-AI-Research/LIVE-Layerwise-Image-Vectorization](https://github.com/Picsart-AI-Research/LIVE-Layerwise-Image-Vectorization) · [arXiv 2206.04655](https://arxiv.org/abs/2206.04655) · CVPR 2022 Oral

- **What:** recursively adds optimisable **closed cubic Bézier paths** and refines all of them; no segmentation, no deep model.
- **The two techniques that actually shape clean path data** ✅:
  1. **Component-wise path initialisation** — quantise colours, find the largest connected missing component, initialise the next path at its **centre of mass**, all control points on a **circle of radius 5 px**. *"A bad initialization will lead to unsuccessful topological extraction and generate redundant shapes."* ✅ Circle init *"significantly reduces the artifacts"* and *"the close path is enforced to be convex."*
  2. **Xing (self-crossing) loss** — control-point constraint that the angle between AB and CD exceeds 180 degrees, expressed via D1 (acute/obtuse of angle ABC) and D2 = sin(theta). ✅ *"self-interacted path always intersects the lines of its control points, and vice versa"*; weight **0.01**. Rationale: ✅ *"While it might be expected that additional paths can cover the artifacts, we emphasize this would complicate the generated SVG."* ← **a direct statement that covering artefacts with extra paths is the wrong fix.**
- **Budget:** ✅ default **4 segments per path**, path number `min(2^(i-1), 32)` per step, 500 iterations/step. Tested 8→64 paths (Emoji), 32→256 paths (Pics). ✅ *"each component is clearly learned as a single bézier path"*; *"Increasing excessive paths would saturate the vectorization performance."*
- **Reputation vs reality:** StarVector measures LIVE at **18.3k tokens** ✅; Beyond Pixels measures **6,776 bytes / 3,625 tokens** ⚠️; OmniSVG measures **52.5k tokens** ⚠️; RLRF measures **−18.3k** ✅. Dataset/tokenizer-dependent — flagging because LIVE is often cited as "compact" and the measurements do not support that beyond the 32-path regime.
- **On RDP/Schneider/primitive:** ❌ no citation; uses DiffVG. ✅

### 4.8 IconShop — [kingnobro/IconShop](https://github.com/kingnobro/IconShop) · [arXiv 2304.14400](https://arxiv.org/abs/2304.14400)

- **What:** autoregressive transformer over a **uniquely decodable SVG token sequence**, text-conditioned; unifies AR and fill-in-the-middle via a "causal" masking strategy.
- **Output:** ✅ **only M, L, C**, all attributes removed. *"we seek a compact SVG representation that makes its probabilistic modeling easier."* Other primitives are approximated: *"four line segments to construct a Rect, and concatenate four Bézier curves to form a Circle."*
- **Minimisation technique — tokenizer-level (very citable):** ✅ *"map the 2D location argument to 1D using row-major order, which **roughly halves the length of the token sequence**. For example, suppose the default width of an SVG image is w, we transform a 2D location argument (x,y) to a 1D argument using the formula x*w+y."* Plus `<BOP>` begin-of-path markers to preserve layer structure while flattening, and `<EOS>`.
- **Budget:** ✅ max **512** icon tokens (≈ commands); **100×100** bounding box → 10,007-token vocabulary; dataset filtered to ≤512-command icons (~1.1M of the cleaned FIGR-8-SVG set).
- **Metrics:** FID (CLIP features), CLIP Score, Uniqueness, Novelty, **plus a 79-participant user study** (5,925 judgments). ✅ IconShop "consistently approaches the performance of the 'Dataset' as the upper bound" in the *"is this high quality?"* task — i.e. it **fools humans into thinking its icons are real dataset icons**.
- **Best articulation of "human-looking" in a generation paper** ✅: IconShop *"preserving salient geometric relationships, such as **perpendicularity, parallelism, and symmetry**"*, whereas DeepSVG *"fails to reproduce simple geometric relationships like perpendicularity and parallelism"* and optimisation methods produce **"jagged and messy"** paths.
- **"Fake diversity"** ✅: DeepSVG+GAN's high Uniqueness/Novelty is *"largely attributed to the noticeable visual distortions (e.g., **jittering curves**)… rather than novel instantiations of the same object/concept."*
- **Repo note** ✅: *"We have cleaned up the FIGR-8-SVG by **command simplification**, removing the black bounding box, and resizing the icons."* Paper uses a **higher-precision 100×100** dataset than the repo default.

### 4.9 DeepSVG — [alexandre01/deepsvg](https://github.com/alexandre01/deepsvg) · [arXiv 2007.11301](https://arxiv.org/abs/2007.11301)

### THE most directly useful paper for "how to produce clean minimal path data"

- **What:** hierarchical VAE/transformer over SVG icons; two-level latent (command → path → global).
- **Output:** ✅ M, L, C subset; **arcs converted to Béziers**; all commands converted to **absolute**; 6 basic shapes mapped to paths (circle/ellipse → 4 elliptical arcs → Béziers).
- **★★ Explicit minimisation pipeline (verbatim)** ✅:

> *"we first split paths at points that form a sharp angle (e.g. where the angle between the incoming and outgoing tangents is less than some threshold **eta = 150 degrees**). We then apply either the **Ramer-Douglas-Peucker** [Douglas & Peucker, 1973] algorithm to simplify line segments or the **Philip J. Schneider** algorithm [Schneider, 1990] for segments of cubic Bézier curves. Finally, we divide the resulting lines and Bézier curves in multiple subsegments when their length is larger than some distance **Delta = 5**. Notice how our algorithm **both adds points when curve segments are too long or reduces the amount of points when the curve resolution is too high**."*

- Baseline: Sketch-RNN. README ✅ lists *"Path simplification, using Ramer-Douglas-Peucker and Philip J. Schneider algorithms"*; API exposes `icon.simplify_heuristic()  # path simplifcation`.
- **Repo caveat** ✅: *"using a lower number of Bézier commands in the initial circle (n) creates somehow artistic approximations of the target shape."*
- **Scale limits** ✅ (as measured by StarVector): *"it can only process SVGs with **eight groups** and vector paths of at most **30 commands**."* StarVector had to build a **`_sim` simplified dataset variant** just to run DeepSVG as a baseline.

### 4.10 Image-to-SVG / differentiable-rendering lineage

**Im2Vec** — [arXiv 2102.02798](https://arxiv.org/abs/2102.02798): Encoder–RNN–Rasterizer, synthesises vector graphics without vector supervision; ~4.3k tokens; weak DinoScore (0.69–0.75) ✅.

**DiffVG** — [BachiLi/diffvg](https://github.com/BachiLi/diffvg) (Li et al. 2020). ✅ README is install/usage only — **it is a rasteriser, not a simplifier**: *"diffvg is a differentiable rasterizer for 2D vector graphics."* It optimises whatever primitives you parameterise. **Consequence, stated by multiple papers:** ✅ SVGFusion — *"they can only use `<path>` primitives described by Bézier curves. This leads to the need for a large amount of staggered overlapping primitives to closely fit the LDM sample, even for relatively simple shapes. Consequently, even simple regular shapes such as rectangles cannot be described using the corresponding basic shape primitives, thus losing the advantage of SVG's editability."* StarVector measures DiffVG at **19.7k tokens** ✅; OmniSVG at **322.0k** ⚠️; RLRF at **−19.7k** ✅.

**SuperSVG** — [arXiv 2406.09794](https://arxiv.org/abs/2406.09794): superpixel-based SVG synthesis. RLRF measures Code Eff. **−65.6k** ✅ (method read in depth: ❓ no).

**Word-As-Image** — [WordAsImage/Word-As-Image](https://github.com/WordAsImage/Word-As-Image) · [arXiv 2303.01818](https://arxiv.org/abs/2303.01818): typography deformation via diffvg + SDS + tone-preservation (low-pass filter) + **ACAP loss** on constrained Delaunay triangulation of control points. ✅ **Directly relevant to control-point budgeting:** letters are extracted as cubic Béziers then **deliberately subdivided up to a per-letter target control-point count** (repeatedly split the longest segment). ✅ *"the initial number of control points affects the final appearance significantly: as the number of control points increases, there is more freedom for visual changes… When less control points are used… this can also result in **more abstract depictions**… As we add control points, we get more graphic results, with the tradeoff that it often deviates from the original letter."* Only control-point coordinates are optimised.

**CLIPasso** — [yael-vinker/CLIPasso](https://github.com/yael-vinker/CLIPasso): ✅ *"we define a sketch as a set of Bézier curves and use a differentiable rasterizer (diffvg) to optimize the parameters of the curves directly with respect to a CLIP-based perceptual loss. We combine the final and intermediate activations of a pre-trained CLIP model to achieve both **geometric and semantic simplifications**."*

**DiffSketcher** — [arXiv 2306.14685](https://arxiv.org/abs/2306.14685); **CLIPDraw** — [kvfrans/clipdraw](https://github.com/kvfrans/clipdraw): stroke/CLIP-optimisation lineage. SVGDreamer normalises attention maps following DiffSketcher and samples the first control point from the attention distribution ✅.

**SVGFusion** — [ximinng/SVGFusion](https://github.com/ximinng/SVGFusion) · [arXiv 2412.10437](https://arxiv.org/abs/2412.10437): VAE-diffusion; **highly relevant normalisation detail** ✅ — *"Element Normalization: Primitives such as `<line>`, `<polygon>`, and `<polyline>` are mathematically converted into their equivalent `<path>` representations."* / *"Command Normalization: Shorthand path commands are expanded to their explicit forms… Horizontal (H) and Vertical (V) lines are mapped to Line To (L); Smooth Cubic (S) and Smooth Quadratic (T) Béziers are converted to explicit Cubic (C) and Quadratic (Q) curves."* Also *"flattens the structural hierarchy by eliminating `<defs>` and `<class>` attributes and normalizes geometry by **converting absolute coordinates to relative ones with rounded precision**."* ✅ Contrasts itself against prior work that *"often resort[s] to extreme simplification, limiting the representation to a single element-level primitive (`<path>`) and a subset of commands (Move M, Line L, Cubic Bézier C)."*

**HiVG** — [ximinng/HiVG](https://github.com/ximinng/HiVG) · [arXiv 2604.05072](https://arxiv.org/abs/2604.05072): *"Hierarchical SVG Tokenization: Learning Compact Visual Programs."* **The most explicitly compression-motivated paper found.** ✅ Motto: *"the devil is in the token compression."* ✅ **Segment tokens** group drawing commands **with their coordinates** into reusable, still-executable units — *"Instead of performing naive text-level compression, our tokenizer is designed to process meaningful executable geometric units, thereby filtering out unstable, non-structural path fragments."* ✅ Learned merges: cubic Bézier `<c>` is **40%** of mid-frequency segments; top-50 segments are **24% arcs (`<a>`)** and **22% smooth curves (`<s>`)**, median atomic length **~9 tokens**, stable across frequency tiers. ✅ Cleaning pipeline *"isolates these irregularities into specific recurring motifs, such as **zero-move command groups and redundant transitions that offer no geometric value**."* Benchmark columns: **Render, TokCnt, PathCnt, CmdCnt** ✅. Human study: **8 professional SVG practitioners import outputs into Adobe Illustrator** and score **structural usability 1–5** ✅ — *"Raster-domain metrics cannot assess whether a generated SVG remains structurally meaningful and editable after being imported into professional vector-graphics software."*

**StrokeNUWA** — [arXiv 2401.17093](https://arxiv.org/abs/2401.17093): ✅ SVG code → matrix → **VQ-VAE compressed into "stroke tokens"**; *"strokes in vector graphics can be highly compressed"*; **CR 6.9%**, up to **94×** faster than optimisation baselines; ~19 s vs ~30 min for LIVE. ✅ Argues against the "flat token sequence" view of SVG.

**RLRF (StarVector follow-up)** — [arXiv 2505.20793](https://arxiv.org/abs/2505.20793) · NeurIPS 2025: **the only work found with an explicit length penalty in the training objective.** See section 5.2.

**Beyond Pixels / S2VG2** — [arXiv 2311.15543](https://arxiv.org/abs/2311.15543): the only paper found that treats **readability as the primary objective**. ✅ *"these methods typically yield SVGs that are unreadable, as they overly rely on strategies like the DiffVG, which generates SVGs with a fixed number of paths where **many are unnecessarily obscured by others**… Moreover, these images frequently contain **curves that overshoot the viewBox attribute's boundaries**."* Metrics: LPIPS/SSIM/L1/L2 + **VQA-based readability** + file size/tokens.

### 4.11 Classical vectorisers and optimisers

**vtracer** — [visioncortex/vtracer](https://github.com/visioncortex/vtracer) · ⚠️ not a paper; the README is the spec. **Most actionable production flags found.**

✅ `--mode pixel|polygon|spline`; `--simplify <TOLERANCE>`; `--path-precision <n>` (decimal places in path coords); `--filter-speckle <0..=128>`; `--color-precision <1..=8>`; `--gradient-step`; `--palette`, `--max-colors`; `--optimize <0|1|2>` (1 = quantize+cleanup, 2 = + shorthands); `--hierarchical stacked|cutout` (cutout = seam-free mosaic with **shared boundaries**).

✅ `--simplify` described as: *"**paper.js-style curve simplification**: re-fits smooth runs with the **fewest cubics that stay within the tolerance (px)**, **typically halving file size**; seam-free in cutout mode because shared boundaries are simplified once for both faces."*

✅ Legacy spline knobs `--corner-threshold` (default **60**), `--segment-length` (default **4**), `--splice-threshold` (default **45**) are now hidden: *"`--simplify` is the knob that actually moves output size and smoothness."*

✅ vs Potrace: *"VTracer skips Potrace's expensive optimal-polygon search in favor of a fast, linear pipeline"*; ✅ *"Curve simplification: fewer nodes, often half the file size."* StarVector seconds this ✅: *"pixels are converted into paths and then simplified into polygons. In the last step, polygons are **smoothened and approximated with a Bezier curve fitter**."*

**fogleman/primitive** — [fogleman/primitive](https://github.com/fogleman/primitive) · **a hill-climbing primitive-fitting tool, not a path simplifier.**

✅ *"The algorithm tries to find the single most optimal shape that can be drawn to minimize the error… It repeats this process, adding **one shape at a time**. Around **50 to 200 shapes** are needed to reach a result that is recognizable yet artistic and abstract."*

✅ Modes `-m`: `0=combo, 1=triangle, 2=rect, 3=ellipse, 4=circle, 5=rotatedrect, 6=beziers, 7=rotatedellipse, 8=polygon`; `-rep N` = *"add N extra shapes each iteration with reduced search (mostly good for beziers)"*; `-n` = number of shapes; `-a 128` alpha (0 = let the algorithm choose alpha per shape); SVG output supported.

➡️ **It has no curve-fitting/simplification step at all**, and its output is a flat stack of overlapping shapes — the same architectural pattern that S2VG2 criticises in DiffVG.

**SVGO** — [svg/svgo](https://github.com/svg/svgo): ✅ *"SVG files, especially those exported from vector editors, usually contain a lot of redundant information. This includes editor metadata, comments, hidden elements, default or suboptimal values, and other stuff that can be safely removed or converted without impacting rendering."* Uses `preset-default`; `--multipass`. **SVGenius uses SVGO as the *prompting principle*** for its "optimization" editing task ✅: *"explicitly prompting referencing the SVGO principle the model to compress, simplify, and remove redundancies in the SVG code according to professional standards."*

**autotrace** — [autotrace/autotrace](https://github.com/autotrace/autotrace): ✅ `-centerline` (centreline tracing for line art), `-color-count N`, `-output-file`. ⚠️ Its own curve-fitting; exact algorithm not verified in this pass (❓). StarVector measures it at **~3k paths**, **30.8k–94.0k tokens**.

**Potrace** — ✅ referenced widely as the classical baseline; vtracer README characterises it as doing an "expensive optimal-polygon search". ⚠️ ❓ Not fetched from primary source (official distribution is not on GitHub).

**scour** — used in [tamchamchi/draw_with_llms](https://github.com/tamchamchi/draw_with_llms): ✅ pipeline = LLM prompt enhancement → Flux image → **vtracer** → **scour**, selecting the best SVG **"under 10KB"** with an aesthetic model. A rare explicit *size budget*. Also [goku-open/goku-image-to-svg-tool](https://github.com/goku-open/goku-image-to-svg-tool) and [defilantech/vecsmith](https://github.com/defilantech/vecsmith) are vtracer-based wrappers.

---

## 5. The explicit-minimisation techniques, in detail

### 5.1 Schneider & Ramer–Douglas–Peucker — the lineage

| Where | Uses Schneider? | Uses RDP? | Verbatim / evidence |
|---|---|---|---|
| **DeepSVG** ([2007.11301](https://arxiv.org/abs/2007.11301)) | ✅ **Yes** | ✅ **Yes** | *"apply either the Ramer-Douglas-Peucker… algorithm to simplify line segments or the **Philip J. Schneider** algorithm… for segments of cubic Bézier curves"*; corner split at eta=150 degrees, max segment length Delta=5 |
| **paper.js** ([paperjs/paper.js](https://github.com/paperjs/paper.js)) | ✅ **Yes** — `src/path/PathFitter.js` lines 14–15: `// by Philip J. Schneider` / `// from "Graphics Gems", Academic Press, 1990`; method `generateBezier(...)` | ❌ | The canonical modern JS implementation |
| **vtracer** ([visioncortex/vtracer](https://github.com/visioncortex/vtracer)) | ✅ **Inherited via paper.js** | ❓ | ✅ `--simplify` described as *"paper.js-style curve simplification"* |
| **fit-curve** ([soswow/fit-curve](https://github.com/soswow/fit-curve)) | ✅ **Yes** | n/a | ✅ *"JavaScript implementation of Philip J. Schneider's 'Algorithm for Automatically Fitting Digitized Curves' from the book 'Graphics Gems'"*; *"Fit one or more cubic Bezier curves to a polyline. Works with 2D and 3D curves"* |
| **simplify-js** ([mourner/simplify-js](https://github.com/mourner/simplify-js)) | ❌ | ⚠️ almost certainly RDP, ❓ README does not name it: *"high-performance JavaScript polyline simplification library… extracted from Leaflet"* | — |
| **StarVector, OmniSVG, LLM4SVG, Chat2SVG, SVGDreamer, VectorFusion, IconShop, LIVE, SVGFusion, HiVG, RLRF, VGBench, SVGenius** | ❌ **No citation** | ❌ **No citation** | ✅ verified by full-text grep across all downloaded papers |
| **fogleman/primitive** | ❌ not cited by any paper found | ❌ | ✅ grep for "fogleman" returned **zero hits** across the whole corpus |

**Bottom line:** the *only* generative-learning system in this space with an explicit, documented curve-fitting/simplification stage is **DeepSVG (2020)** — and everything modern (2023–2026 LLM/diffusion work) has dropped it. StarVector's own reproduction notes show DeepSVG's simplification is now treated as an *input constraint to work around* (`_sim` datasets), not a technique to adopt. **This is a genuine, exploitable gap.**

### 5.2 RLRF's length reward — the only objective-level length penalty found

✅ Definition: *"we define **SVG Length Deviation** as a reward that penalizes excessive token length relative to the ground truth SVG… which applies a **quadratic penalty when the predicted length exceeds half the ground truth**. This formulation allows moderate variation while discouraging overly long or redundant SVG sequences. We then apply clipping to constrain the reward within the interval [-1, 1]."*

✅ Results: on SVG-Emojis Qwen2.5VL-7B SVG-SFT improves **6.39 → 4.93 MSE** and **90.99 → 93.50 DINO**, *"while reducing the average SVG length by approximately **1,500 tokens**."* On SVG-Fonts MSE **7.1 → 4.73**.

✅ *"adding the **Length** term contributes to smoother and more compact SVGs"*; *"The best performance is achieved by combining pixel-level and semantic rewards, **along with a length penalty for code compactness**."*

✅ **Dynamic max-length curriculum:** *"For each batch, we estimate the required output length using the ground truth SVGs and set the maximum length to the longest sample plus a small threshold t. This strategy… **encourages the model to generate shorter and cleaner sequences**."*

⚠️ **Reward hacking #1 — read before copying the trick:** ✅ *"we observe that the model progressively generates shorter and shorter SVGs until it reaches a **collapse point**, after which generation diverges entirely… This behavior is driven by the length deviation reward… because lengths below 0.5*L_gt still receive increasingly higher rewards, peaking at 1 when exactly half the length is reached."*

✅ **Their two mitigations:** (a) assign **−1** when length falls below half the GT; (b) in practice, *"reducing the weight of the length reward to **0.1** in early training, then gradually increasing it."*

✅ **Reward hacking #2:** *"the model learns to produce SVGs with extremely small viewboxes, for example: `<svg ... viewBox="0 0 1 1">`. This causes the renderer to generate an extremely low-resolution image… most information is lost, and the image-based reward becomes artificially high."* Fix: force rendering at the reference image size/aspect ratio.

✅ **Reward hacking #3:** *"the model learns to exploit the reward signal by using the `<text>` SVG primitive to render the exact prompt string directly onto the image"* (for CLIP-based text rewards). Fix: strip `<text>` before rendering.

### 5.3 Fixed budgets and their consequences (a recurring failure mode)

- ✅ **DiffVG / LIVE / VectorFusion / SVGDreamer**: path count is a **non-differentiable hyperparameter** set by hand (64, 32, 64, 128–768 respectively). "More paths → better metrics" is empirically true in every ablation (StarVector Table 3; VectorFusion Table 4; SVGDreamer Fig. 14).
- ✅ **Beyond Pixels**: the failure this creates is *occlusion* — many generated paths are **completely hidden** behind others. You pay tokens for invisible geometry.
- ✅ **SVGFusion**: the failure is *semantic wrongness* — rectangles approximated by Béziers instead of `<rect>`.
- ✅ **SVGenius complexity weighting** (useful rubric): *"basic operations (M, L, Z) weighted at **1**, quadratic curves (Q, T) at **2–3**, cubic curves (C, S) at **3–4**, and elliptical arcs (A) at **5**"*, plus command-type entropy, coordinate-precision entropy, curvature complexity, PCA-based stratification into 3 levels (ANOVA p < 0.001).

---

## 6. Metrics that measure path economy — what exists and what does NOT

**⚠️ Correcting a premise:** *SVG-Bench* (StarVector) does **not** report path length, command count, or edit distance to human SVGs. Verified from the paper and README. `all:"SVG-Bench"` on arXiv returns **only** StarVector.

**I found no widely-adopted "path edit distance" metric for SVG generation.** arXiv search for `all:"path edit distance"` returned only KGQA/network-inference papers. What actually exists:

| Metric | Where | What it is |
|---|---|---|
| **Tokens** (per output) | StarVector Table 1, OmniSVG Table 2, Beyond Pixels Table 4, HiVG | raw token count under a given tokenizer |
| **Code Efficiency** | RLRF | ✅ *"the negated mean difference between ground truth and predicted SVG token counts"*; near-zero ideal |
| **Compression Ratio** | SVGEditBench | ✅ output code length / input code length |
| **Compression Ratio (CR)** | StrokeNUWA | ✅ len(tokenised SVG) / len(stroke tokens) = **6.9%** |
| **TokCnt / PathCnt / CmdCnt** | HiVG | average tokens, path count, path command count |
| **Path-level Regularity (FID)** | Chat2SVG | FID in a DeepSVG-style command-embedding space, generated vs FIGR-8-SVG ground truth |
| **Structural usability (1–5 Likert)** | HiVG | ✅ 8 professionals import into **Adobe Illustrator** and rate editability |
| **VQA readability** | Beyond Pixels | LLM answers questions about the generated SVG |
| **Complexity weighting / stratification** | SVGenius | per-command weights + entropy + curvature, 3 levels |
| **File size (bytes)** | Beyond Pixels | explicit table |
| **VLM-as-a-Judge** | VectorGym, SVG-Score | task-specific judges validated by Pearson correlation with human raters |

**★ The clearest statement that this is a real gap** — SVG-Score's own limitations section ✅:

> *"Our work targets Semantic Alignment between a textual prompt and the rendered SVG output. Our evaluators therefore **say nothing about properties of the underlying vector representation – editability, path efficiency, layer organization, or code quality – which matter for design workflows and would require their own supervision**."*

**Where evaluation moved instead (2025–2026):** toward **human-aligned perceptual/VLM metrics**, not structural ones. SVGenius (MSE/HPS/PSS/SSIM/LPIPS/DINO across Easy/Medium/Hard), SVGauge (SigLIP+PCA/whitening visual similarity + BLIP-2 caption vs SBERT/TF-IDF semantic consistency, alpha=0.6/beta=0.4; 40 annotators, 2,461 annotations, SHE dataset of 333 prompt-SVG pairs), SVG-Score (human-aligned Qwen3-VL-8B judge, rho 67.76 → **74.85**; SVG-adapted CLIP ViT-H/14 rho **63.18**, PA 80.64), VectorGym (VLM judge Pearson correlation with 17 human raters; GPT-5.1 best for editing at **0.70**). All explicitly **do not** measure path economy. **SVGauge on why raster metrics fail:** ✅ *"an icon with a unique stylistic interpretation might be penalized by CLIPScore even if it faithfully represents the input caption."*

**Convergent evidence that MSE/SSIM actively mislead for SVG:** ✅ StarVector Fig. 2 — on the 'planet' example StarVector's MSE (0.009) is *worse* than LIVE's (0.0012) and VTracer's (0.0039), yet StarVector preserves the colour gradient; DinoScore favours StarVector. ✅ RLRF: *"Image processing methods achieve strong scores but generate verbose, inefficient code."*

**VGBench** ([2407.10972](https://arxiv.org/abs/2407.10972)) ✅ for generation uses **only CLIP Score (Long-CLIP) and FID**, against GPT-4V-generated captions; understanding side is 4,279 multiple-choice QA + 5,845 caption pairs across SVG/TikZ/Graphviz. ✅ Finding worth noting: *"GPT-4 shows stronger performance in high-level vector graphics language (e.g., TikZ, Graphviz) compared to low-level vector graphics language SVG… TikZ and Graphviz show at least **17% better performance than SVG**"*, and **SVG understanding degrades steadily as sequence length grows** while TikZ/Graphviz stay stable — direct evidence that verbose path data hurts machine comprehension too.

---

## 7. What actually makes a generated SVG look human / professional

**The most consistent finding is that the failure is structural, not pixel-level.**

1. **Every semantic component should be one path.** ✅ Chat2SVG: *"fragmented paths, when viewed collectively, can yield visually appealing outputs, [but] they fundamentally conflict with professional design principles, where each semantic component is intentionally crafted as a single, regularized path."* Their entire Path-level Regularity metric exists to measure this.
2. **No invisible or redundant geometry.** ✅ Beyond Pixels: DiffVG *"generates SVGs with a fixed number of paths where **many are unnecessarily obscured by others**."* ✅ LIVE's Xing loss exists because *"additional paths can cover the artifacts… we emphasize this would **complicate** the generated SVG."*
3. **Preserve geometric relationships: perpendicularity, parallelism, symmetry.** ✅ IconShop credits its quality to *"preserving salient geometric relationships, such as perpendicularity, parallelism, and symmetry"*; ✅ DeepSVG *"fails to reproduce simple geometric relationships like perpendicularity and parallelism"*; ✅ optimisation methods produce *"jagged and messy"* paths.
4. **No self-intersections, no overshoot outside the viewBox.** ✅ LIVE: self-interaction means *"a self-interacted path always intersects the lines of its control points"*; ✅ Beyond Pixels: *"curves that overshoot the viewBox attribute's boundaries, resulting in a vectorized image that fails to capture the intended semantic information."*
5. **No unused attributes or redundant styles.** ✅ RLRF's designer user study: *"Designers specifically pointed out that SFT sometimes introduced **unused attributes or redundant styles**, while RLRF produced **more compact and interpretable paths and a cleaner overall organization**."*
6. **Correct layering / z-order and occlusion.** ✅ SVGFusion devotes a whole component to this (*"Rendering Sequence Modeling strategy, which ensures accurate object layering and occlusion"*); ✅ its failure case is *"shapes with lighter colors are occluded by shapes with darker colors."*
7. **Avoid SDS-induced over-smoothing and over-saturation.** ✅ SVGDreamer: SDS *"suffers from over-smoothed geometry, over-saturated colors, limited diversity, and slow convergence"*; ✅ VectorFusion adds an L2 anti-oversaturation penalty for pixel art.
8. **Beware "jitter" masquerading as diversity.** ✅ IconShop on DeepSVG+GAN: *"the high Uniqueness and Novelty values… are largely attributed to the noticeable visual distortions (e.g., **jittering curves**)… We regard this as **'fake diversity'**."*
9. **Correct primitive type is itself a professionalism signal.** ✅ StarVector: a circle should be `<circle/>`; text should be editable `<text/>` (*"text elements should be vectorized as editable `<text/>` primitives to retain the original textual content"*). ✅ SVGFusion: *"allows the model to learn and generate specific geometric structures (e.g., **perfect circles or rounded rectangles**) using their most efficient and semantically correct representations, rather than approximating them with generic Bézier paths."*
10. **Measured human preference for readability (strongest single quantitative result found):** ✅ Beyond Pixels user study — **77.8%** could easily interpret S2VG2's SVGs; for LIVE, **61.1% could not understand them** (plus 30.6% answered incorrectly); for DiffVG, **70.8%** reported a lack of understanding; **85.8%** chose S2VG2's output as easiest to understand. ✅ S2VG2 VQA accuracy *"closely matches the Ground Truth"*. **File size: 390 bytes vs 6,776 (LIVE) vs 28,354 (DiffVG).**
11. **Human studies consistently reward editability over raw fidelity.** ✅ HiVG: raster metrics don't predict whether an SVG *"remains structurally meaningful and editable after being imported into professional vector-graphics software"* (Adobe Illustrator test). ✅ RLRF: 267 evaluations from 18 participants incl. **3 professional designers** on 50 SVG-Stack-Hard examples — RLRF favoured *"in terms of structure and ease of modification."* ✅ IconShop: in a **79-user / 5,925-judgment** study, IconShop's icons approach the *real dataset* as the upper bound for "is this high quality?" — it crosses the human-detection threshold.
12. **⚠️ Counter-evidence to the "shorter is better" instinct:** ✅ Word-As-Image: *fewer* control points → *"more abstract depictions"*; more → *"more graphic results"* at the cost of fidelity. ✅ VectorFusion: *"Using fewer paths leads to simpler, flatter icons."* ✅ GPT-4o's 0.3k-token outputs and GPT-4-V's 279–672 tokens are described as **oversimplified**: ✅ RLRF — *"GPT-4o and Gemini 1.5 Pro generate more coherent SVGs, but frequently rely on **oversimplified representations** and struggle with spatial layout and fine-grained detail."* **Minimality is not the objective; minimality-per-unit-of-semantic-structure is.**

---

## 8. Recommendations for a generator that emits clean, minimal path data

Ordered by expected payoff, derived only from what the sources demonstrate:

1. **Emit real primitives, not paths** (`<circle>`, `<rect>`, `<ellipse>`, `<polygon>`, `<text>`, gradients) — the single largest measured win (~3k vs ~18k tokens). Requires *not* being locked into a differentiable-path parameterisation.
2. **Adopt a DeepSVG-style simplification pass** on any traced/optimised output: split at sharp corners (eta≈150 degrees), RDP for straight runs, **Schneider for cubic runs**, cap segment length (Delta≈5). Nobody in the LLM era is doing this; it is free.
3. **Use vtracer's `--simplify` semantics** (*"fewest cubics that stay within the tolerance"*, tolerance 1–2.5 px, *"typically halving file size"*), `--path-precision` for coordinate rounding, `--mode polygon|spline` for topology control. Then an SVGO/scour pass.
4. **Add an explicit length term with anti-collapse guards** (RLRF): quadratic penalty above half GT length, **−1 floor below it**, weight ramped **0.1 → up**, render at reference viewBox (never trust the predicted viewBox), strip `<text>` before scoring.
5. **Prune aggressively** — reinitialise/delete paths whose fill opacity or area falls below threshold, then drop them from the output (VectorFusion/SVGDreamer). The only *proven* redundancy remover in the optimisation lineage.
6. **Regularise topology, don't cover it up** — a LIVE-style self-crossing loss on control points, plus Chat2SVG's "one semantic component = one regularised path" principle.
7. **Normalise deterministically**: relative coordinates, rounded precision, flatten `<defs>`/`<class>`, expand shorthand (H/V→L, S→C, T→Q), convert `<line>/<polygon>/<polyline>` → `<path>` (SVGFusion's ~11.7M → ~1.8M coordinate reduction).
8. **Tokenise structurally, not character-wise** — group commands with their coordinates (HiVG), row-major 2D→1D (IconShop, ~2× sequence reduction), or a compressed stroke/token codebook (StrokeNUWA, 6.9%).
9. **Measure the right thing.** Add `TokCnt`/`PathCnt`/`CmdCnt` (HiVG), code-efficiency delta (RLRF), compression ratio (SVGEditBench), and a **Chat2SVG-style path-level FID in a DeepSVG command-embedding space** — plus a HiVG/RLRF-style **"import into Illustrator and rate editability"** study. Per SVG-Score's own admission, no published metric currently covers path efficiency, so self-reporting is the only option.

---

## 9. Gaps, contradictions, and things I could NOT verify

**Verified negatives (safe to rely on):**

- ✅ No paper in this corpus cites **Philip Schneider** except **DeepSVG** (plus the paper.js / fit-curve implementations). No paper cites **Ramer–Douglas–Peucker** except **DeepSVG**. No paper cites or uses **fogleman/primitive** at all.
- ✅ **vtracer → paper.js → Schneider** is a verifiable chain (vtracer README says "paper.js-style"; paper.js `PathFitter.js` header cites Schneider / Graphics Gems).
- ✅ StarVector's **SVG-Bench has no path-length / edit-distance metrics**; its compactness signal is a token count.

**Contradictions between sources (do not resolve without re-measuring):**

- **LIVE's token count**: 18.3k (StarVector) vs 3,625 tokens / 6,776 bytes (Beyond Pixels) vs 52.5k (OmniSVG) vs −18.3k delta (RLRF). Different datasets + tokenizers. ⚠️
- **LIVE's speed**: 650 s at 32 paths (StarVector) vs 1,243 s (RLRF) vs ">10 min" (StarVector prose) vs ~30 min (StrokeNUWA) vs 10–20 min (VectorFusion, whole SD+LIVE+SDS pipeline). ✅ The variance is real; pick the regime you mean.
- **StarVector's compactness claim**: prose says "closely matching the ground truth token count", but 8B outputs 3.0k–6.7k vs GT 2,822–5,618 — better than baselines, **not** at GT. ⚠️
- **vtracer's 4.5k–20k token range** likely spans different `--mode` / `--hierarchical` configurations that StarVector does not document. ❓

**Explicitly unverified (❓):**

- I read **SVGauge**, **VectorGym** and **SVG-Score** but did **not** extract their full leaderboards; the only claim I make about them is that **none uses path-level metrics**.
- **Could not obtain**: any SVG benchmark using path edit distance (arXiv `all:` search); **SuperSVG**'s method (only RLRF's Code Eff. −65.6k ⚠️); **Potrace**'s algorithm from primary source; **simplify-js**'s algorithm from its README; analysis of the newest benchmark set (SVGEval `2608.01977`, CANVAS `2608.30689`, Compositional-SVG `2609.14657`) — fetched but not analysed.
- **`SVGCoder`**: **no** arXiv paper or repository by that name matching this brief. `ti:"SVGcoder"` → 0 hits on arXiv; `ximinng/SVGCoder` → 404. ❓ Possibly a name from a secondary source. Real adjacent artifacts: **SVGEditBench / SVGEditBench V2** and **LLM4SVG**.
- **`kingnobro/SVGCoder`** → 404; **`ximinng/SVGEditBench`** → 404 (SVGEditBench lives inside the LLM4SVG project).
- **`Picsart-AI-Research/LIVE`** → 404; correct repo is **`Picsart-AI-Research/LIVE-Layerwise-Image-Vectorization`** ✅.
- **`StarVector/star-vector`** → 404; canonical repo is **`joanrod/star-vector`** ✅.
- **VectorFusion has no official repository** — every "VectorFusion" repo found is a third-party reimplementation. ❓ (audited none.)
- **HiVG's "(10 → 7 → 2)"** reads as a schematic in Fig. 1(c), **not** a reported benchmark ratio. Do not cite as a measured factor. ⚠️
- **arXiv IDs `2603.*`, `2604.*`, `2608.*`, `2609.*`** are very recent; venue / peer-review status not verified. ⚠️
- **SVGenius's exact leaderboard numbers** are in appendix tables I located but did not transcribe. ⚠️
- **Tooling note:** the harness `write`/`edit` tools failed with `EISDIR` on every path in this workspace (hard-link-on-rename bug), so this file was written via PowerShell. Same for the `.research/svg-gen/` corpus.

---

## 10. Link index

**Models / code**

- StarVector — https://github.com/joanrod/star-vector · https://arxiv.org/abs/2312.11556 · https://starvector.github.io/
- RLRF (StarVector follow-up) — https://arxiv.org/abs/2505.20793
- OmniSVG — https://github.com/OmniSVG/OmniSVG · https://arxiv.org/abs/2504.06263
- LLM4SVG — https://github.com/ximinng/LLM4SVG · https://arxiv.org/abs/2412.11102
- Chat2SVG — https://github.com/kingnobro/Chat2SVG · https://arxiv.org/abs/2411.16602
- SVGDreamer — https://github.com/ximinng/SVGDreamer · https://arxiv.org/abs/2312.16476
- SVGDreamer++ — https://github.com/ximinng/SVGDreamerV2 · https://arxiv.org/abs/2411.17832
- PyTorch-SVGRender — https://github.com/ximinng/PyTorch-SVGRender
- SVGFusion — https://github.com/ximinng/SVGFusion · https://arxiv.org/abs/2412.10437
- HiVG — https://github.com/ximinng/HiVG · https://arxiv.org/abs/2604.05072
- IconShop — https://github.com/kingnobro/IconShop · https://arxiv.org/abs/2304.14400
- DeepSVG — https://github.com/alexandre01/deepsvg · https://arxiv.org/abs/2007.11301
- LIVE — https://github.com/Picsart-AI-Research/LIVE-Layerwise-Image-Vectorization · https://arxiv.org/abs/2206.04655
- Im2Vec — https://arxiv.org/abs/2102.02798
- DiffVG — https://github.com/BachiLi/diffvg
- VectorFusion — https://arxiv.org/abs/2211.11319 (no official repo)
- StrokeNUWA — https://arxiv.org/abs/2401.17093
- SuperSVG — https://arxiv.org/abs/2406.09794
- DiffSketcher — https://arxiv.org/abs/2306.14685
- CLIPasso — https://github.com/yael-vinker/CLIPasso
- CLIPDraw — https://github.com/kvfrans/clipdraw
- Word-As-Image — https://github.com/WordAsImage/Word-As-Image · https://arxiv.org/abs/2303.01818
- Beyond Pixels / S2VG2 — https://arxiv.org/abs/2311.15543

**Tools**

- vtracer — https://github.com/visioncortex/vtracer
- paper.js (`PathFitter.js` = Schneider) — https://github.com/paperjs/paper.js/blob/master/src/path/PathFitter.js
- fit-curve (Schneider, JS) — https://github.com/soswow/fit-curve
- simplify-js (RDP lineage) — https://github.com/mourner/simplify-js
- fogleman/primitive — https://github.com/fogleman/primitive
- SVGO — https://github.com/svg/svgo
- autotrace — https://github.com/autotrace/autotrace
- picosvg (used by OmniSVG and Chat2SVG) — https://github.com/googlefonts/picosvg
- svgpathtools (StarVector augmentations) — https://github.com/mathandy/svgpathtools
- draw_with_llms (vtracer + scour, under 10KB budget) — https://github.com/tamchamchi/draw_with_llms
- goku-image-to-svg-tool — https://github.com/goku-open/goku-image-to-svg-tool
- vecsmith — https://github.com/defilantech/vecsmith

**Benchmarks**

- SVG-Bench — https://huggingface.co/collections/starvector/starvector-svg-datasets-svg-bench-67811204a76475be4dd66d09
- SVG-Stack — https://huggingface.co/datasets/starvector/svg-stack
- MMSVG-2M / MMSVG-Bench (OmniSVG) — https://huggingface.co/OmniSVG/MMSVG-2M
- SVGEditBench — https://arxiv.org/abs/2404.13710 · V2 — https://arxiv.org/abs/2502.19453
- VGBench — https://arxiv.org/abs/2407.10972
- SVGenius — https://github.com/ZJU-REAL/SVGenius · https://arxiv.org/abs/2506.03139
- VectorGym — https://arxiv.org/abs/2603.29852
- SVGauge — https://arxiv.org/abs/2509.07127
- SVG-Score — https://arxiv.org/abs/2609.03806
- SVGX-Dataset (SVGFusion, 240k human-designed SVGs) — via https://arxiv.org/abs/2412.10437

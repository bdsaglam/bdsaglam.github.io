# Continual Learning

*Memory, fast weights, and learning at many timescales — the mechanisms, rebuilt by hand.*

A course of runnable Jupyter notebooks. It teaches the **mechanism family** behind continual learning — associative memory, fast weights, test-time learning, updates at many timescales — by rebuilding each idea as the fix to a concrete limitation of an earlier one, in an order that is conceptual rather than chronological. It is **not** a survey of the continual-learning literature: no EWC, no replay, no class-incremental benchmarks.

**Published at:** <https://barisdeniz.is-a.dev/courses/continual-learning/>

This directory is the source. The rendered site is the same content with the notebooks' stored outputs — read it there, run it here.

## Layout

```
index.qmd        course front page and module map
cheatsheet.qmd   every formula, one line each
primers/         optional prerequisites (linear algebra, backpropagation)
foundations/     M1–M7, the spine; M7 is the hub tracks attach to
tracks/          self-contained spokes off M7
```

## Running it

**Colab — zero install.** Every notebook's first cell has an *Open in Colab* badge. torch, numpy, and matplotlib are preinstalled there.

**Locally, with [uv](https://docs.astral.sh/uv/):**

```bash
git clone https://github.com/bdsaglam/bdsaglam.github.io
cd bdsaglam.github.io/courses/continual-learning
uv sync
uv run jupyter lab
```

Dependencies are exactly `torch`, `numpy`, `matplotlib`, `jupyter`. Select the `.venv` interpreter and run any notebook top to bottom.

**Nothing needs a GPU.** Every notebook runs on a laptop CPU.

**What needs the network.** Two notebooks download a dataset once and cache it under `~/.cache/cl-course-data`:

| Notebook | Download |
|---|---|
| `foundations/m5-meta-learning-self-reference.ipynb` | Omniglot, ~10 MB |
| `tracks/nested-learning/nl1-aside-image-ttt.ipynb` | MNIST, ~11 MB |

Everything else is self-contained.

**Runtimes.** Most notebooks finish in seconds. Three take minutes: `foundations/m5-meta-learning-self-reference.ipynb`, `tracks/nested-learning/nl1-aside-image-ttt.ipynb` (whose first run is dominated by the MNIST download), and `tracks/nested-learning/nl3-aside-training-hope.ipynb`, which trains a HOPE block end to end. Which of them is slowest depends on your machine — see the next note.

**If a notebook feels absurdly slow, cap the thread count.** Several demos use tensors small enough that torch's intra-op parallelism costs far more than it saves, and the penalty grows with core count. On a 14-core machine `nl3-aside-training-hope.ipynb` took **9 minutes** with default threads and **23 seconds** under `OMP_NUM_THREADS=1` — same output, 24× apart, with two thirds of the slow run spent in the kernel rather than doing arithmetic. So:

```bash
OMP_NUM_THREADS=1 uv run jupyter lab
```

This is worth doing for the whole course; nothing here is big enough to benefit from threading.

## Adding a track

A track is a self-contained spoke off [M7 — the three dials](foundations/m7-three-dials.ipynb). Tracks never depend on each other.

1. Create `tracks/<slug>/`.
2. Write `tracks/<slug>/index.qmd`. It **must** open by stating the track's **dial setting** — which of the three dials (write rule, gate, optimizer) this line of work turns, relative to [M7 §3](foundations/m7-three-dials.ipynb)'s table of foundations modules as dial settings. This is the only required coupling to the rest of the course.
3. Number modules inside the track's own namespace: `<abbr>1-…`, `<abbr>2-…`. Nothing outside the track renumbers, ever.
4. Put the track in **M7 §5's write-rule zoo**. Usually the row already exists and its **"Covered in"** cell is a dash — a dash means the write rule is named there and covered nowhere else, so filling it in is the normal move. Add a new row only if no existing row describes the track's write rule. Then add a row to `index.qmd`'s **Tracks** table — track, the dial it turns, the question it answers.
5. Prerequisites may name foundations modules only — never another track.
6. Ship notebooks pre-executed with outputs committed. CI has no Python; `execute: enabled: false` is set for the whole course subtree. Give every notebook's first cell an *Open in Colab* badge pointing at its own path on `main`, as the existing modules do.

**Worked example.** A Mamba track would state: *the gate $\alpha_t$ becomes input-dependent — the $\Delta$ discretization step is the timescale, chosen per token.* That is the whole coupling. Concretely, that is M7 §5's **gated Hebbian** row, which already names Mamba-2 and carries a dash — so the track fills that dash rather than adding a row. It needs no Nested Learning material, and the NL track needs none of its.

## Writing a module

*Adding a track* is the structural contract. This is what a module should **be**. It applies to foundations modules, track modules, asides, and primers alike; a track module also binds to the contract above.

A module exists to teach **one idea**. The goal is educational, so it may **simplify to isolate the core concept**, and it may show that concept on a **toy or small example**. It is **not a recreation of the paper** — the reader can read the original, and [NL-3](tracks/nested-learning/nl3-hope.ipynb)'s code walkthrough already links two independent community reimplementations of HOPE. Reproducing a paper is their job. A module earns its place by making one idea legible, not by matching a table of results.

The line is not "no paper content" — it is **cite results, never chase them**. [NL-3](tracks/nested-learning/nl3-hope.ipynb) §6 reports HOPE's benchmarks (BABILong to ~10M tokens; 760M/1.3B params) and reproduces none of them, while its own §5 demo is a block that is "*a toy (forward-pass only, untrained) whose point is legibility*". When a claim needs scale, name it, cite it, and move on.

### Anatomy

The observed skeleton of a foundations or track module, in order. Marked parts are load-bearing.

```
# M4 — The delta rule / DeltaNet
**The question:** one line                            <- required
position in the spine · runtime · Colab badge         <- required
the limitation this module answers, in a paragraph
> **Prerequisite math** — … (only if it needs a primer)

## Objective                                          <- required; "After this module you should be able to:"
## Why it exists (the limitation it fixes)            <- required; the parenthetical varies, see below
## Core idea — read before you write
   ### Reading                                        <- required; grounding source, by section and equation
## 1. …  ## 2. …                                      prose → one code cell → a read-the-output paragraph
## Code walkthrough — the delta write in real code
## Exit check                                         <- required; ends with **Next →**
```

The grounding source appears once, early: as `### Reading` under *Core idea* ([M1](foundations/m1-associative-memory.ipynb)–M5, [NL-1](tracks/nested-learning/nl1-test-time-learning.ipynb)), under *Why it exists* ([M7](foundations/m7-three-dials.ipynb)), or as a `> Grounding:` blockquote in the title cell ([NL-2](tracks/nested-learning/nl2-levels-continuum-memory.ipynb), [NL-3](tracks/nested-learning/nl3-hope.ipynb)). *Core idea* and *Code walkthrough* are conventional, not required — M7 has neither.

### How a module opens

Each module opens from a limitation of an earlier one — where there is one. That holds for M2, M3, M4, M6 and NL-1, whose headings read *(the limitation it fixes)* or *(the limitation it removes)*. The heading is where you stay honest when it doesn't hold:

- **M1** and **M7** — *(the role it plays)*. M1 is "*the floor, not a fix — it's where the chain starts*"; "*M7 is not a fix*", it collapses the spine into one recurrence.
- **M5** — *(the limitation it **opens up**)*. M4 made the write a gradient step, which raises questions rather than exposing a defect.

Open from the previous module's limitation when there is one; name the parenthetical accurately when there isn't. Never manufacture a defect to fit the pattern.

### The demo

This is the heart. Keep it small enough to read in one screen — M7's entire `dial_board` is twelve lines; M4's `delta_write` is two. Legibility is the product.

A demo earns its module when **flipping the one thing the module is about changes the output, and nothing else does**. M7 §4 is the pure case: one implementation of the master recurrence, dials as keyword arguments, where `write="hebb"` vs `write="delta"` reproduces M4's whole argument — "*M4 is not a new model. It is `write="delta"`*". M4 §5 is the other shape: a stream of 2S writes over S revisited keys, where the additive rule's error stays high and delta's stays low until keys outnumber capacity.

**Evidence.** Most demos print a number or plot a curve, and the printed line says what to see; M4 prints its identity check (`torch.allclose(M_delta, M_sgd, atol=1e-6)`) rather than asserting it. Asserts are the exception — M1–M6 have none, and M7 §4 has six — reserved for claims that are exact identities: Hebbian and delta must produce the *identical* matrix on orthogonal keys, and delta must recover `vals[1]` on a revisited key. They are real tests. Mutate the write rule to always-Hebbian and the revisited-key assert fails; note that the orthogonal-keys assert *survives* that mutation, because it asserts a coincidence rather than a difference. An assert that cannot fail is decoration.

**Toy scale is a feature, not an apology — and it ships with a stated scope.** The convention is a bolded **Honest scope.** or **Caveats worth keeping honest.** paragraph naming what the toy settles and what it cannot. From the [continuum-memory aside](tracks/nested-learning/nl3-aside-continuum-memory.ipynb):

> **Honest scope.** The gain here is *modest* … The *large* payoff CMS is built for — resisting **catastrophic forgetting** across many tasks over a long lifetime (§7.1) — is not something a small linear toy shows cleanly; it needs the full nonlinear, nested machinery, meta-learned initial states, and scale … What this notebook *does* settle is the mechanical question.

The [HOPE-training aside](tracks/nested-learning/nl3-aside-training-hope.ipynb) makes the same move: "*It demonstrates that the assembled block trains and works, and that each ingredient earns its place — not the paper's full-scale results.*" Write that paragraph before anyone asks for it.

Honesty extends to the demo's rhetoric. M4 §4's test makes the global gate look strictly worse, and the module says so in the next breath — "*The demo makes the gate look strictly worse, and for this test it is*" — then gives the gate its due and names the paper that stopped choosing. A demo that stacks the deck must admit it.

### Asides

An aside is a companion notebook answering **one question** a module provokes, when answering it in place would derail the module. It is optional and says so.

Write one when the question is tangible rather than structural (the [image-TTT aside](tracks/nested-learning/nl1-aside-image-ttt.ipynb) exists "*for when the random key/value toy … feels abstract*"), when the answer needs a dataset or training loop the module doesn't ([HOPE-training](tracks/nested-learning/nl3-aside-training-hope.ipynb)), or when a module's simplification deserves the real thing (the [continuum-memory aside](tracks/nested-learning/nl3-aside-continuum-memory.ipynb) builds the $k\ge2$ CMS that the HOPE-training aside's $k$=1 MLP stood in for).

An aside has no *Objective*, no *Why it exists*, no *Exit check*. It opens in italics — *"A companion to NL-3, built to answer one question: … Optional: read it when NL-3 §5 points here."* — carries its own badge, and closes with **What this shows** plus the honest scope. The module points at it from the section that raises the question, usually from a Q callout.

Primers are the third form: optional, off the spine, opening with the same italic *"read it when a module points here"*, and closing with **Where it comes back** — a list of back-links to the modules that need it.

### Declining to cover

Declining is a legitimate end state, and M7 §5's write-rule zoo is where it is recorded: a row names the write rule, links its paper, and leaves a dash in **Covered in** — named here, covered nowhere else. Decline in place too, in a clause: NL-3 §5's block is forward-pass-only and names the chunk-wise parallel training it skips. Say where the frame strains rather than hiding it — "*a frame is only useful if you know where it strains*".

### Citations and Q&A callouts

**Verify every citation and quote against the primary source.** A correct section number does not make a quote real — grep the paper for the sentence. This course's own source material was found to carry two fabricated quotations and, in one module, 15 of 25 wrong citations. Quotes here are load-bearing (M7 §1 hangs the dial claim on one), so a fabricated quote is a fabricated argument.

Cite by section and equation, not just by paper — "[FWP] §4.2 (Eqs. 20–24, the delta instruction)". Papers are linked by **public URL only**: arXiv `abs` pages, a DOI where there is no arXiv (Oja 1982), a public PDF for pre-web work (Widrow & Hoff 1960). Where priority is contested, say so rather than picking a winner. Where the paper contradicts itself, say that too and quote both places — NL-3 §1 does it in a parenthesis; NL-2 escalates to a `callout-warning` when the paper "*indexes it both ways*". Mark your own reading as yours: "*The other three are our reading of the design — NL never raises collapse as a failure mode*".

**Q callouts** carry the objection a sharp reader raises *at that point*, which would break the section's flow to answer. They go immediately after the section that provokes them:

```
::: {.callout-note collapse="true"}
## Q: Isn't $\phi$ a fourth dial? It sits right there in the recurrence.
:::
```

Always `collapse="true"` — the module must read straight through without them. They are objections and clarifications, not quiz questions; quiz questions belong in the *Exit check*.

### Dimensions

- **Prose** 700–4,200 words: asides ~700–1,000, foundations 1,900–3,800.
- **Code** 50–310 lines across 2–7 cells. One cell, one idea.
- **Runtime** seconds on a laptop CPU. Minutes is the exception, and the title cell says so.
- **No GPU**, ever.

### Mechanics

- **Notebooks ship pre-executed.** CI has no Python and `execute: enabled: false` is set for the subtree, so Quarto renders the stored outputs. **Never strip outputs.** If you touch a code cell, re-run the notebook top to bottom before committing.
- **Never use `NotebookEdit`.** It writes a cell's `source` as a JSON string instead of nbformat's list of lines, which silently breaks `::: {.callout-note}` parsing. Edit the notebook JSON directly.
- **Colab badge** in the first cell, pointing at the notebook's own path on `main`:
  `[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/bdsaglam/bdsaglam.github.io/blob/main/courses/continual-learning/<path>)`
- **Dependencies are exactly torch, numpy, matplotlib.** Adding one changes the course, not just your module.
- **Course status lives in exactly one place** — M7 §5's zoo, in the **Covered in** column. Never in prose.

## Licence

Prose, figures, and course text (all `.qmd` files and every markdown cell): **CC BY 4.0**.
Code (every code cell in every `.ipynb`, all `.py` files): **MIT**.

Full text in [`LICENSE`](LICENSE).

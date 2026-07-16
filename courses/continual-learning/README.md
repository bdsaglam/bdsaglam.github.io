# Continual Learning

*Memory, fast weights, and learning at many timescales — the mechanisms, rebuilt by hand.*

A course of runnable Jupyter notebooks. It teaches the **mechanism family** behind continual learning — associative memory, fast weights, test-time learning, updates at many timescales — by rebuilding each idea in the order it was discovered, as the fix to a concrete limitation of the one before. It is **not** a survey of the continual-learning literature: no EWC, no replay, no class-incremental benchmarks.

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

## Licence

Prose, figures, and course text (all `.qmd` files and every markdown cell): **CC BY 4.0**.
Code (every code cell in every `.ipynb`, all `.py` files): **MIT**.

Full text in [`LICENSE`](LICENSE).

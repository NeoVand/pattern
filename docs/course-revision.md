# Course revision · September 2026

User-authorized scope: implement all ten review findings, add five complete chapters, match the existing illustration and widget style, and commit/push completed increments to `main`.

## Completion checklist

- [x] Independent test commitment and reveal experiment
- [x] Generalization remedies: data size, complexity, regularization, repeated samples
- [x] Inspectable gradient and weight update
- [x] Comparable representations and model families
- [x] Held-out adaptation and measured downstream transfer
- [x] Probability, calibration, imbalance, and decision costs
- [x] Forecast baselines, rolling origins, and changing conditions
- [x] Inspectable generative sampling mechanism
- [x] Accurate evaluation labels, repeated trials, and retrieval pipeline checks
- [x] Predict/experiment/explain activities and coherent chapter prerequisites
- [x] New chapter: data origins
- [x] New chapter: uncertainty and decisions
- [x] New chapter: distribution shift and causality
- [x] New chapter: instruction and preference training
- [x] New chapter: system choice capstone
- [x] Chapter and widget artwork integrated, with generation provenance
- [x] Numerical, browser, type, lint, and production checks
- [x] Desktop/mobile and dark/light visual review
- [x] Production deployment pipeline verified

## Implementation and evidence

This file records completed behavior and verification as each increment lands. Generated conceptual illustrations are identified as analogies. Numerical charts remain computed from the actual experiments.

### Foundation increment

Added the data-origins and probability/decision chapters, real numerical experiments, reflection notes, sources, and generated chapter plates. Added the one-neuron gradient inspector to the training chapter. Fourteen targeted numerical/browser tests pass, type checking reports zero errors/warnings, and touched files pass ESLint and Svelte autofixer. Artwork originals and prompts are recorded in `art-assets-v5.json`; five chapter illustrations have been generated for this edition.

### Completed course

The course now contains 25 chapters. The five additions cover data origins, uncertainty and decisions, distribution shift and causal questions, instruction/preference training, and a system-design capstone. Tokens and language precede word-model adaptation. Every chapter has concrete prediction, experiment, evidence, and transfer prompts, plus a worked explanation and browser-saved notebook.

All ten review findings have implementations: sealed final checks; data/complexity/penalty controls and repeated samples; chain-rule weight updates; actual model/feature comparisons; unseen adaptation and frozen-encoder transfer; calibration/confusion/cost analysis; chronological baseline forecasts and empirical coverage; a trained denoiser and sampler; honest repeated and retrieval evaluation; and a coherent activity sequence. The small-model and synthetic-data limitations remain visible beside the experiments.

### Artwork

Fifteen new illustrations match the established transparent ivory, blue, and lavender style. Existing approved images remain in place. Every chapter and new widget has an associated illustration, with provenance, exact generation prompts, dimensions, and placement documented in [the image manifest](art-assets-v5.json) and [coverage inventory](course-revision-art.md). Numerical plots continue to use computed values.

### Verification

- All 60 numerical and Chromium test files pass. The final suite includes 219 tests, including actual worker training, independent data splits, held-out scoring, cancellation, notebook persistence, and repeated-request/export behavior.
- Type checking reports zero errors and warnings; Prettier, ESLint, and the Svelte autofixers pass.
- The production build succeeds with `BASE_PATH=/pattern`.
- A production-browser sweep checks all 25 chapters at 390 and 1280 pixels, in light and dark themes: 100 page configurations, no horizontal overflow, broken images, or uncaught page errors. Screenshots were inspected for both chapter and widget layouts. Local review records are in ignored `test-results/course-review/`.
- An independent numerical review caught and fixed cost thresholds applied to distorted confidence. Production interaction review caught and fixed a checkpoint-initialization race: the active encoder is no longer changed while validating optional saved weights, and transfer waits for a ready worker snapshot. The regression test checks random versus explicitly selected saved weights.
- Extreme polynomial predictions leave the visible chart through a real SVG clip, with the viewing range labeled; their full values still contribute to error.
- Evaluation and retrieval service paths are verified with controlled mock responses. No real external model run is claimed by these tests. Local numerical experiments and built-in artwork generation were actually executed.
- GitHub Pages successfully deployed the completed chapter/artwork revision `a6a39ee`. Main pushes rerun type, lint, unit/browser, build, and deployment gates; the final verification fixes are included in the subsequent main revision.

Changes were committed and pushed to `main` in completed increments. See [learning machinery](learning-machinery.md) for the calculations and their limits.

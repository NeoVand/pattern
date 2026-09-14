# Pattern

An interactive field guide to machine learning: twenty visual chapters with real training, visible data splits, dark and light themes, language-model inference, and an inspectable agent loop.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Use the chapters or arrow keys outside form controls. The expand button hides the chapter rail. Lessons have URL fragments such as `#generalization`, `#classification`, and `#language`. Theme choice is saved locally; experiment state lasts until leaving a lesson. No API key is needed for the numerical training labs.

## Learning experiments

- **Why ML:** step through or run bubble sort, then train an actual image classifier, then use a vision-language model to caption a scene or generate speech. Original generated illustrations anchor the learning path, with full-size views for inspecting the details.
- **Training:** fit a regression line with live prediction errors and three loss curves. A visual explanation distinguishes practice, model selection, and final evaluation, including why reusing test scores invalidates an independent evaluation.
- **Generalization:** compare three polynomial capacities on training and held-out plots simultaneously. Add training data or regularize weights. Training, validation, and test errors remain visible. Only training examples affect fitting.
- **Classification:** actually train logistic regression on Fashion-MNIST sneakers and boots. Browse every split, filter mistakes, inspect images and learned pixel weights, and adjust the decision threshold. The gallery uses 320 training, 80 validation, and 120 official test images. Dataset source and license are in `static/data/`.
- **Forecasting:** choose café, electricity, or museum data; edit training observations, vary noise and seasonality, and inspect learned coefficients and prediction terms. Chronological train/validation/test splits remain visible.
- **Two neural networks:** train a nonlinear classifier on rings and a regressor on a curved target. The neural observatory displays every actual node and connection (27 nodes, 180 weights, and 25 biases at the default 2→12→12→1 architecture). Change inputs, step through a forward pass, select any neuron, inspect its weighted sum and activation, and view its response across the input space. All values come from the current trained network.

The TypeScript training engine uses full-batch backpropagation and Adam. Polynomial models use a regularized least-squares fit. Fashion-MNIST, MNIST, and TinyStories use real datasets; the other numerical labs use seeded synthetic teaching examples. Test visibility is for instruction: choosing models repeatedly against the test score would invalidate it as an independent final evaluation.

## The expanded learning path

The twenty chapters move from explicit algorithms and supervised learning to modern AI systems:

1. Why machine learning? — sorting, image classification, and captioning.
2. How learning happens — regression, gradients, and visible data splits.
3. Learning, not memorizing — overfitting, capacity, and regularization.
4. Telling things apart — a real Fashion-MNIST image classifier.
5. Looking ahead — compounding growth, exponential decay, and seasonal sales; editable data and chronological evaluation.
6. Discovering groups — run k-means on café preferences, inspect assignments and centers.
7. Learning from rewards — train a Q-learning delivery policy, change the map, and replay its route.
8. A network of small ideas — train two nonlinear neural networks.
9. Why go deeper? — representations and learned features.
10. Learning without labels — train a real MNIST variational autoencoder and explore its two-dimensional learned map.
11. From pretraining to purpose — pretrain and adapt a small next-word model; observe forgetting and the difference between training and context.
12. The bigger picture — machine learning, deep learning, and generative AI.
13. The pieces a model sees — genuine text token IDs, Unicode bytes, image patches, and audio windows.
14. The next token — transformers, live language generation, and a trainable TinyStories transformer with continuing training and saved samples.
15. Beyond words — actual OCR, spatial questions, uploads, and image comparison.
16. Creating something new — real OpenAI image generation, prompt experiments, variations, and downloads.
17. Finding the right context — embeddings, semantic retrieval, editable sources, and grounded answers.
18. Give the model a calculator — compare large multiplications with and without a real exact-integer tool.
19. From answers to actions — an actual model-directed tool loop.
20. Good answers need evidence — run six explicit checks, compare prompts, inspect failures and export results.

The adaptation model has 10,609 trainable parameters and learns a word-level softmax distribution; it is deliberately small and is not a transformer. Reinforcement learning uses a seeded Q-learning environment, not an LLM deciding moves. Both work without an API key.

Retrieval uses real `text-embedding-3-small` vectors with 256 dimensions, cosine ranking, and a two-dimensional PCA projection. The map is approximate; ranking uses the full vectors. The optional keyword baseline needs no API. Editing a source invalidates its embeddings and the previous answer. Grounded generation sends only the selected passages and asks for citations and abstention when evidence is missing. Citations still need human inspection.

Evaluation uses six deterministic checks, including arithmetic, exact JSON, missing evidence, quoted instruction attacks, and coverage gaps. These are teaching examples, not a broad safety or quality benchmark. Both prompt styles can pass; results are never adjusted to force an improvement. Retained runs last only for the current chapter visit.

The token chapter uses the actual `o200k_base` encoding through `gpt-tokenizer`, dynamically loaded on first use. It displays IDs, byte sequences, spaces, punctuation, and partial Unicode characters safely. The image explorer partitions every source pixel into a 4×4, 8×8, or 12×12 grid without cropping. The patch-to-embedding illustration is explicitly conceptual, not a trace from an OpenAI vision encoder or an estimate of API billing.

## Image captioning and artwork

The opening’s third example passes actual image pixels and the user’s question to a model. Choose one of two generated scenes or upload a PNG, JPEG, or WebP (up to 15 MB). The image alternative text and generation prompts are never passed as model context.

- Local captioning uses [SmolVLM 256M](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct), loaded separately from the text-only Qwen models. Transformers.js runs its vision encoder and decoder in a dedicated WebGPU worker, using the official browser example’s fp32 configuration (about 1 GB of weights). Download cancellation and generation stop are supported; weights are cached by the browser. Images remain on the device.
- OpenAI captioning uses the shared OpenAI connection and a vision-capable model. Images are sent as `input_image` data URLs using the [Responses API image-input schema](https://developers.openai.com/api/docs/guides/images-vision). `store: false` is set. The API key is never persisted.

The model is pretrained; this demo performs inference, not training. Captions can miss or invent details, especially with the small local model. The patch overlay is a conceptual illustration, not model attention or exact preprocessing.

Generated artwork lives in `static/images/`, optimized as WebP. See [art direction and exact prompts](docs/art-direction.md) and [the expansion artwork](docs/expansion-art.md) for generation mode, provenance, and original files. [Neuron and token infographics](docs/neurons-tokens-art.md) show the exact generation and refinement prompts for the two new scientific illustrations. Seven new images include sculptural explanations of clustering, rewards, adaptation, retrieval, vision, and evaluation, plus an original invitation for OCR. The vision chapter supports up to two images, 8 MB each; multi-image comparison uses OpenAI. Fashion-MNIST remains the actual classification dataset; the high-resolution shoe photograph only illustrates the categories.

## Real language models and agents

**Connect a model** offers two inference providers shared across all AI chapters:

- **Local WebGPU:** Transformers.js runs Qwen3 0.6B or 1.7B, quantized to q4f16, in a dedicated worker. Weights are downloaded from Hugging Face and cached by the browser. A WebGPU-capable browser/device is required. Prompts remain on the device. Loading progress, cancellation, generation stop, and errors are exposed. The language lab shows actual token IDs and decoded pieces.
- **OpenAI:** enter your own API key and choose from compatible models available to the account. Requests go directly to the Responses API with `store: false`. Keys remain in memory only; reloading or closing the page clears them. Prompts, selected images, and tool results are sent to OpenAI, and usage is billed to the key's account. The UI distinguishes streamed text chunks from actual token counts reported by the API. A static deployment never includes the developer’s key. During local development or preview, the optional connection described below can use a server-side `.env` key.

The agent calls three allowlisted read-only functions: `read_sales`, `summarize_sales`, and `calculate`. Its fictional shop dataset is visible and editable. The model chooses function calls; actual JavaScript functions execute them, and results are sent back to the model. Both single-step and automatic runs are supported, capped at seven model turns. Model-generated code is never executed. Tool arguments and results are visible in the trace. Local models can make mistakes or fail to complete a task; there are no canned replacement answers.

The conceptual transformer diagram uses explicitly illustrative vectors. The TinyStories workbench separately shows attention measured from the small transformer trained in the browser. See [learning machinery](docs/learning-machinery.md) for architecture, datasets, learning rules, and inspection details.

The tool-calling chapter (`#tool-calling`) compares fresh runs of the same model and prompt, with only calculator availability changed. The app executes `multiply_integers` using `BigInt`; operands (up to 80 digits each) and products remain decimal strings. Presets include 8×9, 20×20, and 40×40 digits, and inputs are editable. Both runs start together. OpenAI uses concurrent requests; local WebGPU uses two independent workers, loading a second copy of the model from the browser cache and releasing it after the comparison. The session remains busy until both runs settle, and Stop cancels both. The exact system prompt, user message, and provider-specific tool definition are visible before running. Each lane preserves a chronological transcript of every model turn, verbatim text, function call with its call ID, and actual returned content. Full request payloads and native response outputs can be expanded; local output also retains its original tool-call markup. Authentication headers are never included in the inspector. Verification requires a single full integer and reports exact matches or the absolute error without floating-point rounding. A missing tool call, malformed answer, or incorrect final answer is never replaced by a canned result. The calculator alone works without a model. Model runs support cancellation and stop after at most four turns and eight tool calls.

## Local OpenAI connection

To use your key across all demos without typing it into the interface, copy `.env.example` to `.env` and set `OPENAI_API_KEY`. `OPENAI_MODEL` optionally overrides the default model. Do not prefix either variable with `PUBLIC_`. Existing `.env` files should be edited rather than overwritten.

The local Vite server detects the key and the UI offers **This computer**. Requests go through a local-only middleware that adds the key on the server. The browser receives availability and the model name, never the secret. The middleware accepts only loopback requests with a same-origin check and an app-specific header, allows only model catalog, Responses, Embeddings, speech, and image-generation requests, restricts tools to the app’s functions, and sets `store: false` for responses. It is not a public hosted proxy and is not included in the static build.

`.env` and `.env.*` are ignored by Git; only the empty `.env.example` template is tracked. On a static host, visitors can use an in-memory personal key or a local WebGPU model. Semantic embeddings require OpenAI; the keyword baseline and numerical labs remain available offline.

## Interface

Svelte 5, TypeScript, Hugeicons, local fonts, and generated WebP artwork. Both themes use quiet tonal surfaces and restrained accents, with fewer dividers. All twenty chapters fit the independently scrolling navigation; the mobile drawer and presentation mode keep the experiment spacious. Keyboard focus remains visible and image details support keyboard panning.

## Checks and build

```sh
npm run check
npm run lint
npm run test:unit -- --run
npm run build
npm run preview
```

Production output is static in `build/`. Fonts and the image dataset are local assets. The inference worker and model weights load only when requested. Transformers.js includes Node-only transitive dependencies with upstream audit advisories; the static browser app uses its browser export, with no Node inference or image-processing service.

## GitHub Pages

The published app is at [neovand.github.io/pattern](https://neovand.github.io/pattern/). The [Pages workflow](.github/workflows/pages.yml) runs on pushes to `main` and can also be started manually from GitHub Actions. It installs locked dependencies with Node.js 24, runs type checks, lint, and the unit/browser suite, then builds and deploys `build/` to the `github-pages` environment. A failed check prevents deployment.

The build takes its base path from GitHub Pages configuration, so images, audio, datasets, and generated bundles work under `/pattern/`. To reproduce that deployment locally:

```sh
BASE_PATH=/pattern npm run build
BASE_PATH=/pattern npm run preview
```

Open the preview's `/pattern/` URL. Normal development and builds without `BASE_PATH` continue to use `/`. Repository Settings → Pages must use **GitHub Actions** as the build source. No OpenAI key or additional deployment secret is needed by the workflow; visitors connect their own model using the options above.

Numerical tests cover convergence, temporal splits, nonlinear capacity, overfitting, and regularization. Sorting tests cover order, value preservation, and termination. Inference tests cover fragmented SSE, multimodal image payloads, actual tool-call parsing, strict tool execution, editable data, and failure handling. Browser verification includes real local generation and agent execution from the original implementation. The expansion was tested with a supplied OpenAI key: live vision, retrieval, and evaluation calls. See [verification notes](docs/verification.md) for specific observations and limits.

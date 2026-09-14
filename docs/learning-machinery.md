# Visible learning machinery

The interactive values in these workbenches come from the models that make their predictions. Decorative diagrams and pedagogical simplifications are identified separately.

## Clustering

The café uses Lloyd's k-means algorithm in two measured dimensions. Assignment chooses the nearest current center by Euclidean distance. The next phase replaces each center with its members' coordinate average. The model contains two learned coordinates per cluster. Dashed Voronoi boundaries mark equal distance to neighboring centers. After a center move, old assignment colors can briefly disagree with the current nearest-center shading until the next assignment step; the interface explains this explicitly. This is illustrative café data, not a claim about natural categories of people.

## Reinforcement learning

The delivery world learns a table of four action values at each street. Both single-action inspection and full episodes use the same update:

`Q(s, a) ← Q(s, a) + 0.25 × [reward + 0.95 × max Q(next, ·) − Q(s, a)]`

The future term is zero on delivery. The exploration slider is the probability of a random action; otherwise a best-valued action is chosen, with random tie-breaking during learning. The route display follows the current greedy policy. The workbench exposes the old value, reward, next state, bootstrap value, target, and changed entry. A manually forced action is labeled as the user's choice. Maps are synthetic and episodes have a 200-move limit.

## TinyStories transformer

- Actual original TinyStories data: 2,097 complete training stories and 184 complete validation stories. The official splits remain separate. See `static/data/tinystories/corpus.json` for byte counts, source URLs, authors, transformations, and license; `scripts/prepare-tinystories.mjs` reproduces the bundled subset.
- Text is normalized to newline plus 95 printable ASCII characters. It is a character tokenizer with a 96-token vocabulary, not the tokenizer used by a commercial LLM.
- 32,768 trainable parameters: token and position embeddings, two pre-normalized causal transformer blocks, four attention heads, 32 embedding dimensions, a 128-dimensional ReLU feed-forward sublayer, and an untied output projection. Context is 64 characters. There are no learned biases or normalization gains in this small model.
- Training batches contain eight 64-character fragments and their one-character-shifted targets. Sampling boundaries prevent any training target from entering the validation split. Loss is mean next-character negative log-likelihood.
- A jitted WebGPU worker performs forward computation, automatic differentiation, and Adam updates (learning rate 0.001, beta1 0.9, beta2 0.99, epsilon 1e-8). Weights, optimizer moments, update count, and training random stream persist across training calls. Sampling has a separate random stream.
- The unseen loss uses four repeatable held-out batches, totaling 2,048 character predictions per check. It is an estimate on these fixed validation fragments, not a score over every validation character.
- The app saves samples every 50 updates and at a pause. Continue adds up to 500 updates. Switching the language chapter's tabs retains the worker; leaving the chapter or explicitly resetting discards it. The display retains the first sample as a baseline and the seven most recent samples.
- The next-character distribution is measured at the end of the displayed prompt. The attention inspector shows the last position of the last block's first head. It is actual attention, not a complete explanation of the prediction. The inspection forward pass is checked against the training forward pass, including causal masking and normalized rows.
- Async GPU readback is used throughout. Invalid zero/nonfinite training losses trigger an error rather than appearing as perfect performance. A browser with WebGPU is required; this workbench makes no OpenAI calls.

The transformer math is adapted from the user's Jaxverse `src/lib/llm/model.ts`. The worker and UI are tailored to Pattern. Small early runs learn letter and word patterns; this deliberately small model is not expected to produce polished prose.

## Generative image studio

The studio makes real OpenAI `images/generations` requests, using one of the compatible image models returned by the connected account's model catalog. It generates one PNG per request, offers three sizes and three quality levels, and retains six results during the chapter session. “Same prompt, new image” reuses the selected result's prompt, model, size, and quality. Downloads use local blob URLs. The app does not train or modify the image model's weights.

The development proxy keeps the environment key on the local server, validates the request, and retains the existing same-origin and app-header checks. A browser-entered key follows the existing direct connection path. The local WebGPU language model does not provide image generation. The API does not expose intermediate image-model activations, so the studio does not invent them.

## Continued training elsewhere

The adaptation example continues its softmax model rather than replaying the same initialization. Domain or adaptation-strength changes still reset the adaptation comparison deliberately. Further broad pretraining establishes a new base for adaptation. Regression and neural-network runs can continue beyond 600 epochs, and the image classifier beyond 200. Only explicit resets, new data, or architecture changes create new weights. Learning histories scale to the cumulative epoch count.

## Generalization: computed curves

The generalization illustration is now the experiment itself. Eleven equally spaced training observations follow a quadratic with a deliberately difficult, alternating noise realization. The straight and quadratic models use least squares; the degree-10 model uses stable barycentric interpolation and passes through all eleven training observations. Twenty validation and twenty test observations are distinct, independently perturbed positions. MSE is computed on each split. Validation selects among the three fitted models; test labels never change their weights or this selection. The graph uses shared axes across model choices, open test diamonds, and test residuals. A noise slider reveals that high degree alone does not guarantee failure: with zero noise the interpolator recovers the quadratic. The previous generated generalization artwork is no longer displayed.

## Forecast families

The three synthetic financial examples have intentionally distinct behavior: exponentially compounding subscription revenue, exponentially declining asset value, and annually seasonal retail sales. Each contains 72 months, split chronologically into 42 training, 15 validation, and 15 test observations. Twelve additional months are model-only forecasts. Editable observations are confined to training. Users can change the data noise/rate and compare level, linear trend, seasonal regression, and log-linear exponential regression.

The exponential model fits squared error in normalized log-values and exponentiates its prediction. Its displayed initial value, monthly rate, and compound factor come from the actual coefficients. This is a typical multiplicative trajectory, not a bias-corrected conditional mean. All displayed MAEs remain in original $k units. Matching noiseless scenarios and models recover the held-out trajectories in tests; training values alone determine coefficients. Forecast training continues until paused or reset.

## Compact neighborhoods

Clustering points no longer have pointer handlers. A small previous/next control selects the example whose distances are compared. The map, actual center table, members, next coordinate averages, and training step share a compact workspace. A separate k-NN view uses supplied synthetic drink labels, sorted Euclidean distances, and uniform majority voting; ties choose the closest member of a tied class. Its model is the stored labeled examples, not k-means centers. A dashed radius reaches the kth neighbor. Two optional generated infographic studies live at `/art-review/neighbor-studies/`; neither replaces the computed diagrams.

## Image autoencoders start from scratch

The VAE can train on MNIST digits or all ten Fashion-MNIST clothing categories. MNIST uses 8,000 training images; Fashion-MNIST uses 12,000. Both retain 2,000 official test images. Each choice starts from random weights and offers a separate saved example trained for 10,000 updates. The saved example is an explicit opt-in. Switching datasets destroys the previous workbench and worker and resets all model, optimizer, history, and exploration state; late data loads cannot replace the new selection. Labels never enter the worker.

Training runs until the user pauses, resets, switches datasets, leaves the chapter, or hides the tab/workbench. Early snapshots arrive every eight steps through step 160, then every forty steps. The loss history retains its latest 300 snapshots. All 2,000 test encodings are refreshed in a snapshot; test images never enter gradients. Both choices share the same architecture and training implementation. The checkpoint script accepts `--dataset fashion` to reproduce the clothing model; the default still builds MNIST. See [Fashion-MNIST model provenance](../static/data/FASHION-AUTOENCODER-PROVENANCE.md).

Hovering in Inspect mode follows actual displayed image locations. Dragging or coordinate sliders explores free decoder coordinates; the reference image follows the nearest real encoding and is labeled “Nearest real digit” or “Nearest real item.” Inference from those free coordinates is labeled “Decoded point.” The same reference updates during interpolation. Flare is the image studio's default when available to the connected account.

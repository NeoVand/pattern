# MNIST in Pattern

MNIST is the handwritten-digit dataset by Yann LeCun, Corinna Cortes, and Christopher J. C. Burges. Original source: http://yann.lecun.com/exdb/mnist/ . The Common Visual Data Foundation provides an authorized download mirror: https://github.com/cvdfoundation/mnist .

## Images and official split

The four `mnist-{train.png,test.png,labels.bin,meta.json}` assets were copied from the sibling Jaxverse project. Jaxverse's `scripts/build-mnist.mjs` packs original IDX bytes into lossless grayscale PNG tiles, preserving order and the original training/test boundary:

- First 8,000 of the official 60,000 training digits, 28 × 28 pixels.
- First 2,000 of the official 10,000 test digits, 28 × 28 pixels.
- 100 tiles per spritesheet row; training sheet 2800 × 2240, test sheet 2800 × 560.
- Label bytes: 8,000 training labels followed by 2,000 test labels.

On 2026-09-11, every bundled pixel and every label was compared byte-for-byte against the original IDX files from https://storage.googleapis.com/cvdf-datasets/mnist/ (the four files linked by CVDF). All 10,000 examples matched exactly. These are real handwritten MNIST images, not generated digits or font glyphs.

SHA-256 of bundled assets:

- `mnist-train.png`: `bd8f45822a14141c37b6796582bf5c2b28c3f8ed3e3e19833e06dd35b566202a`
- `mnist-test.png`: `ff648c8dd4903f40111d16d6e5d12143c707a655ca19c9029c9ebe37b622a8b1`
- `mnist-labels.bin`: `c3568ce30f3a5ed6673a74cd30370490736efded22af73831c65946f2d14c639`
- `mnist-meta.json`: `e79c4b4129ab64352809857be5b4a47a3d58884aba1288acb97b8fc7963a8087`

## Variational model, training and display

Following the actual latent lab in Jaxverse (`src/lib/components/demos/latent/latent-context.svelte.ts` and `src/lib/nn/worker.ts`), Pattern now uses a **variational autoencoder**, not the earlier plain tanh autoencoder. Its widths are `784 → 128 → 32 → 2 → 32 → 128 → 784`. The bottleneck head actually emits four values: two means and two log variances. GELU is used in the hidden layers; the Gaussian head and final readout are linear. During training the decoder receives `mean + exp(logVariance / 2) × normalNoise`. Every plotted coordinate is the encoder's actual two-dimensional mean for a real held-out digit. There is no PCA, t-SNE, UMAP, label-based placement, or spatial jitter.

Training uses batches of 128 training images sampled uniformly with replacement. The objective is mean pixel MSE plus `(1 / 784) × mean KL(q(z|x) || N(0,I))`, following Jaxverse's MSE-unit scaling. Adam uses learning rate 0.003, beta1 0.9, beta2 0.99, epsilon 1e-8. Labels never enter the worker. The 2,000 official test images never enter gradients.

The browser backend is JaxJS: GPU-compiled batched matrix operations when WebGPU is available, with compiled WebAssembly fallback. Gradient calculation and Adam are fused in one JIT program. Bias-correction scalars are computed on the CPU and passed as tensors; this avoids Optax's synchronous `count.item()` calls inside each batch. All GPU readbacks use asynchronous `data()`, not the OffscreenCanvas-based synchronous read path. Model weights, moments and compute stay in the worker. Forty updates form a display checkpoint; a live run stops after 200 updates and can be resumed. Pause, offscreen/background visibility and chapter teardown stop active work.

Displayed MSE uses deterministic latent means and **raw linear decoder outputs**: the first 256 training images and **all 2,000 test images**. Per-image errors are averaged in JavaScript float64 to avoid precision loss from summing 1.6 million pixels in one float32 reduction. Display alone clips reconstructed pixel values to 0–1. Probe movement and morphing perform local deterministic decoding and never update weights.

All 2,000 held-out digit images are drawn at their real coordinates. The frame stays fixed at `[-3.8, +3.8]` on each axis rather than reframing after every update. The KL term encourages a centered, continuous map; it is a soft penalty, not a hard bound. Off-frame points can occur during training. Geometry eases between actual checkpoints with stable image identities; local probe dragging follows the pointer immediately, with pointer capture through release. Reduced motion disables checkpoint interpolation.

## Optional learned starting point

`mnist-autoencoder.f32` is an explicitly labeled learned starting point trained from random weights on the 8,000 official training images only. It uses the same GELU VAE architecture and objective, 10,000 Adam updates, batch size 128, NumPy seed 7. Reproduce it with `python scripts/train-mnist-checkpoint.py 10000` (requires NumPy and Pillow). The script never loads labels.

Held-out MSE on all 2,000 official test images: **0.0424393**. MSE on the first 256 training images: **0.0320556**. Latent means span approximately x `[-2.815, 3.506]`, y `[-3.120, 3.261]`. Exact configuration and weight hash are in `mnist-autoencoder.json`. Packed format: little-endian float32, each layer's output-major weights followed by its biases; the Gaussian head has four outputs. SHA-256: `77db749deacf62cd5d1e6781d597b7f874f958e19d1924b92462af6efdd23531`.

The browser starts new optimizer moments when loading saved weights. “Random weights” uses no checkpoint and runs genuine gradient updates. The CPU reference equations are independently checked against the JaxJS training update, output pixels and held-out coordinates. GPU and WASM full-test measurements agree with the reference to approximately 3e-9 at initialization in the recorded local benchmark.

Sources: [JaxJS repository](https://github.com/ekzhang/jax-js), the local Jaxverse implementation cited above, and the original MNIST data mirror already listed.

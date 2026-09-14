# Fashion-MNIST autoencoder in Pattern

Images come from [Fashion-MNIST by Zalando Research](https://github.com/zalandoresearch/fashion-mnist), under the bundled [MIT license](FASHION-MNIST-LICENSE.txt). The existing lossless sprites contain the first 12,000 official training examples and first 2,000 official test examples in their original order. Each image is 28 × 28 grayscale pixels. See [dataset packing](README.md).

The autoencoder uses all ten clothing categories. Training receives only image pixels; category labels are used for map colors, filters, and inspection names. The 2,000 official test images are used for reconstruction measurements and the learned map and never enter gradients.

## Same architecture, separate weights

Fashion-MNIST and MNIST use the same variational architecture: 784 → 128 → 32 → 2 → 32 → 128 → 784. The Gaussian head emits two means and two log variances. Hidden layers use GELU; the Gaussian head and pixel readout are linear. The objective is mean pixel MSE plus (1/784) × mean Gaussian KL toward a unit Gaussian. Training samples from the predicted Gaussian; displayed reconstructions and map coordinates use its means.

New runs start from random weights. Switching datasets terminates the previous worker and creates a fresh model, optimizer, loss history, and map. Live training uses batches of 128 images sampled uniformly with replacement, with Adam at learning rate 0.003, beta1 0.9, beta2 0.99, and epsilon 1e-8. JaxJS compiles the same computation for WebGPU or WebAssembly. Learning continues until paused, reset, switched, hidden, or unmounted.

## Optional saved example

`fashion-autoencoder.f32` was trained independently from random weights on the 12,000 training images, using 10,000 Adam updates, batch size 128, and NumPy seed 7. No digit-model weights or labels are used. Reproduce it from the repository root:

```sh
python scripts/train-mnist-checkpoint.py 10000 --dataset fashion
```

Requires NumPy and Pillow. The script never reads labels. All 10,000 updates are performed; test measurements do not choose the weights.

Final deterministic reconstruction MSE is **0.0319108** over all 2,000 official test images and **0.0318174** over the first 256 training images. These values use raw linear decoder outputs; only rendered pixels are clipped to 0–1. The two-number bottleneck loses detail and can blur clothing shapes.

Exact configuration, source hashes, and measurements are in [fashion-autoencoder.json](fashion-autoencoder.json). Packed weights are little-endian float32: each layer's output-major weights followed by biases, with four outputs in the Gaussian head. Weight SHA-256: `5d41f29ef6c53aae30654121ff038fe9edf5b6b8636f23cae9f54a8668988af6`.

Loading the saved example starts fresh optimizer moments. Continued browser training then uses Fashion-MNIST training images only. Both datasets retain the same fixed map frame of −3.8 to +3.8 on each axis, with each image at its actual encoder mean.

# Fashion-MNIST image assets

Source: https://github.com/zalandoresearch/fashion-mnist (Zalando Research).
See FASHION-MNIST-LICENSE.txt for the MIT license.

Packed by the sibling Jaxverse project's scripts/build-fashion.mjs from the official IDX data, preserving the original ordering and official training/test boundary. These sprites contain the first 12,000 training images and 2,000 test images. Tiles are 28 × 28, 100 columns per sheet; labels are 12,000 training bytes followed by 2,000 test bytes.

Pattern's two-class image classifier uses labels 7 (sneaker) and 9 (ankle boot). For each class it takes the first 160 matching training images for fitting and the following 40 for validation, plus the first 60 matching official test images. The gallery interleaves the two classes for easier inspection. Pixels are averaged in 2 × 2 blocks to produce 196 input features.

The convolutional chapter uses all ten classes. The Learning Without Labels autoencoder also uses all ten classes, with all 12,000 training images and 2,000 test images at their original 28 × 28 resolution. Its worker receives pixels only; labels color and name the examples in the explorer. The optional autoencoder starting weights are separate from both the convolutional classifier and the MNIST digit autoencoder. See [autoencoder provenance and reproduction](FASHION-AUTOENCODER-PROVENANCE.md) and `fashion-autoencoder.json` for the training configuration, measurements, and hashes.

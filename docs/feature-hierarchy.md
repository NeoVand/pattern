# Reading the Fashion-MNIST feature hierarchy

The connected network and guided interpretation view sit above the live activation inspector in “Why go deeper?” (`#representations`). It shows input patterns that strongly excite the saved ConvNet, alongside their source images. The existing activation inspector continues to show where a feature responds within one image.

## The connected network

The overview displays the actual architecture: 784 image inputs, eight 14 × 14 maps, sixteen 7 × 7 maps, twenty-four 4 × 4 maps, then a flattened vector of 384 values and ten dense output neurons. It shows every feature map and every output, using inference on the currently inspected image. No neuron count is truncated or replaced with decorative nodes. Feature maps contain 1,568, 784, and 384 neurons respectively; the flattening step reuses those final 384 activations.

Each convolutional curve summarizes one 3 × 3 kernel slice between two maps. All map-to-map links are present; links adjacent to the selected map are emphasized, with opacity based on the root mean square of its nine weights. Dense links summarize the weights feeding each output. On phones the dense fan is bundled into one connection to the ten-output group. These are grouped connections, not claims that every spatial neuron is fully connected to every spatial neuron in the next convolutional layer.

Any of the 48 maps can be selected. Selection updates the real example collection, receptive field, neuron close-up, and any available interpretation. The nine guided filters retain their concept descriptions; the other filters are explicitly unnamed. Smoothing the selected input patch reruns the model, updating all displayed maps and output probabilities.

“Inside one neuron” computes the exact weighted sum across every incoming map, its bias, and ReLU. Nine input values and weights are displayed at a time, with the remaining maps' contribution explicitly included; cycling the shown input map does not change the output. Border inputs use the model's actual zero padding. “Follow the signal” is a slowed visual walkthrough of the already calculated forward pass, with six steps and reduced-motion support.

## Evidence and selection

`scripts/build-feature-atlas.py` evaluates the first 2,000 bundled **training** images using the saved `fashion-convnet.f32` checkpoint. It finds the strongest interior post-ReLU response for each channel in each image, then retains the six highest-scoring distinct images. Interior locations exclude padding. Labels describe the selected images but do not determine their ranking. The atlas includes the checkpoint SHA-256, checked when the view loads.

Three stride-two, padded 3 × 3 convolutions produce receptive fields of 3 × 3, 7 × 7, and 15 × 15 input pixels. Nine channels were chosen after inspecting the highest-response crops and their whole-image context:

| Layer    | Channels, numbered from 1 | Interpretation of observed matches                            |
| -------- | ------------------------- | ------------------------------------------------------------- |
| Edges    | 4, 7, 8                   | Vertical boundary, narrow bright stroke, lower edge           |
| Contours | 3, 11, 12                 | Turning lower contour, rising outline, broad lower border     |
| Parts    | 7, 9, 23                  | Toe and upper, separated trouser legs, straps and open spaces |

These are descriptions of the evidence, not names learned by the network or proof that a channel uniquely detects one concept. The image patches, responses, and receptive fields are real model outputs and inputs. No generated illustration or synthetic activation stands in for them.

## Interactive probe

Selecting a match shows its complete source image and exact receptive field. The slider blends only the receptive-field pixels toward their original mean brightness. It preserves the patch mean while removing local structure; the browser reruns the fixed checkpoint and measures the same unit. Responses need not decrease monotonically for every feature. The gallery stays tied to its reference checkpoint, even when the learner trains the separate activation inspector below it.

## Reproduction and checks

Run `python scripts/build-feature-atlas.py` with PyTorch, NumPy, and Pillow installed. The shipped atlas contains only match coordinates, scores, labels, and provenance (about 17 KB). The script additionally creates diagnostic input-optimization studies and contact sheets in ignored `test-results/feature-hierarchy/`; those optimized images are not displayed in the app.

The browser tests compare all 288 matches across 48 channels against actual inference, verify the smoothing operation and its analytical first-layer response, and exercise feature selection and the probe in both themes. Neuron tests include all incoming channels, border padding, biases, and ReLU. UI tests check that all ten outputs agree with inference and change along with the smoothing probe. The visual checks include all three layers, original and smoothed matches, desktop and phone layouts, and the unchanged live activation view.

The distinction between feature visualization and dataset examples follows [The Building Blocks of Interpretability](https://distill.pub/2018/building-blocks/).

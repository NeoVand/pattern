# Illustration review · edition 3

The latest user curation is applied. Twelve edition-3 illustrations are now explicitly selected by the user. The six requested retained illustrations remain unchanged: learning landscape, data split, clustering, seeing in layers, adaptation, and multimodal vision.

The gallery at `/art-review/index.html` contains seventy candidates, with self-supervision H selected and the rejected A–E directions archived. The static bigger-picture map is also archived because the interactive map already teaches that relationship. The redundant atlas and rejected self-supervision illustrations do not appear above the live chapters.

| Chapter                       | User choice      | Review                                                                                                                                                                                                                |
| ----------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why machine learning?         | D                | Explicit Rules / Learning contrast; correct sorting result and varied complete boots.                                                                                                                                 |
| Recognizing patterns          | E                | Full footwear profiles with supporting rear views; consistent muted blue and lavender.                                                                                                                                |
| Learning, not memorizing      | D                | Clear differences in flexibility, held-out points visible, compact readable comparison. Illustration of fit behavior, not a measured experiment.                                                                      |
| Looking ahead                 | A                | The observed blue rhythm continues into a dashed forecast and widening lavender uncertainty bands. Clear labels, consistent palette, and a compact composition. The bands are illustrative, not calculated intervals. |
| Learning by acting            | B                | The maze geometry stays consistent while wandering attempts give way to a successful route. Clear comparison without decorative machinery.                                                                            |
| Knowledge at hand             | A                | User-selected botanical source cards, regenerated with separate Fern-to-Fern and Moss-to-Moss connections. Only illustrative Source 1 and Source 2 tabs, with no invented reference citations.                        |
| Trust, but test               | B                | User-selected contrast between a convincing response and checking the evidence. The two summit elevations illustrate conflicting claims, not verified measurements of a named mountain.                               |
| Neural networks               | A                | All three weighted inputs and the separate bias feed the sum before activation; complete readable labels.                                                                                                             |
| A world made of tokens        | A                | User-selected text pieces and butterfly image patches, each mapped into vector capsules. The bead colors are schematic placeholders, not measured embeddings.                                                         |
| The bigger picture            | Interactive only | The interactive map already explains these relationships; a second static map repeats the idea.                                                                                                                       |
| Language, one token at a time | C                | User-selected context, transformer block, and next-token alternatives. Regenerated with exactly five context positions and a matching five-by-five lower-triangular causal mask.                                      |
| From answers to actions       | A                | User-selected Goal, Model, Tool, Result, and Done cycle. Model requests a tool, receives its result, and decides how to continue.                                                                                     |
| Learning without labels       | H                | An open book supplies the next-word target. Installed after the user selected H; the chapter distinguishes text continuation from its live MNIST reconstruction objective.                                            |

## Revised diagrams

- Retrieval A retains the botanical source-card concept. Fern connects from its own top edge to the Fern answer; Moss connects from its own right edge to the Moss answer. The original source remains recorded. The final illustration has generic source tabs rather than invented external citations.
- Language C retains the context → transformer → next-token composition. The five context positions now match a five-by-five lower-triangular causal mask. Blue cells indicate allowed positions, not measured attention weights. Probability bars remain illustrative.
- Image-edit attempts that returned baked checkerboards were rejected. Both final diagrams were regenerated from text with genuine alpha. Intermediate outputs and full prompts are preserved in `art-revisions-v3.json`.

## New self-supervision directions

| Choice | Concept                                            | What supplies the target  |
| ------ | -------------------------------------------------- | ------------------------- |
| F      | A concealed detail in a ceramic-pitcher photograph | The original image        |
| G      | A water-drop sequence with its next frame revealed | The observed next moment  |
| H      | An open book and a highlighted continuation        | The following text        |
| I      | Two cropped views of the same shell photograph     | Their known common source |
| J      | A noisy copy alongside the clean original          | The unmodified image      |

These are teaching analogies, not model outputs. F shows a hidden visual detail rather than an exact pixel-aligned patch. I illustrates positive-pair construction; an actual objective also needs to avoid a collapsed representation. J illustrates denoising, while the current MNIST lab trains a variational autoencoder. H is now installed by explicit user choice; F, G, I, and J remain available for comparison.

## Exports and verification

- Built-in image generation was used throughout. Original locations, concepts, revisions, and selection provenance are recorded in the art JSON manifests.
- Selected output files have genuine alpha. Only unused outer canvas is trimmed, with a two-percent safety margin. No subject or label is cropped.
- Full and 800-pixel WebP exports live in `static/images/edition-3/`; seventy review thumbnails live in `static/art-review/`.
- Proofs use the exact app backgrounds `#141619` and `#edf0f6`. All visible text, connectors, subjects, and cutout edges are reviewed in the composed result.
- Alt text, captions, intrinsic dimensions, and notes describe the selected images. Illustration claims remain distinct from measured lab behavior.

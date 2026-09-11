# Verification — September 10, 2026

## Automated checks

- `npm run check`: no errors or warnings.
- `npm run lint`: Prettier and ESLint pass.
- `npm run test:unit -- --run`: 50 tests across eleven files pass, including browser interactions.
- `npm run build`: static production build succeeds.
- Numerical tests cover regression, overfitting, nonlinear networks, chronological splits, sorting, k-means convergence, Q-learning, and actual adaptation of word probabilities.
- Inference tests cover fragmented SSE, multimodal payloads, tool calls, retrieval ranking/projection, source grounding, and explicit evaluation criteria.
- Network tests verify the complete architecture, every incoming contribution, activation arithmetic, input changes, prediction traces, and linear regression outputs.
- Token tests verify actual `o200k_base` IDs, exact text reconstruction, Unicode byte fragments, and image partitions that cover every source pixel exactly once.

## Live OpenAI checks

Used the supplied local `.env` connection with `gpt-4.1-mini`; no key value was displayed or stored in test artifacts.

- Language: a three-sentence answer generated and streamed successfully; API usage reported 43 input and 45 output tokens.
- Agent: five model turns selected four real tool calls (read sales, summarize weekdays, summarize weekends, calculate). The final answer correctly reported 140 weekday items, 245 weekend items, and a difference of 105.
- Vision OCR: invitation title, Saturday 18 October, doors 18:30, and tour 19:00 were correct. The model acknowledged the missing location.
- Vision spatial questions: cup, fern, invitation, and their relative positions were correctly described.
- Vision comparison: distinguished the garden/dog/ball/bench scene from the coast/sailboat/lighthouse scene.
- Vision upload: an actual WebP uploaded through the file chooser was correctly described as a green/beige sneaker and a brown leather boot.
- Vision cancellation recovered the controls; retry completed successfully.
- Retrieval: real 256-dimensional embeddings ranked the source library, and generation cited the ticket passage with the correct £12 adult price and free child admission. Editing the source to £15 and rebuilding embeddings changed the answer to £15. A parking question correctly received an answer that the notes do not provide the information.
- Evaluation: both brief and careful prompt styles scored 6/6 on the six explicit checks. This small test suite does not establish general reliability. Cancellation left the active case Stopped and the remainder Not run, and saved runs remained accessible.

## Visual review

Desktop and 390-pixel mobile layouts inspected in light and dark themes. All seventeen chapters are reachable; the sidebar scrolls independently and its footer does not overlap the final chapter. No mobile horizontal overflow observed. Original training/validation/test visibility was preserved. Image details support keyboard panning without switching chapters.

### Neural and token revision

- The default classifier renders all 27 nodes (2 inputs, two layers of 12 neurons, one output), all 180 weights, and 25 biases. Selecting hidden-layer neuron 12 exposes its twelve actual incoming contributions.
- A live browser run completed 600 training epochs and reached 100% accuracy on the 32 held-out synthetic test examples. This verifies this teaching experiment, not general model performance.
- The network was inspected on desktop and phone, in both themes. Changing an input changes the selected neuron's calculation. The complete graph can pan horizontally on small screens.
- The dedicated tokens chapter shows actual local tokenization, including spaces, multilingual text, and emoji byte fragments. Image mode supports 16, 64, and 144 patches, two source images, selection, magnification, separation, and reassembly.
- Both generated infographics were visually inspected and refined for correct arithmetic and counts: sixteen image patches correspond to sixteen illustrated embeddings. The artwork is conceptual; the live explorer uses exact source pixels.
- The full 1536 × 1024 footwear photograph preserves its aspect ratio. Desktop and phone checks confirmed that the boot shaft is visible, both silhouette controls work, and the phone page stays within its 390-pixel viewport.
- The local app returned HTTP 200 and `.env` remains ignored by Git. OpenAI request code was unchanged in this revision; the live API checks below were performed during the earlier expansion.

## Key handling

Six local middleware checks passed: missing app header and foreign origin were rejected; unsupported routes and tool types were rejected; a null payload returned a validation error; local availability returned success. The actual secret was compared against 168 generated build/output files and found zero times. Only counts, never the key, were logged.

## Limits

OpenAI outputs vary by model and sampling. Vision, retrieval citations, and agent results can be wrong. The local Qwen/SmolVLM pathways were verified in the previous implementation; this expansion's new live end-to-end checks used OpenAI. The six evaluation examples are instructional, not a comprehensive benchmark. The local development proxy is not a production hosting service.

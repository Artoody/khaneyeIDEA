# Idea House intro (5 s motion piece)

A 5-second brand intro for the welcome page, built from the logo itself.

## Storyboard

| Time | Beat |
|---|---|
| 0.0 to 0.6 s | A single spark of light appears in the dark. A ring wave reveals a faint PCB dot grid. |
| 0.1 to 1.4 s | Circuit traces route in from every edge toward the centre, carrying signals. |
| 0.4 to 1.1 s | The spark splits into four streaks, one for each circuit of the logo. |
| 0.6 to 2.0 s | The four logo traces solder themselves in: molten white-hot heads, sparks, cooling to brand amber. Each node pops with a spring and a shockwave ring. |
| 2.0 to 2.6 s | Power on: a white-hot packet runs the whole circuit, the nodes flash, and a ripple travels through the grid. |
| 2.3 to 3.2 s | The house glides left. "Idea House Academy" rises in letter by letter, out of blur. |
| 3.4 to 4.2 s | Tagline "Where ideas become robots." appears; a signature trace draws beneath it and ends in a node. |
| 4.2 to 5.0 s | Hold. Small current packets keep circulating in the logo; signals flow back out along the traces. |

## Craft notes

- Logo geometry is decoded from the brand mark: a 45 degree circuit house with 22 px traces, stretched 1.24x horizontally, and round 19.5 px nodes.
- The bloom is composited behind the crisp mark, so the stroke stays exactly brand amber `#FFB347`.
- Rendering is deterministic (`render(t)`), captured at 120 fps and blended to 60 fps for a natural motion blur.
- Film grain prevents gradient banding after compression.
- Typeface: Geist (SIL Open Font License, see `fonts/LICENSE.txt`).

## Rebuild

```bash
npm i playwright-core   # once, or symlink an existing node_modules
node render.mjs frames /tmp/intro-frames 120
./encode.sh /tmp/intro-frames out
```

`node render.mjs stills <dir> 0.5 2.2 4.9` renders single frames for review.

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

## Sound design

`sound.py` synthesizes the whole soundtrack from scratch (no samples, no licensing issues) and places every sound on the exact event timeline exported from the scene:

| Visual | Sound |
|---|---|
| Idea spark | glassy high glint and a soft falling air ring |
| Spark splits into four | four rising zips, panned toward each circuit |
| Traces soldering in | electric crackle that pans along each trace, sparks as tiny crackles |
| Nodes pop | an A major arpeggio (A, C sharp, E, A), one note per circuit |
| Power on | riser cut dead into a sub boom with a bright transient and zap; the chord rings once |
| House glides left | filtered whoosh moving left |
| Letters and words | soft ticks |
| Signature node | ping into a warm A add9 bell chord |

Mastered to about -13.5 LUFS integrated, -1 dBTP peak. Note: browsers only autoplay video muted, so on the website sound plays only after the visitor taps a sound toggle.

## Rebuild

```bash
npm i playwright-core   # once, or symlink an existing node_modules
node render.mjs frames /tmp/intro-frames 120
node render.mjs events /tmp/intro-frames      # event timeline for audio
python3 sound.py /tmp/intro-frames/events.json out/idea-house-intro.wav
./encode.sh /tmp/intro-frames out
```

`node render.mjs stills <dir> 0.5 2.2 4.9` renders single frames for review.

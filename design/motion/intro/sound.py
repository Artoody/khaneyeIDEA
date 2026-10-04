"""Procedural sound design for the Idea House intro.

Every sound is synthesized from scratch (no samples, so no licensing issues) and is
placed on the exact event timeline exported from scene.html (render.mjs events).

Usage: python3 sound.py <events.json> <out.wav>
"""
import json
import math
import sys
import wave

import numpy as np

SR = 48000
ev = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
DUR = ev["DURATION"]
N = int(SR * DUR)
rng = np.random.default_rng(1405)

dry = np.zeros((N, 2))   # sub / pad bus (kept dry for a tight low end)
fx = np.zeros((N, 2))    # everything else, sent to the reverb


# ---------------------------------------------------------------- helpers
def tvec(n):
    return np.arange(n) / SR


def place(bus, t0, sig, pan=0.0, gain=1.0):
    """Add a mono or stereo signal at time t0 with equal-power panning."""
    i0 = int(round(t0 * SR))
    if sig.ndim == 1:
        a = (pan + 1) * math.pi / 4
        sig = np.stack([sig * math.cos(a), sig * math.sin(a)], axis=1)
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    n = min(len(sig), N - i0)
    if n > 0:
        bus[i0:i0 + n] += sig[:n] * gain


def svf(x, fc, q=0.7, mode="bp"):
    """Topology-preserving state variable filter, fc may be an array (sweeps)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    k = 1.0 / q
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    ic1 = ic2 = 0.0
    y = np.empty_like(x)
    for i in range(len(x)):
        v3 = x[i] - ic2
        v1 = a1[i] * ic1 + a2[i] * v3
        v2 = ic2 + a2[i] * ic1 + a3[i] * v3
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2
        y[i] = v1 if mode == "bp" else (v2 if mode == "lp" else x[i] - k * v1 - v2)
    return y


def env(n, attack, release, curve=4.0):
    t = tvec(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    r = np.exp(-curve * np.clip(t - attack, 0, None) / max(release, 1e-4))
    return a * r


def chirp(f0, f1, dur, shape=2.0):
    n = int(dur * SR); t = tvec(n)
    f = f0 + (f1 - f0) * (t / dur) ** shape
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def pan_of(x):
    return float(np.clip((x - ev["W"] / 2) / (ev["W"] / 2), -1, 1)) * 0.75


def bell(freq, dur, decay):
    """Inharmonic bell partials, glassy and warm."""
    n = int(dur * SR); t = tvec(n)
    parts = [(1.0, 1.0), (2.0, 0.42), (2.76, 0.28), (5.4, 0.12), (8.93, 0.05)]
    s = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * (1 + r * 0.9) / decay) for r, a in parts)
    return s * env(n, 0.003, dur, 0.5)


# ---------------------------------------------------------------- 1. pad and air
n = N; t = tvec(n)
amp = np.interp(t, [0, 0.3, 1.2, 1.97, 2.06, 2.6, 4.1, 4.6, 5.0], [0, .05, .11, .17, .07, .10, .10, .13, 0])
pad = np.zeros(n)
for f, a in [(55, 1.0), (82.41, .55), (110, .45), (164.8, .18), (220, .10)]:
    for det in (-0.6, 0.6):
        pad += a * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6.28))
cut = np.interp(t, [0, 1.95, 2.1, 5.0], [260, 1400, 520, 700])
pad = svf(pad / 4, cut, 0.6, "lp") * amp
air = svf(rng.standard_normal(n), np.interp(t, [0, 2, 5], [900, 5000, 2500]), 0.5, "bp") * amp * 0.12
place(dry, 0, np.stack([pad + air, np.roll(pad, 240) + air * 0.9], axis=1))

# ---------------------------------------------------------------- 2. the idea spark (0.06 s)
d = 1.1; n = int(d * SR); t = tvec(n)
glint = (np.sin(2 * np.pi * 2637 * t + 2 * np.sin(2 * np.pi * 7 * t)) * .6 +
         np.sin(2 * np.pi * 3951 * t) * .35 + np.sin(2 * np.pi * 5274 * t) * .15) * env(n, .004, .55)
sh = svf(rng.standard_normal(n), 7000, 1.2, "bp") * env(n, .002, .12) * .5
place(fx, 0.06, glint + sh, 0, .30)
# launch ring: soft falling air
d = .9; n = int(d * SR)
ring = svf(rng.standard_normal(n), np.linspace(1800, 300, n), 1.4, "bp") * env(n, .05, .5)
place(fx, 0.12, ring, 0, .22)

# ---------------------------------------------------------------- 3. streaks, sizzles, node notes
NOTES = [440.0, 554.37, 659.25, 880.0]   # A major arpeggio as the circuits close
for i, p in enumerate(ev["paths"]):
    # zip from the spark to the circuit start
    d = .26; n = int(d * SR)
    z = chirp(420, 2600, d, 2.2) * np.linspace(0, 1, n) ** 1.5
    z += svf(rng.standard_normal(n), np.linspace(800, 6000, n), 2, "bp") * np.linspace(0, 1, n) ** 2 * .6
    place(fx, p["t0"] - .25, z, pan_of(p["x0"]) * .8, .16)

    # electric sizzle while the trace is soldered in, panned along the trace
    d = p["t1"] - p["t0"] + .12; n = int(d * SR); t = tvec(n)
    imp = (rng.random(n) < 520 / SR) * rng.uniform(.2, 1, n)
    grains = np.convolve(imp, np.exp(-tvec(int(.004 * SR)) / .0012), "same")
    crack = svf(grains + rng.standard_normal(n) * .05, 3800 + 1600 * np.sin(2 * np.pi * 3 * t), .9, "bp")
    hum = svf(np.sign(np.sin(2 * np.pi * np.cumsum(180 + 260 * t / d) / SR)), 900, .7, "lp") * .12
    e = np.clip(t / .05, 0, 1) * np.clip((d - t) / .12, 0, 1)
    sig = (crack * 1.4 + hum) * e
    pans = np.linspace(pan_of(p["x0"]), pan_of(p["x1"]), n)
    a = (pans + 1) * math.pi / 4
    place(fx, p["t0"], np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1), gain=.17)

    # node solder pop: a plucked note with a tiny pitch settle and a click
    d = .9; n = int(d * SR); t = tvec(n)
    f = NOTES[i] * (1 + .05 * np.exp(-t / .02))
    ph = 2 * np.pi * np.cumsum(f) / SR
    note = (np.sin(ph) + .25 * np.sin(2 * ph) + .08 * np.sin(3 * ph)) * env(n, .002, .42)
    click = svf(rng.standard_normal(n), 5000, 1, "bp") * env(n, .0005, .01)
    place(fx, p["t1"] - .01, note * .9 + click * .5, pan_of(p["x1"]), .23)

# sparks: tiny crackles
for s in ev["sparks"]:
    n = int(.03 * SR)
    c = svf(rng.standard_normal(n), rng.uniform(4000, 9000), 3, "bp") * env(n, .0004, .008)
    place(fx, s["t"], c, pan_of(s["x"]), .05 * s["size"])

# ---------------------------------------------------------------- 4. riser and power-on hit
TP = ev["T_PULSE"]
d = TP - 1.42; n = int(d * SR); t = tvec(n)
k = t / d
riser = svf(rng.standard_normal(n), 300 + 5200 * k ** 2.2, 2.2, "bp") * k ** 2.4
riser += chirp(180, 900, d, 2.4) * k ** 3 * .35
riser *= np.clip((d - t) / .02, 0, 1)                # cut dead before the hit
place(fx, 1.42, riser, 0, .3)

hit_t = TP + .02
d = 2.6; n = int(d * SR); t = tvec(n)
f = 42 + 80 * np.exp(-t / .07)
sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .003, 1.1, 3)
place(dry, hit_t, sub, 0, .62)
trans = svf(rng.standard_normal(n), np.linspace(9000, 400, n), .7, "lp") * env(n, .001, .09)
zap = svf(np.sign(np.sin(2 * np.pi * np.cumsum(np.linspace(2200, 160, n)) / SR)), 2500, .9, "bp") * env(n, .002, .3)
place(fx, hit_t, trans * .9 + zap * .25, 0, .45)
# node flash: the whole chord rings once
for i, fq in enumerate(NOTES):
    place(fx, TP + .58 + i * .012, bell(fq, 1.6, .55), [-.5, -.15, .15, .5][i], .045)

# ---------------------------------------------------------------- 5. glide whoosh
m0, m1 = ev["T_MOVE0"], ev["T_MOVE1"]
d = m1 - m0 + .3; n = int(d * SR); t = tvec(n)
k = t / d
wh = svf(rng.standard_normal(n), 300 + 2200 * np.sin(np.pi * k) ** 1.5, 1.6, "bp") * np.sin(np.pi * k) ** 2
pans = np.linspace(.1, -.55, n); a = (pans + 1) * math.pi / 4
place(fx, m0, np.stack([wh * np.cos(a), wh * np.sin(a)], axis=1), gain=.32)

# ---------------------------------------------------------------- 6. type
def tick(freq, gain, t0, pan):
    n = int(.06 * SR); t = tvec(n)
    s = np.sin(2 * np.pi * freq * t) * env(n, .0008, .018) + svf(rng.standard_normal(n), 6000, 2, "bp") * env(n, .0003, .004) * .5
    place(fx, t0, s, pan, gain)

lx = pan_of(ev["lineX"] + 300)
for i in range(ev["title"]):
    if i == 4: continue                     # the space in "Idea House"
    tick(3200 + 140 * i, .07, ev["T_TEXT"] + i * .034, lx + i * .02)
for i in range(ev["acad"]):
    tick(2400 + 110 * i, .045, ev["T_ACAD"] + i * .038, lx + i * .02)
for i in range(ev["tagWords"]):
    n = int(.12 * SR); t = tvec(n)
    tok = np.sin(2 * np.pi * (1180 + 90 * i) * t) * env(n, .001, .05)
    place(fx, ev["T_TAG"] + i * .075, tok, lx, .06)

# signature trace and final sting
l0, l1 = ev["T_LINE0"], ev["T_LINE1"]
d = l1 - l0; n = int(d * SR); t = tvec(n)
imp = (rng.random(n) < 300 / SR) * rng.uniform(.2, 1, n)
s = svf(np.convolve(imp, np.exp(-tvec(int(.003 * SR)) / .001), "same"), 5200, 1.1, "bp")
s *= np.clip(t / .04, 0, 1) * np.clip((d - t) / .05, 0, 1)
place(fx, l0, s, lx, .12)
place(fx, l1 - .005, bell(880, .9, .3) * .5 + svf(rng.standard_normal(int(.9 * SR)), 5000, 1, "bp") * env(int(.9 * SR), .0005, .01) * .3, lx + .2, .16)
for i, fq in enumerate([220.0, 440.0, 554.37, 659.25, 987.77]):    # A add9, warm and resolved
    place(fx, l1 + .02 + i * .018, bell(fq, 1.2, .9 if i else 1.4), [-.3, -.2, 0, .2, .35][i], .075 if i else .06)

# ---------------------------------------------------------------- reverb (synthetic plate)
n = int(1.6 * SR); t = tvec(n)
ir = rng.standard_normal((n, 2)) * np.exp(-t / .38)[:, None]
for ch in range(2):
    ir[:, ch] = svf(ir[:, ch], 6500, .6, "lp")
ir[:int(.012 * SR)] = 0                              # pre-delay
ir /= np.sqrt((ir ** 2).sum(axis=0))
L = 1 << int(np.ceil(np.log2(N + n)))
wet = np.stack([np.fft.irfft(np.fft.rfft(fx[:, c], L) * np.fft.rfft(ir[:, c], L), L)[:N] for c in range(2)], axis=1)
mix = dry + fx + wet * .32

# ---------------------------------------------------------------- master
t = tvec(N)
mix *= np.clip((DUR - t) / .22, 0, 1)[:, None]       # tail fade into the cut
mix *= np.clip(t / .01, 0, 1)[:, None]
mix = np.tanh(mix * 1.6) / np.tanh(1.6)              # gentle saturation and soft limiting
mix *= 0.89 / np.max(np.abs(mix))                    # peak at -1 dBFS
pcm = (mix * 32767).astype("<i2")
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", OUT, f"{DUR}s", "rms dBFS:", round(20 * math.log10(np.sqrt((mix ** 2).mean())), 1))

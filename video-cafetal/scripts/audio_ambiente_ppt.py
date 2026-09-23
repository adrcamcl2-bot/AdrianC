"""Seamless background loop for the presentation, in the style of "MiSueno".

Softer than the video soundtrack so it sits under a speaker's voice:
string pad, gentle acoustic guitar and sparse piano in D major, plus
mountain wind and tropical birds. The end wraps into the start, so
PowerPoint's "Loop until stopped" plays it without an audible seam.

Requires numpy + scipy.  Run: python3 scripts/audio_ambiente_ppt.py
Output: audio/ambiente-presentacion.wav (convert to MP3 afterwards).
"""

import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 48000
BPM = 70
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 52  # 13 passes of the 4-chord cycle, ~3 min
DUR = BARS * BAR
N = int(round(DUR * SR))
TAIL = int(6 * SR)  # rendered past the loop point, then wrapped to the start
rng = np.random.default_rng(11)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_axis(n):
    return np.arange(n) / SR


def lowpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def highpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def add(buf, sig, start_s, pan=0.0):
    """Mix mono `sig` into stereo `buf` (length N + TAIL), equal-power pan."""
    i = int(start_s * SR)
    sig = sig[: buf.shape[1] - i]
    a = (pan + 1) * np.pi / 4
    buf[0, i : i + len(sig)] += sig * np.cos(a)
    buf[1, i : i + len(sig)] += sig * np.sin(a)


def wrap(buf):
    """Fold everything rendered past the loop point back onto the start."""
    out = buf[:, :N].copy()
    out[:, :TAIL] += buf[:, N : N + TAIL]
    return out


# ---------------------------------------------------------------- instruments
def piano_note(m, dur=4.0, vel=1.0):
    n = int(dur * SR)
    t = t_axis(n)
    f = midi_hz(m)
    sig = np.zeros(n)
    for h, amp in enumerate([1.0, 0.4, 0.2, 0.1, 0.05], start=1):
        inharm = f * h * np.sqrt(1 + 0.0004 * h * h)
        sig += amp * np.sin(2 * np.pi * inharm * t) * np.exp(-t * (1.0 + 0.8 * h))
    return 0.2 * vel * sig * np.minimum(1, t / 0.006)


def guitar_pluck(m, dur=2.5, vel=1.0):
    """Karplus-Strong string via a recursive comb filter."""
    n = int(dur * SR)
    period = int(round(SR / midi_hz(m)))
    x = np.zeros(n)
    x[:period] = lowpass(rng.uniform(-1, 1, period), 3500)
    a = np.zeros(period + 2)
    a[0] = 1
    a[period] = a[period + 1] = -0.5 * 0.996
    y = lowpass(lfilter([1.0], a, x), 4000)
    return 0.22 * vel * y * np.minimum(1, (n - np.arange(n)) / (0.05 * SR))


def string_pad(m, dur, vel=1.0):
    n = int(dur * SR)
    t = t_axis(n)
    f = midi_hz(m)
    sig = np.zeros(n)
    for det in (-0.12, 0.0, 0.11):
        vib = 1 + 0.003 * np.sin(2 * np.pi * 5.0 * t + rng.uniform(0, 6))
        ph = np.cumsum(f * 2 ** (det / 12) * vib) / SR
        sig += 2 * (ph % 1) - 1
    sig = lowpass(sig, 1500, order=4)
    env = np.clip(np.minimum(t / 1.5, (dur - t) / 1.5), 0, 1)
    return 0.05 * vel * sig * env


def reverb(x, seconds=3.2, wet=0.32):
    n = int(seconds * SR)
    t = t_axis(n)
    out = np.zeros_like(x)
    for ch in range(2):
        ir = lowpass(rng.standard_normal(n) * np.exp(-t * 6.9 / seconds), 6000)
        ir /= np.sqrt(np.sum(ir**2))
        out[ch] = (1 - wet) * x[ch] + wet * fftconvolve(x[ch], ir)[: x.shape[1]]
    return out


# ---------------------------------------------------------------- compose
CHORDS = {
    "D": [50, 57, 62, 66, 69],
    "A": [45, 52, 57, 61, 64],
    "Bm": [47, 54, 59, 62, 66],
    "G": [43, 50, 55, 59, 62],
}
CYCLE = ["D", "A", "Bm", "G"]


def section(bar):
    """Slowly evolving texture: 0 calm, 1 guitar, 2 fuller, 3 guitar."""
    return (bar // 13) % 4


music = np.zeros((2, N + TAIL))
for bar in range(BARS):
    start = bar * BAR
    name = CYCLE[bar % 4]
    notes = CHORDS[name]
    sec = section(bar)

    for m in notes[1:]:
        add(music, string_pad(m, BAR + 1.6, vel=0.8), start, pan=rng.uniform(-0.5, 0.5))
    add(music, string_pad(notes[0] - 12, BAR + 1.6, vel=1.0), start)
    if sec == 2:
        for m in notes[2:]:
            add(music, string_pad(m + 12, BAR + 1.6, vel=0.35), start, pan=rng.uniform(-0.6, 0.6))

    if sec in (1, 2, 3):
        pattern = [0, 2, 3, 4, 3, 2, 3, 4]
        vel = 0.55 if sec == 2 else 0.45
        for k, idx in enumerate(pattern):
            add(music, guitar_pluck(notes[idx], vel=vel * (1 if k % 2 == 0 else 0.8)),
                start + k * BEAT / 2 + rng.uniform(-0.008, 0.008), pan=-0.35)

    # Sparse piano: one to three chord tones an octave up, never busy.
    for beat in sorted(rng.choice([0, 1.5, 2, 3], size=rng.integers(1, 4), replace=False)):
        m = int(rng.choice(notes[2:])) + 12
        add(music, piano_note(m, vel=0.55), start + beat * BEAT, pan=0.25)

music = wrap(reverb(music))

# ---------------------------------------------------------------- ambience
amb = np.zeros((2, N + TAIL))
t = t_axis(N + TAIL)
for ch in range(2):
    brown = highpass(np.cumsum(rng.standard_normal(N + TAIL)), 40)
    brown /= np.max(np.abs(brown))
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * t / 11.0 + ch) * np.sin(2 * np.pi * t / 5.3 + 1.7 * ch)
    leaves = bandpass(rng.standard_normal(N + TAIL), 2500, 7000) * 0.04 * np.clip(gust, 0, 1) ** 2
    amb[ch] += 0.22 * lowpass(brown, 600) * gust + leaves


def chirp(f0, f1, dur, shape=1.0):
    n = int(dur * SR)
    tt = t_axis(n)
    ph = 2 * np.pi * np.cumsum(f0 + (f1 - f0) * (tt / dur) ** shape) / SR
    env = np.sin(np.pi * tt / dur) ** 2
    return (np.sin(ph) + 0.2 * np.sin(2 * ph)) * env


def bird_call(kind):
    gap = lambda s: np.zeros(int(s * SR))
    if kind == 0:
        return np.concatenate([chirp(3800, 2600, 0.18), gap(0.06), chirp(3600, 2400, 0.22)])
    if kind == 1:
        notes = [chirp(4200 + rng.uniform(-100, 100), 5200, 0.045, 0.5) for _ in range(rng.integers(6, 12))]
        return np.concatenate([np.concatenate([n, gap(0.02)]) for n in notes])
    if kind == 2:
        return np.concatenate([chirp(1800, 2400, 0.25), gap(0.08), chirp(2200, 3400, 0.3, 2.0)])
    return np.concatenate([chirp(900, 850, 0.35), gap(0.12), chirp(820, 780, 0.45)])


ts = 0.5
while ts < DUR:
    kind = int(rng.integers(0, 4))
    dist = rng.uniform(0.25, 1.0)
    call = lowpass(bird_call(kind), 9000 - 5000 * (1 - dist)) * 0.07 * dist
    add(amb, call, ts, pan=rng.uniform(-0.9, 0.9))
    ts += rng.uniform(1.2, 3.5)  # a little calmer than in the video

amb = wrap(reverb(amb, seconds=1.6, wet=0.2))

# ---------------------------------------------------------------- mix
mix = 0.85 * music / np.max(np.abs(music)) + 0.4 * amb / np.max(np.abs(amb))
mix = np.tanh(1.1 * mix) / np.tanh(1.1)
# Keep it in the background: peaks around -8 dBFS.
mix *= 0.4 / np.max(np.abs(mix))

out = Path(__file__).resolve().parent.parent / "audio" / "ambiente-presentacion.wav"
out.parent.mkdir(exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype("<i2").tobytes())
print(f"wrote {out} ({DUR:.1f}s loop)")

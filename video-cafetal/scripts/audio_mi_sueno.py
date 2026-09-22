"""Synthesize the soundtrack for the "MiSueno" composition.

Hopeful instrumental (acoustic guitar, piano, light strings) plus
mountain ambience (wind, tropical birds). Output: public/mi-sueno-audio.wav

Requires numpy + scipy.  Run: python3 scripts/audio_mi_sueno.py
"""

import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 48000
DUR = 45.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

BPM = 70
BEAT = 60 / BPM
BAR = 4 * BEAT


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_axis(n):
    return np.arange(n) / SR


def add(buf, sig, start_s, pan=0.0):
    """Mix mono `sig` into stereo `buf` at `start_s`, equal-power pan (-1..1)."""
    i = int(start_s * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    a = (pan + 1) * np.pi / 4
    buf[0, i : i + len(sig)] += sig * np.cos(a)
    buf[1, i : i + len(sig)] += sig * np.sin(a)


def lowpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def highpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


# ---------------------------------------------------------------- harmony
# I - V - vi - IV in D major, resolving on D.
CHORDS = {
    "D": [50, 57, 62, 66, 69],
    "A": [45, 52, 57, 61, 64],
    "Bm": [47, 54, 59, 62, 66],
    "G": [43, 50, 55, 59, 62],
}
PROG = ["D", "A", "Bm", "G"] * 3 + ["D"]  # 13 bars ~ 44.6 s


def section_gain(t):
    """Overall musical intensity curve across the 45 s."""
    return np.interp(t, [0, 8, 10, 20, 30, 36, 40, 45], [0.35, 0.55, 0.7, 0.8, 1.0, 1.0, 0.7, 0.0])


# ---------------------------------------------------------------- instruments
def piano_note(m, dur=3.5, vel=1.0):
    n = int(dur * SR)
    t = t_axis(n)
    f = midi_hz(m)
    sig = np.zeros(n)
    for h, amp in enumerate([1.0, 0.45, 0.25, 0.12, 0.08, 0.04], start=1):
        inharm = f * h * np.sqrt(1 + 0.0004 * h * h)
        sig += amp * np.sin(2 * np.pi * inharm * t) * np.exp(-t * (1.2 + 0.9 * h))
    attack = np.minimum(1, t / 0.004)
    return 0.22 * vel * sig * attack


def guitar_pluck(m, dur=2.5, vel=1.0, bright=0.5):
    """Karplus-Strong string via a recursive comb filter."""
    n = int(dur * SR)
    f = midi_hz(m)
    period = int(round(SR / f))
    burst = lowpass(rng.uniform(-1, 1, period), 2000 + 5000 * bright)
    x = np.zeros(n)
    x[:period] = burst
    decay = 0.996
    a = np.zeros(period + 2)
    a[0] = 1
    a[period] = -0.5 * decay
    a[period + 1] = -0.5 * decay
    y = lfilter([1.0], a, x)
    y = lowpass(y, 4500)
    fade = np.minimum(1, (n - np.arange(n)) / (0.05 * SR))
    return 0.25 * vel * y * fade


def string_pad(m, dur, vel=1.0):
    """Soft ensemble strings: detuned saws, slow attack, low-passed."""
    n = int(dur * SR)
    t = t_axis(n)
    f = midi_hz(m)
    sig = np.zeros(n)
    for det in (-0.12, 0.0, 0.11):
        vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t + rng.uniform(0, 6))
        ph = np.cumsum(f * 2 ** (det / 12) * vib) / SR
        sig += 2 * (ph % 1) - 1
    sig = lowpass(sig, 1800, order=4)
    env = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.0)
    return 0.05 * vel * sig * np.clip(env, 0, 1)


# ---------------------------------------------------------------- compose
music = np.zeros((2, N))

melody = {
    # bar index: list of (beat offset, midi note)
    0: [(0, 78), (2, 81)],
    1: [(0, 76), (2, 73)],
    2: [(0, 74), (2, 78)],
    3: [(0, 71), (2, 74), (3, 76)],
    4: [(0, 78), (1.5, 76), (2, 73)],
    5: [(0, 74), (2, 78), (3, 81)],
    6: [(0, 83), (1, 81), (2, 78), (3, 76)],
    7: [(0, 76), (1, 78), (2, 81), (3, 85)],
    8: [(0, 86), (2, 83), (3, 81)],
    9: [(0, 79), (1, 81), (2, 83), (3, 86)],
    10: [(0, 85), (2, 81)],
    11: [(0, 78), (2, 83)],
    12: [(0, 78), (1, 81), (2, 86)],
}

for bar, name in enumerate(PROG):
    start = bar * BAR
    notes = CHORDS[name]
    g = float(section_gain(start + 0.1))

    # Strings: whole-bar chord, octave doubling in the fuller sections.
    for m in notes[1:]:
        add(music, string_pad(m, BAR + 1.2, vel=g), start, pan=rng.uniform(-0.5, 0.5))
    if bar >= 6:
        for m in notes[2:]:
            add(music, string_pad(m + 12, BAR + 1.2, vel=0.5 * g), start, pan=rng.uniform(-0.6, 0.6))
    # Low bass note on the downbeat.
    add(music, string_pad(notes[0] - 12, BAR + 1.2, vel=1.3 * g), start)

    # Acoustic guitar arpeggio (8ths) from bar 3 on.
    if bar >= 3:
        pattern = [0, 2, 3, 4, 3, 2, 3, 4]
        for k, idx in enumerate(pattern):
            vel = (0.9 if k % 2 == 0 else 0.7) * g
            jitter = rng.uniform(-0.008, 0.008)
            add(music, guitar_pluck(notes[idx], vel=vel, bright=0.35 + 0.3 * g),
                start + k * BEAT / 2 + jitter, pan=-0.35)

    # Piano melody.
    for beat, m in melody.get(bar, []):
        add(music, piano_note(m, vel=0.75 + 0.3 * g), start + beat * BEAT, pan=0.25)
    # Piano chord tones, soft, on beat 1.
    for m in notes[1:4]:
        add(music, piano_note(m, vel=0.3 * g), start, pan=0.15)

# Final ringing D chord.
for m in [38, 50, 57, 62, 66, 69, 74]:
    add(music, piano_note(m, dur=6, vel=0.5), 12 * BAR + BAR * 0.99, pan=0.1)


# Reverb: synthetic exponentially decaying stereo impulse response.
def reverb(x, seconds=2.8, wet=0.28):
    n = int(seconds * SR)
    t = t_axis(n)
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        ir = lowpass(ir, 6000)
        ir /= np.sqrt(np.sum(ir**2))
        out[ch] = (1 - wet) * x[ch] + wet * fftconvolve(x[ch], ir)[: len(x[ch])]
    return out


music = reverb(music)

# ---------------------------------------------------------------- ambience
amb = np.zeros((2, N))
t = t_axis(N)

# Wind: filtered brown noise with slow gusts, decorrelated per channel.
for ch in range(2):
    brown = np.cumsum(rng.standard_normal(N))
    brown = highpass(brown, 40)
    brown /= np.max(np.abs(brown))
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * t / 9.0 + ch) * np.sin(2 * np.pi * t / 4.3 + 1.7 * ch)
    leaves = bandpass(rng.standard_normal(N), 2500, 7000) * 0.05 * np.clip(gust, 0, 1) ** 2
    amb[ch] += 0.25 * lowpass(brown, 600) * gust + leaves


# Tropical birds: several species of chirps and trills.
def chirp(f0, f1, dur, shape=1.0):
    n = int(dur * SR)
    tt = t_axis(n)
    f = f0 + (f1 - f0) * (tt / dur) ** shape
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.sin(np.pi * tt / dur) ** 2
    return np.sin(ph) * env + 0.2 * np.sin(2 * ph) * env


def bird_call(kind):
    if kind == 0:  # descending whistle pair
        return np.concatenate([chirp(3800, 2600, 0.18), np.zeros(int(0.06 * SR)), chirp(3600, 2400, 0.22)])
    if kind == 1:  # fast trill
        notes = [chirp(4200 + rng.uniform(-100, 100), 5200, 0.045, 0.5) for _ in range(rng.integers(6, 12))]
        gap = np.zeros(int(0.02 * SR))
        return np.concatenate([np.concatenate([n, gap]) for n in notes])
    if kind == 2:  # rising question call
        return np.concatenate([chirp(1800, 2400, 0.25), np.zeros(int(0.08 * SR)), chirp(2200, 3400, 0.3, 2.0)])
    # soft two-tone coo from a distance
    return np.concatenate([chirp(900, 850, 0.35), np.zeros(int(0.12 * SR)), chirp(820, 780, 0.45)])


ts = 0.6
while ts < DUR - 1.5:
    kind = int(rng.integers(0, 4))
    call = bird_call(kind)
    dist = rng.uniform(0.25, 1.0)
    call = lowpass(call, 9000 - 5000 * (1 - dist)) * 0.08 * dist
    add(amb, call, ts, pan=rng.uniform(-0.9, 0.9))
    if kind == 1 and rng.random() < 0.5:  # answer from another bird
        add(amb, call * 0.6, ts + len(call) / SR + 0.3, pan=rng.uniform(-0.9, 0.9))
    ts += rng.uniform(0.7, 2.4)

amb = reverb(amb, seconds=1.6, wet=0.2)

# ---------------------------------------------------------------- mix
mix = 0.9 * music / np.max(np.abs(music)) + 0.35 * amb / np.max(np.abs(amb))
fade = np.clip(np.minimum(t / 2.0, (DUR - t) / 3.0), 0, 1)
mix *= fade
mix = np.tanh(1.2 * mix) / np.tanh(1.2)
mix *= 0.89 / np.max(np.abs(mix))

out = Path(__file__).resolve().parent.parent / "public" / "mi-sueno-audio.wav"
pcm = (mix.T * 32767).astype("<i2")
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {out} ({DUR:.0f}s)")

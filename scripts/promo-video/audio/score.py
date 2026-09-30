"""Original score, sound effects and voice-over mix for the ORBIT promo.

Everything here is synthesized from scratch (no samples), so the track carries
no third-party licence. 120 BPM, A minor, laid over ../timeline.json:

  0.0  impact + riser under the Sun reveal
  2.0  groove drops (Saturn / free roam)
  16.0 build (snare roll + riser)
  end card: final hit, tail to the end

Cuts sit on the half-second beat grid, so the timeline's cut, whoosh and
end-card times must stay on it. Usage: python score.py <outDir>
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

HERE = Path(__file__).parent
TIMELINE = json.loads((HERE.parent / "timeline.json").read_text())

SR = 48000
LENGTH = float(TIMELINE["duration"])
N = int(SR * LENGTH)
BPM = 120
BEAT = 60 / BPM
rng = np.random.default_rng(7)


def secs(n):
    return np.arange(n) / SR


def buf():
    return np.zeros((N, 2))


def place(track, sound, at, gain=1.0, pan=0.0):
    """Mix a mono or stereo sound into `track` at time `at` with constant-power pan."""
    if sound.ndim == 1:
        left = np.cos((pan + 1) * np.pi / 4)
        right = np.sin((pan + 1) * np.pi / 4)
        sound = np.stack([sound * left, sound * right], axis=1) * np.sqrt(2)
    start = int(round(at * SR))
    if start >= N:
        return
    end = min(N, start + len(sound))
    track[start:end] += sound[: end - start] * gain


def sos(kind, freq, order=2):
    return signal.butter(order, freq, btype=kind, fs=SR, output="sos")


def filt(x, kind, freq, order=2):
    return signal.sosfilt(sos(kind, freq, order), x, axis=0)


def midi(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def saw(freq, n, phase=0.0):
    """PolyBLEP sawtooth: a naive ramp with its wrap smoothed to curb aliasing."""
    dt = freq / SR
    t = (phase + np.arange(n) * dt) % 1.0
    y = 2 * t - 1
    m = t < dt
    x = t[m] / dt
    y[m] -= x + x - x * x - 1
    m = t > 1 - dt
    x = (t[m] - 1) / dt
    y[m] -= x * x + x + x + 1
    return y


def env_adsr(n, attack, decay, sustain, release, hold=None):
    t = secs(n)
    hold = (n / SR - release) if hold is None else hold
    e = np.where(t < attack, t / max(attack, 1e-6), 1.0)
    d = np.clip((t - attack) / max(decay, 1e-6), 0, 1)
    e = np.where(t >= attack, 1 - (1 - sustain) * d, e)
    r = np.clip((t - hold) / max(release, 1e-6), 0, 1)
    return e * (1 - r)


# ---------------------------------------------------------------- instruments

def kick():
    n = int(0.5 * SR)
    t = secs(n)
    f = 44 + 120 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17)
    click = filt(rng.standard_normal(n), "highpass", 1800) * np.exp(-t / 0.004) * 0.35
    return np.tanh(1.6 * (body + click)) * 0.95


def clap():
    n = int(0.45 * SR)
    t = secs(n)
    noise = rng.standard_normal(n)
    env = np.zeros(n)
    for k, at in enumerate((0.0, 0.011, 0.022)):
        env += np.where(t >= at, np.exp(-(t - at) / 0.0055), 0) * (0.7 + 0.15 * k)
    env += np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.11), 0) * 0.55
    return filt(noise * env, "bandpass", [900, 5200]) * 0.9


def hat(open_=False):
    n = int((0.3 if open_ else 0.08) * SR)
    t = secs(n)
    x = filt(rng.standard_normal(n), "highpass", 7500, 4)
    return x * np.exp(-t / (0.12 if open_ else 0.022)) * 0.5


def snare():
    n = int(0.25 * SR)
    t = secs(n)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04) * 0.5
    noise = filt(rng.standard_normal(n), "bandpass", [1200, 7000]) * np.exp(-t / 0.07)
    return (tone + noise) * 0.8


def supersaw(notes, n, cutoff=2200, detune=0.11, voices=5):
    """Detuned saw stack, stereo. `notes` are MIDI numbers."""
    out = np.zeros((n, 2))
    for note in notes:
        base = midi(note)
        for v in range(voices):
            spread = (v - (voices - 1) / 2) / ((voices - 1) / 2)
            cents = spread * detune * 100
            f = base * 2 ** (cents / 1200)
            wave = saw(f, n, phase=rng.random())
            pan = spread * 0.8
            out[:, 0] += wave * np.cos((pan + 1) * np.pi / 4)
            out[:, 1] += wave * np.sin((pan + 1) * np.pi / 4)
    out /= voices * len(notes)
    return filt(out, "lowpass", cutoff, 2)


def pluck(note, length=0.2):
    n = int(length * SR)
    t = secs(n)
    f = midi(note)
    wave = 0.6 * saw(f, n) + 0.4 * np.sign(np.sin(2 * np.pi * f * t))
    cutoff_env = 600 + 4200 * np.exp(-t / 0.05)
    # Time-varying low-pass: process in short blocks.
    y = np.zeros(n)
    block = 256
    zi = np.zeros((1, 2))
    for i in range(0, n, block):
        s = sos("lowpass", float(cutoff_env[i]), 2)
        y[i : i + block], zi = signal.sosfilt(s, wave[i : i + block], zi=zi)
    return y * np.exp(-t / 0.09) * 0.5


def boom(length=2.5, f0=62, f1=32):
    n = int(length * SR)
    t = secs(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (length / 3.2))


def crash(length=1.8):
    n = int(length * SR)
    t = secs(n)
    x = np.stack([rng.standard_normal(n), rng.standard_normal(n)], axis=1)
    x = filt(x, "bandpass", [2500, 12000])
    return x * np.exp(-t / (length / 3.5))[:, None] * 0.35


def whoosh(length=0.7, peak=0.5, low=250, high=4500, pan_from=-0.7, pan_to=0.7):
    """Filtered-noise sweep that peaks `peak` of the way through."""
    n = int(length * SR)
    t = secs(n) / length
    noise = rng.standard_normal(n)
    y = np.zeros(n)
    block = 256
    zi = np.zeros((2, 2))
    for i in range(0, n, block):
        x = t[i]
        centre = low * (high / low) ** (x / peak if x < peak else 1 - (x - peak) / (1 - peak) * 0.6)
        s = sos("bandpass", [centre * 0.6, min(centre * 1.6, SR / 2 - 100)], 2)
        y[i : i + block], zi = signal.sosfilt(s, noise[i : i + block], zi=zi)
    env = np.where(t < peak, (t / peak) ** 2.2, np.exp(-(t - peak) / (1 - peak) * 4))
    y *= env
    pan = pan_from + (pan_to - pan_from) * t
    return np.stack([y * np.cos((pan + 1) * np.pi / 4), y * np.sin((pan + 1) * np.pi / 4)], axis=1) * 0.9


def riser(length, low=400, high=7000):
    n = int(length * SR)
    t = secs(n) / length
    noise = rng.standard_normal(n)
    y = np.zeros(n)
    block = 256
    zi = np.zeros((2, 2))
    for i in range(0, n, block):
        c = low * (high / low) ** t[i]
        s = sos("bandpass", [c * 0.7, min(c * 1.5, SR / 2 - 100)], 2)
        y[i : i + block], zi = signal.sosfilt(s, noise[i : i + block], zi=zi)
    tone_f = 180 * (6 ** t)
    tone = np.sin(2 * np.pi * np.cumsum(tone_f) / SR) * 0.25
    return (y * 0.8 + tone) * (t ** 2.2)


def tick(freq=2400):
    n = int(0.05 * SR)
    t = secs(n)
    return (np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006) + filt(rng.standard_normal(n), "highpass", 4000) * np.exp(-t / 0.002) * 0.3) * 0.5


def shelf(x, kind, freq, gain_db, q=0.707):
    """RBJ-cookbook shelving filter."""
    a = 10 ** (gain_db / 40)
    w = 2 * np.pi * freq / SR
    alpha = np.sin(w) / (2 * q)
    cos = np.cos(w)
    sign = 1 if kind == "low" else -1
    b0 = a * ((a + 1) - sign * (a - 1) * cos + 2 * np.sqrt(a) * alpha)
    b1 = sign * 2 * a * ((a - 1) - sign * (a + 1) * cos)
    b2 = a * ((a + 1) - sign * (a - 1) * cos - 2 * np.sqrt(a) * alpha)
    a0 = (a + 1) + sign * (a - 1) * cos + 2 * np.sqrt(a) * alpha
    a1 = -sign * 2 * ((a - 1) + sign * (a + 1) * cos)
    a2 = (a + 1) + sign * (a - 1) * cos - 2 * np.sqrt(a) * alpha
    return signal.lfilter([b0 / a0, b1 / a0, b2 / a0], [1, a1 / a0, a2 / a0], x, axis=0)


def reverb_ir(seconds=2.2, predelay=0.012):
    n = int(seconds * SR)
    t = secs(n)
    ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)], axis=1)
    ir *= np.exp(-t * 6.9 / seconds)[:, None]
    ir = filt(ir, "lowpass", 6500)
    ir[: int(predelay * SR)] = 0
    return ir / np.sqrt(np.sum(ir ** 2, axis=0))


def reverb(x, ir, wet):
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x + y * wet


def pingpong(x, delay=0.375, feedback=0.38, wet=0.28, taps=5, keep_length=True):
    """Stereo ping-pong echo. Short sounds are padded so their echoes survive."""
    d = int(delay * SR)
    if not keep_length:
        x = np.concatenate([x, np.zeros((d * taps, 2))])
    y = x.copy()
    tap = x * wet
    for k in range(1, taps + 1):
        if d * k >= len(x):
            break
        shifted = np.zeros_like(x)
        shifted[d * k :] = tap[: len(x) - d * k]
        if k % 2:
            shifted = shifted[:, ::-1]
        y += shifted * feedback ** (k - 1)
    return y


# ---------------------------------------------------------------- arrangement

CHORDS = [  # (start, end, root midi, chord tones midi)
    (0.0, 2.0, 45, [57, 60, 64]),     # Am
    (2.0, 4.0, 41, [57, 60, 65]),     # F
    (4.0, 6.0, 48, [55, 60, 64]),     # C
    (6.0, 8.0, 43, [55, 59, 62]),     # G
    (8.0, 10.0, 45, [57, 60, 64]),    # Am
    (10.0, 12.0, 41, [57, 60, 65]),   # F
    (12.0, 14.0, 48, [55, 60, 64]),   # C
    (14.0, 16.0, 43, [55, 59, 62]),   # G
]
GROOVE = (2.0, 16.0)
HIT = float(TIMELINE["endCard"])
assert HIT > GROOVE[1] and abs(HIT / BEAT - round(HIT / BEAT)) < 1e-9, "end card off the beat grid"
CHORDS += [
    (GROOVE[1], HIT, 40, [56, 59, 64]),  # E (dominant)
    (HIT, LENGTH, 45, [57, 60, 64, 71]),  # Am(add9)
]


def chord_at(t):
    for start, end, root, tones in CHORDS:
        if start <= t < end:
            return root, tones
    return CHORDS[-1][2], CHORDS[-1][3]


def build_music():
    drums, claps, bass, pads, arp, fx = buf(), buf(), buf(), buf(), buf(), buf()
    k, c, h, ho, sn = kick(), clap(), hat(), hat(True), snare()

    # Sidechain: every kick ducks bass, pad and arp.
    duck = np.ones(N)
    beats = np.arange(GROOVE[0], GROOVE[1] - 1e-9, BEAT)
    for b in beats:
        place(drums, k, b, 0.9)
        i = int(b * SR)
        tt = secs(N - i)
        duck[i:] = np.minimum(duck[i:], 1 - 0.62 * np.exp(-tt / 0.13))
    for b in beats[1::2]:
        place(claps, c, b, 0.55, pan=0.05)
    for s in np.arange(GROOVE[0], GROOVE[1] - 1e-9, BEAT / 4):
        pos = round((s - GROOVE[0]) / (BEAT / 4)) % 4
        if pos == 2:
            place(drums, ho if round(s / BEAT) % 4 == 3 else h, s, 0.34, pan=0.25)
        else:
            place(drums, h, s, 0.14 if pos else 0.2, pan=0.25)
    # Intro: the Sun reveal gets one heartbeat per bar-half, no groove yet.
    place(drums, k, 0.0, 1.0)
    place(drums, k, 1.0, 0.55)
    place(drums, k, 1.5, 0.65)
    # Build: snare roll into the final hit.
    t = 16.0
    step = BEAT / 2
    while t < HIT - 1e-6:
        progress = (t - 16.0) / (HIT - 16.0)
        place(claps, sn, t, 0.18 + 0.5 * progress ** 1.5, pan=0.1)
        t += step if progress < 0.5 else step / 2 if progress < 0.8 else step / 4

    # Bass: rolling eighths on the root, pumped by the kick.
    for s in np.arange(GROOVE[0], GROOVE[1] - 1e-9, BEAT / 2):
        root, _ = chord_at(s + 1e-6)
        n = int(BEAT / 2 * SR)
        f = midi(root)
        note = 0.7 * saw(f, n) + 0.5 * np.sin(2 * np.pi * f * secs(n))
        note = filt(note, "lowpass", 520) * env_adsr(n, 0.004, 0.12, 0.6, 0.03)
        place(bass, note, s, 0.5)
    for s, dur, root in ((0.0, 2.0, 45), (16.0, 1.0, 40)):
        n = int(dur * SR)
        f = midi(root - 12) if root > 40 else midi(root)
        sub = np.sin(2 * np.pi * f * secs(n)) * env_adsr(n, 0.02, 0.3, 0.8, 0.3)
        place(bass, sub, s, 0.45)

    # Pads: one chord per bar.
    for start, end, root, tones in CHORDS:
        if start >= HIT:
            break
        n = int((end - start + 0.35) * SR)
        cutoff = 900 if start < GROOVE[0] else 2400
        p = supersaw(tones, n, cutoff=cutoff) * env_adsr(n, 0.08 if start else 0.6, 0.4, 0.8, 0.35)[:, None]
        place(pads, p, start, 0.5)

    # Arp: sixteenths over the chord from the drop until the build.
    pattern = [0, 1, 2, 3, 2, 1, 2, 3]
    for i, s in enumerate(np.arange(GROOVE[0], GROOVE[1] - 1e-9, BEAT / 4)):
        _, tones = chord_at(s + 1e-6)
        ladder = [tones[0] + 12, tones[1] + 12, tones[2] + 12, tones[0] + 24]
        note = ladder[pattern[i % len(pattern)]]
        accent = 1.0 if i % 4 == 0 else 0.7
        place(arp, pluck(note), s, 0.22 * accent, pan=0.0)
    arp = pingpong(arp)

    # Final: big Am(add9) stab and a long sustained pad.
    n = int((LENGTH - HIT) * SR)
    stab = supersaw([45, 57, 60, 64, 71], n, cutoff=3200, detune=0.14, voices=7)
    stab *= (0.35 + 0.65 * np.exp(-secs(n) / 0.5))[:, None] * np.clip((LENGTH - HIT - secs(n)) / 1.2, 0, 1)[:, None]
    place(pads, stab, HIT, 0.85)
    for j, note in enumerate([69, 72, 76, 81]):
        place(arp, pingpong(np.stack([pluck(note, 0.5)] * 2, axis=1), wet=0.4, keep_length=False), HIT + 0.02 + j * BEAT / 2, 0.16)

    # Impacts, crash and the build riser.
    place(fx, boom(2.2, 70, 34), 0.0, 0.9)
    place(fx, crash(1.6), 0.0, 0.55)
    place(fx, riser(2.0, 300, 5000), 0.0, 0.16)
    place(fx, boom(2.9, 64, 30), HIT, 1.0)
    place(fx, crash(1.4), HIT, 0.5)
    place(fx, riser(1.0, 500, 9000), 16.0, 0.35)
    rev = whoosh(1.0, 0.97, 1500, 9000, 0.6, -0.6)
    place(fx, rev, HIT - 1.0, 0.45)

    bass *= duck[:, None]
    pads *= (0.35 + 0.65 * duck)[:, None]
    arp *= (0.5 + 0.5 * duck)[:, None]

    ir = reverb_ir(2.4)
    pads = reverb(pads, ir, 0.35)
    arp = reverb(arp, ir, 0.3)
    claps = reverb(claps, ir, 0.22)
    fx = reverb(fx, ir, 0.25)

    music = drums * 0.8 + claps * 1.1 + bass * 0.65 + pads * 0.7 + arp * 0.75 + fx * 0.8
    # Nothing useful lives below 32 Hz, and a lighter floor leaves headroom for the rest;
    # phone speakers cannot play the sub anyway, so trade some of it for air.
    music = filt(music, "highpass", 36, 2)
    music = shelf(music, "low", 75, -4.0)
    music = shelf(music, "high", 7000, 2.5)
    return music


def build_sfx():
    sfx = buf()
    for at, kind in TIMELINE["whooshes"]:
        if kind == "warp":
            place(sfx, whoosh(0.9, 0.45, 180, 6500, -0.8, 0.8), at - 0.4, 0.75)
        else:
            place(sfx, whoosh(0.55, 0.7, 300, 5000, -0.5, 0.5), at - 0.38, 0.5)
    # A tick for every replayed click, and for letting go of a held drag.
    for path in TIMELINE["cursor"]:
        for at in path["clicks"] + path.get("held", [])[1:]:
            place(sfx, tick(), at, 0.35)
    return sfx


def load_voice():
    voice = np.zeros(N)
    for item in TIMELINE["voice"]:
        x, sr = sf.read(HERE / "vo" / item["file"])
        assert sr == 24000
        x = signal.resample_poly(x, 2, 1)
        start = int(item["at"] * SR)
        voice[start : start + len(x)] += x[: N - start]
    # Voice chain: high-pass, presence lift, gentle compression.
    voice = filt(voice, "highpass", 85)
    b, a = signal.iirpeak(3500 / (SR / 2), 1.2)
    voice = voice + 0.25 * signal.lfilter(b, a, voice)
    level = np.sqrt(signal.lfilter([0.002], [1, -0.998], voice ** 2) + 1e-9)
    threshold = 0.08
    gain = np.where(level > threshold, (threshold / level) ** (1 - 1 / 3), 1.0)
    voice *= gain
    voice /= np.max(np.abs(voice)) + 1e-9
    ir = reverb_ir(0.6)
    stereo = np.stack([voice, voice], axis=1)
    return reverb(stereo, ir, 0.05), voice


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    music = build_music()
    sfx = build_sfx()
    voice, mono = load_voice()

    # Duck music and effects under the voice: fast attack, slow release.
    hop = SR // 100
    frames = len(mono) // hop
    rms = np.sqrt(np.mean(mono[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    active = (rms > 0.02).astype(float)
    follow = np.zeros(frames)
    level = 0.0
    for i, a in enumerate(active):
        coeff = 0.45 if a > level else 0.06
        level += (a - level) * coeff
        follow[i] = level
    follow = np.interp(np.arange(N) / hop, np.arange(frames), follow)
    duck = 1 - 0.62 * follow

    music /= np.max(np.abs(music)) + 1e-9
    sfx /= np.max(np.abs(sfx)) + 1e-9
    mix = music * 0.5 * duck[:, None] + sfx * 0.3 * duck[:, None] + voice * 0.62
    # Fade the tail to silence.
    tail = np.clip((LENGTH - secs(N)) / 0.6, 0, 1)
    mix *= tail[:, None]
    # Soft clip and peak-normalize; loudness is set during the final mux.
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    mix /= np.max(np.abs(mix)) / 0.89
    sf.write(out / "mix.wav", mix, SR, subtype="PCM_24")
    sf.write(out / "music.wav", music * 0.5, SR, subtype="PCM_24")
    sf.write(out / "voice.wav", voice * 0.62, SR, subtype="PCM_24")
    sf.write(out / "sfx.wav", sfx * 0.3, SR, subtype="PCM_24")
    print("peak", np.max(np.abs(mix)), "rms dB", 20 * np.log10(np.sqrt(np.mean(mix ** 2))))


if __name__ == "__main__":
    main(sys.argv[1])

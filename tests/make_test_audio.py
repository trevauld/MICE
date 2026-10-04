# Creates the fake-microphone files: quiet room noise with voice-like bursts at known times.
#   test_voice.wav       bursts at 6.0, 7.0, 7.9, 9.1, 10.3, 11.2 s
#   test_voice_talk.wav  the same 3 s later, plus talking at 2.85 s (during the bleed measurement)
#   test_silence.wav, test_noise_rise.wav, test_hum.wav  no voice: a quiet room, rising hiss, a low hum
import os, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
FS = 48000
ONSETS = [6.0, 7.0, 7.9, 9.1, 10.3, 11.2]
LENGTHS = [0.35, 0.5, 0.45, 0.6, 0.4, 0.55]

def burst(x, start, length, f0, peak):
    n = int(length * FS); t = np.arange(n) / FS
    sig = sum((1 / k) * np.sin(2 * np.pi * f0 * k * t + k) for k in range(1, 12))
    env = np.minimum(1, t / 0.015) * np.minimum(1, (length - t) / 0.03)
    sig = sig / np.max(np.abs(sig)) * peak * env
    i = int(start * FS); x[i:i + n] += sig

def make(name, total, shift, talk):
    x = np.random.default_rng(7).normal(0, 0.002, int(FS * total))
    for o, L in zip(ONSETS, LENGTHS): burst(x, o + shift, L, 140, 0.145)
    if talk: burst(x, 2.85, 0.6, 120, 0.1)
    with wave.open(os.path.join(HERE, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(FS)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())

def save(name, x):
    with wave.open(os.path.join(HERE, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(FS)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())

# no voice at all: quiet room, and a room whose microphone gain creeps up (noise rising from 0.002 to 0.03 rms between 3 s and 7 s, like phone auto-gain)
rng = np.random.default_rng(11)
n = int(FS * 13.5)
save('test_silence.wav', rng.normal(0, 0.002, n))
save('test_noise_rise.wav', rng.normal(0, 1, n) * np.interp(np.arange(n) / FS, [0, 3, 7, 13.5], [0.002, 0.002, 0.03, 0.03]))
# a steady low hum (a fan) with hiss
t = np.arange(n) / FS
save('test_hum.wav', 0.01 * np.sin(2 * np.pi * 55 * t) + 0.006 * np.sin(2 * np.pi * 110 * t) + rng.normal(0, 0.003, n))

# loud sounds that are not voice: a noise burst (a clap) at 6 s and a 60 Hz thump (a door) at 9 s
x = rng.normal(0, 0.002, n)
i = int(6.0 * FS); x[i:i + int(0.12 * FS)] += rng.normal(0, 0.1, int(0.12 * FS)) * np.hanning(int(0.12 * FS))
j = int(9.0 * FS); tt = np.arange(int(0.3 * FS)) / FS; x[j:j + len(tt)] += 0.2 * np.sin(2 * np.pi * 60 * tt) * np.exp(-tt * 12)
save('test_slam.wav', x)

# a room that gets noisier after the start-up measurement (4 s): 20 dB more noise that wobbles slowly, with short broadband rustles
# (a cord, clothing, breath) every second or so, like a phone raising its microphone gain. test_rustle.wav has no voice;
# test_noisy_voice.wav has the same six voice bursts as test_voice.wav on top.
def noisy(with_voice):
    r = np.random.default_rng(21)
    x = r.normal(0, 0.002, n); t = np.arange(n) / FS
    amb = r.normal(0, 1, n) * 0.016 * (1 + 0.5 * np.sin(2 * np.pi * 0.45 * t))
    amb[t < 4.0] = 0
    x += amb
    tt = 4.4
    while tt < 13.0:
        L = int(r.uniform(0.02, 0.05) * FS); i = int(tt * FS)
        x[i:i + L] += r.normal(0, 0.06, L) * np.hanning(L)
        tt += r.uniform(0.7, 1.4)
    if with_voice:
        for o, Ln in zip(ONSETS, LENGTHS): burst(x, o, Ln, 140, 0.145)
    return x
save('test_rustle.wav', noisy(False))
save('test_noisy_voice.wav', noisy(True))

make('test_voice.wav', 13.5, 0, False)
make('test_voice_talk.wav', 16.5, 3, True)
print('made test_voice.wav and test_voice_talk.wav')

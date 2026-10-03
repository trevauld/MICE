# Creates the fake-microphone files: quiet room noise with voice-like bursts at known times.
#   test_voice.wav       bursts at 6.0, 7.0, 7.9, 9.1, 10.3, 11.2 s
#   test_voice_talk.wav  the same 3 s later, plus talking at 2.85 s (during the bleed measurement)
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

make('test_voice.wav', 13.5, 0, False)
make('test_voice_talk.wav', 16.5, 3, True)
print('made test_voice.wav and test_voice_talk.wav')

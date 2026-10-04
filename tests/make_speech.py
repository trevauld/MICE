# Creates test_speech.wav: speech-like audio with known properties, for checking that the Dynamic voice learns them.
#   pitch centre 190 Hz, 5 syllables a second, phrases of 6 syllables with 0.5 s pauses, formants 15% above a typical adult
#   about 30% of syllables start with a 90 ms 's'-like hiss centred at 5.5 kHz
#   Speech starts at 4 s and lasts 18 s.
import os, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
FS = 48000
rng = np.random.default_rng(3)
VOW = [(730, 1090, 2440), (530, 1840, 2480), (270, 2290, 3010), (570, 840, 2410), (300, 870, 2240)]
SCALE, F0C, RATE, PHRASE, T0, DUR = 1.15, 190.0, 5.0, 6, 4.0, 18.0
total = int(FS * (T0 + DUR + 1.5))
x = rng.normal(0, 0.002, total)

def render(t0, dur, f_a, f_b, v_a, v_b, amp_a, amp_b):
    n = int(dur * FS); u = np.linspace(0, 1, n, endpoint=False)
    f0 = f_a + (f_b - f_a) * (0.5 - 0.5 * np.cos(np.pi * u))
    ph = 2 * np.pi * np.cumsum(f0) / FS
    out = np.zeros(n)
    fm = [np.array(a) * SCALE + (np.array(b) * SCALE - np.array(a) * SCALE) * 0 for a, b in [(v_a, v_b)]][0]
    for k in range(1, 40):
        fk = f0 * k
        env = 0
        for i, (fa, fb, bw) in enumerate(zip(v_a, v_b, (80, 100, 140))):
            fc = (fa + (fb - fa) * u) * SCALE
            env = env + [1, 0.6, 0.3][i] / (1 + ((fk - fc) / bw) ** 2)
        out += np.sin(k * ph) * env / k ** 0.8
    amp = amp_a + (amp_b - amp_a) * (0.5 - 0.5 * np.cos(np.pi * u))
    i = int(t0 * FS); x[i:i + n] += out / 6 * amp * 1.0

def hiss(t0, dur, fc=5500, lvl=0.05):
    # band-limited noise (4-7 kHz) like an 's'
    n = int(dur * FS); sp = np.fft.rfft(rng.normal(0, 1, n)); fr = np.fft.rfftfreq(n, 1 / FS)
    sp[(fr < fc - 1500) | (fr > fc + 1500)] = 0
    h = np.fft.irfft(sp, n); h = h / np.abs(h).max() * lvl * np.hanning(n)
    i = int(t0 * FS); x[i:i + n] += h

t = T0; f_prev = F0C; v_prev = VOW[0]; a_prev = 0.3
while t < T0 + DUR:
    for i in range(PHRASE):
        d = 1 / RATE * (0.85 + 0.3 * rng.random())
        f = F0C * 2 ** ((2.5 * np.sin(np.pi * (i + .5) / PHRASE) + rng.normal(0, .8)) / 12)
        v = VOW[rng.integers(len(VOW))]
        a = 1.0 if i % 1 == 0 else 0.7
        h = 0.09 if rng.random() < 0.3 else 0
        if h: hiss(t, h)
        render(t + h, d, f_prev, f, v_prev, v, a_prev, a)
        f_prev, v_prev, a_prev = f, v, 0.55 if rng.random() < .5 else 0.8
        t += d + h
    t += 0.5
    a_prev = 0.3
with wave.open(os.path.join(HERE, 'test_speech.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(FS)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
print('made test_speech.wav')

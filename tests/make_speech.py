# Creates speech-like test audio with known properties, for checking that the Dynamic voice learns the right voice.
#   test_speech.wav       one voice: pitch centre 190 Hz, 5 syllables a second, phrases of 6 syllables with 0.5 s pauses, formants 15% above
#                         a typical adult, about 30% of syllables starting with a 90 ms 's'-like hiss at 5.5 kHz. Speech from 4 s to 22 s.
#   test_two_voices.wav   a second, higher voice (230 Hz, formants 20% higher, a bit quieter) speaks first, in 2.5 s windows at 4-6.5 s,
#                         9-11.5 s ..., like a call leaking into the microphone; the user (low voice, 120 Hz) answers in the windows between
#                         (6.5-9 s, 11.5-14 s ...) and holds the cue only then (see leak_check.js).
import os, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
FS = 48000
VOW = [(730, 1090, 2440), (530, 1840, 2480), (270, 2290, 3010), (570, 840, 2410), (300, 870, 2240)]

def save(name, x):
    with wave.open(os.path.join(HERE, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(FS)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())

def speak(x, rng, t_start, t_end, f0c, scale, gain=1.0, rate=5.0, phrase=6, hiss_p=0.3):
    def render(t0, dur, f_a, f_b, v_a, v_b, amp_a, amp_b):
        n = int(dur * FS); u = np.linspace(0, 1, n, endpoint=False)
        f0 = f_a + (f_b - f_a) * (0.5 - 0.5 * np.cos(np.pi * u))
        ph = 2 * np.pi * np.cumsum(f0) / FS
        out = np.zeros(n)
        for k in range(1, 40):
            fk = f0 * k; env = 0
            for i, (fa, fb, bw) in enumerate(zip(v_a, v_b, (80, 100, 140))):
                fc = (fa + (fb - fa) * u) * scale
                env = env + [1, 0.6, 0.3][i] / (1 + ((fk - fc) / bw) ** 2)
            out += np.sin(k * ph) * env / k ** 0.8
        amp = amp_a + (amp_b - amp_a) * (0.5 - 0.5 * np.cos(np.pi * u))
        i = int(t0 * FS); m = min(n, len(x) - i); x[i:i + m] += (out / 6 * amp * gain)[:m]
    def hiss(t0, dur, fc=5500, lvl=0.05):
        n = int(dur * FS); sp = np.fft.rfft(rng.normal(0, 1, n)); fr = np.fft.rfftfreq(n, 1 / FS)
        sp[(fr < fc - 1500) | (fr > fc + 1500)] = 0
        h = np.fft.irfft(sp, n); h = h / np.abs(h).max() * lvl * gain * np.hanning(n)
        i = int(t0 * FS); m = min(n, len(x) - i); x[i:i + m] += h[:m]
    t = t_start; f_prev = f0c; v_prev = VOW[0]; a_prev = 0.3
    while t < t_end - 0.4:
        for i in range(phrase):
            d = 1 / rate * (0.85 + 0.3 * rng.random())
            if t + d > t_end: return
            f = f0c * 2 ** ((2.5 * np.sin(np.pi * (i + .5) / phrase) + rng.normal(0, .8)) / 12)
            v = VOW[rng.integers(len(VOW))]
            h = 0.09 if rng.random() < hiss_p else 0
            if h: hiss(t, h)
            render(t + h, d, f_prev, f, v_prev, v, a_prev, 1.0)
            f_prev, v_prev, a_prev = f, v, 0.55 if rng.random() < .5 else 0.8
            t += d + h
        t += 0.5; a_prev = 0.3

# one voice
rng = np.random.default_rng(3)
x = rng.normal(0, 0.002, int(FS * 24))
speak(x, rng, 4.0, 22.0, 190.0, 1.15)
save('test_speech.wav', x)

# two voices
rng = np.random.default_rng(5)
x = rng.normal(0, 0.002, int(FS * 38))
for k in range(6):
    speak(x, rng, 4.0 + 5 * k, 6.5 + 5 * k, 230.0, 1.2, gain=0.7, rate=4.0)   # the other voice (not held), first
    speak(x, rng, 6.5 + 5 * k, 9.0 + 5 * k, 120.0, 1.0)                      # the user (held)
save('test_two_voices.wav', x)
print('made test_speech.wav and test_two_voices.wav')

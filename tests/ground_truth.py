# Ground truth for a saved MICE test session. Finds the voice starts directly in the saved WAV
# (after removing the simulated bleed exactly) and compares them with the leads MICE reported.
# Usage: python3 ground_truth.py <name> <simbleed gain> <simdelay ms>   (gain 0 when there was no bleed)
import sys, os, json, zipfile, io, wave
import numpy as np

name, g, dms = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
z = zipfile.ZipFile(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', name + '.zip'))
names = z.namelist()
part = lambda suffix: z.read([n for n in names if n.endswith(suffix)][0])
sj = json.loads(part('session.json'))
w = wave.open(io.BytesIO(part('audio.wav')))
fs = w.getframerate()
a = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2) / 32767.0
mic, cue = a[:, 0], a[:, 1]
ev = [l.split(',') for l in part('events.csv').decode().splitlines()[1:]]
presses = [float(e[0]) for e in ev if e[1] == 'press']

# remove the simulated bleed: the DelayNode's fractional delay is a linear interpolation
d = dms / 1000 * fs; di = int(np.floor(d)); frac = d - di
c0 = np.concatenate([np.zeros(di), cue])[:len(cue)]
c1 = np.concatenate([np.zeros(di + 1), cue])[:len(cue)]
res = mic - g * ((1 - frac) * c0 + frac * c1)

# voice starts: a 5 ms loudness envelope crossing 0.01, then at least 100 ms below it before the next one
win = max(1, int(0.005 * fs))
env = np.sqrt(np.convolve(res ** 2, np.ones(win) / win, mode='same'))
above = env > 0.01
ons, i = [], 0
while i < len(above):
    if above[i]:
        ons.append((i - win / 2) / fs * 1000)
        j = i
        while j < len(above) and (above[j] or np.any(above[j:j + int(0.1 * fs)])):
            j += int(0.05 * fs)
        i = j
    else:
        i += 1

truth = []
for p in presses:
    c = [o for o in ons if 0 <= o - p <= 800]
    if c: truth.append((p, round(c[0] - p, 1)))
app = [(q['press_ms'], q['lead_ms']) for q in sj['summary']['pairs']]
diffs = []
for p, l in app:
    m = [t for t in truth if abs(t[0] - p) < 1]
    if m: diffs.append(round(l - m[0][1], 1))
s = sj['summary']
print('  voice starts %d, cues with no voice %d, presses %d' % (s['voice_starts'], s['cues_without_voice'], s['presses']))
print('  truth leads ms:', [t[1] for t in truth])
print('  MICE leads ms: ', [q[1] for q in app])
print('  MICE - truth:  ', diffs, ' worst %.1f ms' % max(map(abs, diffs)) if diffs else '')

fr = [l.split(',') for l in part('frames.csv').decode().splitlines()[1:]]
F = np.array([[float(x) if x != '' else np.nan for x in r] for r in fr])
last = (F[:, 0] >= presses[-1]) & (F[:, 0] <= presses[-1] + 300)
floor = np.median(F[F[:, 0] < presses[0], 2])
print('  press with no voice: mic %.1f dB, after cancelling %.1f dB, room noise %.1f dB' % (np.nanmax(F[last, 1]), np.nanmax(F[last, 2]), floor))
gain = F[:, 7]
if np.any(~np.isnan(gain)):
    print('  cancel gain at each press:', [round(float(gain[np.argmin(np.abs(F[:, 0] - (p + 200)))]), 3) for p in presses])

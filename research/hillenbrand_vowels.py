# Builds VOWEL_DB (index.html) from the Hillenbrand et al. (1995) vowel data and fits how formants scale with pitch.
# Run in a folder that contains vowdata.dat (see NOTES.md). Needs numpy.
import numpy as np, json
rows = []
for l in open('vowdata.dat', errors='ignore'):
    p = l.split()
    if len(p) >= 16 and len(p[0]) == 5 and p[0][0] in 'mwbg':
        try: v = [float(x) for x in p[1:16]]
        except ValueError: continue
        rows.append((p[0][0], p[0][1:3], p[0][3:], v))
# columns in v: 0 duration, 1 f0, 2-4 F1-F3 steady, 5 F4, 6-8 F1-F3 at 20%, 9-11 at 50%, 12-14 at 80%
def m(g, vw, i):
    return float(np.mean([v[i] for gg, _, w, v in rows if gg == g and w == vw and v[i] > 0]))
W = {'uh': .26, 'ih': .16, 'eh': .09, 'er': .07, 'ae': .07, 'ah': .06, 'iy': .07, 'ei': .05, 'oa': .05, 'uw': .04, 'oo': .04, 'aw': .04}  # my estimate of how often each vowel occurs
for vw, w in W.items():
    on = [round(m('m', vw, i)) for i in (6, 7, 8)]; off = [round(m('m', vw, i)) for i in (12, 13, 14)]
    print("  { n: '%s', w: %.2f, d: %d, on: %s, off: %s }," % (vw, w, round(m('m', vw, 0)), json.dumps(on), json.dumps(off)))
# formant scale against pitch over all 139 speakers, relative to the men's mean for each vowel
ref = {vw: [m('m', vw, i) for i in (2, 3, 4)] for vw in W}
sp = {}
for g, s, vw, v in rows: sp.setdefault((g, s), []).append((vw, v))
X, Y = [], [[], [], []]
for lst in sp.values():
    X.append(np.log(np.mean([v[1] for _, v in lst if v[1] > 0])))
    for i in range(3): Y[i].append(np.log(np.mean([v[2 + i] / ref[vw][i] for vw, v in lst if v[2 + i] > 0])))
for i in range(3):
    b, a = np.polyfit(X, Y[i], 1); print('F%d scale ~ (f0/130)^%.3f  r=%.2f' % (i + 1, b, np.corrcoef(X, Y[i])[0, 1]))

# Measures fricative-like events (s, sh, f, bursts) in CMU Arctic recordings, from the audio alone (no phone labels needed).
# Run from a folder that contains cmu_us_slt_arctic/wav/ (see NOTES.md). Needs numpy. Prints the numbers used for NOISY in index.html.
import numpy as np, wave, glob, json
FS=16000; N=512; HOP=160
win=np.hanning(N)
freqs=np.fft.rfftfreq(N,1/FS)
lo=(freqs>=80)&(freqs<1500); hi=(freqs>=3000)&(freqs<7900); sib=(freqs>=2000)&(freqs<7900)
def load(p):
    try:
        w=wave.open(p); d=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float)/32768; return d
    except Exception: return None
runs=[]; tot_active=0; tot_voiced=0; nfiles=0
specs={'s':[], 'sh':[], 'weak':[]}
for p in sorted(glob.glob('cmu_us_slt_arctic/wav/*.wav')):
    x=load(p)
    if x is None or len(x)<FS: continue
    nfiles+=1
    nf=(len(x)-N)//HOP
    F=np.stack([x[i*HOP:i*HOP+N]*win for i in range(nf)])
    P=np.abs(np.fft.rfft(F,axis=1))**2
    rms=10*np.log10((F**2).mean(1)+1e-12)
    Elo=10*np.log10(P[:,lo].sum(1)+1e-12); Ehi=10*np.log10(P[:,hi].sum(1)+1e-12)
    # voicing: normalised autocorrelation peak at 80..400 Hz
    voiced=np.zeros(nf,bool)
    for i in range(nf):
        f=x[i*HOP:i*HOP+N]; f=f-f.mean()
        e=(f*f).sum()
        if e<1e-9: continue
        ac=np.correlate(f,f,'full')[N-1:]
        voiced[i]=ac[40:200].max()/ac[0]>0.5
    floor=np.percentile(rms,10)
    active=rms>floor+12
    tot_active+=active.sum()*0.01; tot_voiced+=(voiced&active).sum()*0.01
    vref=np.median(rms[voiced&active]) if (voiced&active).sum()>20 else None
    if vref is None: continue
    fric=(~voiced)&active&((Ehi-Elo)>3)
    # runs, merging gaps <=2 frames
    i=0
    while i<nf:
        if fric[i]:
            j=i
            while j<nf and (fric[j] or fric[j:j+3].any()): j+=1
            if (j-i)>=4:
                seg=slice(i,j)
                Ps=P[seg].mean(0)
                c=(freqs[sib]*Ps[sib]).sum()/Ps[sib].sum()
                pk=freqs[sib][np.argmax(np.convolve(Ps[sib],np.ones(9)/9,'same'))]
                lvl=rms[seg].max()-vref
                # rise time: frames from 20% to 80% of the peak level in linear amplitude
                amp=10**(rms[i:j]/20); a=amp/amp.max()
                runs.append(dict(dur=(j-i)*10,cent=float(c),peak=float(pk),lvl=float(lvl),rise=float((np.argmax(a>=0.8)-np.argmax(a>=0.2))*10),file=p))
                cls='s' if c>5200 else ('sh' if c>3300 else 'weak')
                specs[cls].append(10*np.log10(Ps+1e-12)-10*np.log10(Ps.sum()+1e-12))
            i=j
        else: i+=1
print('files',nfiles,'active speech s %.0f, voiced s %.0f'%(tot_active,tot_voiced),'| fricative-like events',len(runs),'= %.2f per active second'%(len(runs)/tot_active))
cent=np.array([r['cent'] for r in runs]); dur=np.array([r['dur'] for r in runs]); lvl=np.array([r['lvl'] for r in runs])
def q(a): return [round(float(np.percentile(a,x))) for x in (10,25,50,75,90)]
print('centroid Hz  p10/25/50/75/90',q(cent))
print('duration ms  ',q(dur)); print('level dB re vowel median', [round(float(np.percentile(lvl,x)),1) for x in (10,25,50,75,90)])
for name,(a,b) in {'s (centroid>5200)':(5200,9e9),'sh-like (3300-5200)':(3300,5200),'weak (<3300)':(0,3300)}.items():
    m=(cent>=a)&(cent<b)
    if m.sum(): print('%-22s n=%3d (%2.0f%%)  centroid %4.0f  dur %3.0f ms  level %+5.1f dB  rise %3.0f ms'%(name,m.sum(),100*m.mean(),np.median(cent[m]),np.median(dur[m]),np.median(lvl[m]),np.median([r['rise'] for r,k in zip(runs,m) if k])))
sp={k:np.mean(v,0) for k,v in specs.items() if v}
for k,v in sp.items():
    print(k,'mean spectrum (dB re total) at 1,2,3,4,5,6,7,7.8 kHz:',[round(float(v[np.argmin(abs(freqs-f))]),1) for f in (1000,2000,3000,4000,5000,6000,7000,7800)])
json.dump(dict(runs=[{k:v for k,v in r.items() if k!='file'} for r in runs],active=tot_active,voiced=tot_voiced),open('fric_runs.json','w'))

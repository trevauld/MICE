# Research behind the Dynamic voice (SDV)

The app itself makes no network requests. These numbers were measured once, offline, and written into index.html as constants.
The data files are not in this repository; download them to a scratch folder to reproduce.

## Vowels: Hillenbrand, Getty, Clark and Wheeler (1995)
- 12 American English vowels from 45 men, 48 women and 46 children; formants at 20, 50 and 80% of each vowel, durations, f0.
- Data: https://github.com/santiagobarreda/hillenbrand_et_al_1995 (MIT licence, hosted with the author's permission). Take `vowdata.dat` from `h95-alldata.zip` (21.7 MB; the zip also holds the recordings).
- `python3 hillenbrand_vowels.py` prints the `VOWEL_DB` rows and the pitch scaling law (F1/F2/F3 ~ (f0/130)^0.31/0.33/0.27, r 0.82 to 0.87).
- The vowel weights `w` are my estimate of how common each vowel is in running speech; they are not from the dataset.

## Consonants: CMU Arctic, speaker slt (US female)
- http://festvox.org/cmu_arctic/ ; file `packed/cmu_us_slt_arctic.tar.bz2` (78 MB). I used only the first 25 MB (361 recordings, about 14 min of speech; the phone-label files are further into the archive, so events were found from the audio).
- `python3 arctic_fricatives.py` (from a folder holding `cmu_us_slt_arctic/wav/`): an event is an unvoiced, loud stretch of at least 40 ms where energy above 3 kHz exceeds energy below 1.5 kHz. Results:
  - 1.23 events per second of active speech (about 0.27 per syllable at 4.5 syllables a second)
  - 62% "s"-like (spectral centre of gravity 6.3 kHz, median 80 ms, 20 ms fade-in, 7.4 dB below the median vowel level)
  - 38% "sh"-like (4.5 kHz, 70 ms, 10 ms fade-in, 9.1 dB below)
- Limits: one voice; events include some bursts and "h"; no separate f, th, z or t numbers. Those levels in `NOISY` are my estimates.
- Real sibilants this bright and loud sounded harsh on a headset, so the Hiss level setting (default -16 dB) and a 4.8 kHz cap on the hiss centre are deliberate departures from the data.

## Consonants: Jongman, Wayland and Wong (2000), JASA 108(3), 1252-1263
Read from the full paper (not stored in this repository because it is copyrighted). Word-initial fricatives in citation words, 20 speakers (10 female, 10 male).
| | spectral peak | spectral mean | noise level vs vowel | frication duration |
|---|---|---|---|---|
| /f/ /v/ | 7733 Hz | 5108 Hz | f -20.8 dB, v -13.1 dB | 166 ms, 80 ms |
| /th/ /dh/ | 7470 Hz | 5137 Hz | -21.9 dB, -14.0 dB | 163 ms, 88 ms |
| /s/ /z/ | 6839 Hz | 6133 Hz | s -11.0 dB, z -9.0 dB | 178 ms, 118 ms |
| /sh/ /zh/ | 3820 Hz | 4229 Hz | -9.9 dB, -8.3 dB | 178 ms, 123 ms |
- Female spectral peaks average 6800 Hz against 6122 Hz for male.
- Relative amplitude was about 1.7 dB lower for women than men.
- Durations are for careful speech (about 400 ms words); running speech is shorter (80 ms in the Arctic measurement). Only the ratios were used: voiced fricatives about 0.66 as long as voiceless.

## Cross-check
| | Arctic (running speech, one female voice) | Jongman et al. (isolated words, 20 speakers) |
|---|---|---|
| "s" centre | 6.3 kHz | 6.1 kHz (spectral mean) |
| "sh" centre | 4.5 kHz | 4.2 kHz |
| "s" level vs vowels | -7.4 dB | -11.0 dB (s), -9.0 dB (z) |
| "sh" level vs vowels | -9.1 dB | -9.9 dB (sh), -8.3 dB (zh) |

Two different methods and speech styles agree on centre frequency and roughly on level. `NOISY` uses the Jongman levels (including the faint f at -21 dB) and the Arctic rate, mix and fade-ins. Only the burst "t" is still my estimate.

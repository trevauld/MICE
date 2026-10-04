# MICE (manual ideal choral effect)

index.html is a single-page PWA for stuttering practice. The user holds a pad or key just before voicing, and a
soft sustained tone (the "cue") plays while it is held: a manual version of the choral effect, an outside sound to
lock onto. While listening, MICE also detects the user's voice so that the "Dynamic voice" cue can learn from it
and become more like the user's own voice as a session goes on. The long-term goal is to start the cue automatically.

Deliberately small. It does two things: play the cue on a press, and listen to learn the voice. It does not save
anything (no files, no zip, no recordings) and does no timing statistics. The last version that did is tagged `v8-full`.

## Hard constraints
- No external scripts, fonts, CDNs or network requests. Nothing the microphone hears leaves the device.
- `index.html` is the source; `sh build.sh` copies it to `MICE.html` (the open-from-disk copy). Edit index.html only.
  It must still work from disk (file://) in Chrome or Edge, and in Safari (installed on iOS).
- The AudioWorklet source is an inline string loaded from a data: URL, because blob: URLs fail on file:// in
  Chrome. A ScriptProcessor fallback exists, but it can lose audio when the page is busy.
- getUserMedia runs with echoCancellation, noiseSuppression and autoGainControl off (iOS ignores this and may still
  apply gain: see voice detection). Keep them off.

## Map of the script
- **Settings:** `S` is persisted in localStorage under `mice.*`. Also `TIMBRES` and notes E2–A4 (MIDI 40–69).
- **Audio engine:** `startCue`/`stopCue` → `cueBus` → `out` (volume and mute) → speakers.
  `gateSrc` (ConstantSource) → `markBus` is a timing gate: 1 while the cue is held. Recorded by the capture, never played.
- **Sounds:** soft piano, electric piano, warm organ, hum, and Dynamic voice (see below).
- **Capture:** `openCapture` feeds one worklet with 3 inputs: the mic, `out` (the cue as heard) and the gate, in one sample stream.
- **Analyzer (`makeAnalyzer`):** decimates to about 16 kHz, keeps rings for the raw mic, the cue and the mic after bleed
  cancelling, finds press/release on the gate, emits 10 ms frames; `pitch()` uses normalized autocorrelation, `formants()` uses LPC.
- **Voice detection (`onFrame`):** a frame counts as voice only if it is loud (floor + 12 dB) AND has a clear pitch.
  Noise, hiss and hum have no clear pitch, so they never qualify, even when a phone raises its microphone gain.
  The room floor follows unpitched sound upward. States: `cal` (1.5 s of room noise) → `quiet` ⇄ `voice`, plus `hold`
  while the bleed is measured. Voice ends after 15 frames below the threshold or without pitch. Segments under 60 ms are dropped.
- **Cue bleed (the cue leaking into the mic):** at start `measureBleed` plays a short hiss and the cue while the user is
  quiet, finds the path delay and fits a 6 ms FIR; the analyzer subtracts gain × FIR(cue) from the mic; `armGain`/`checkGain`
  follow volume changes at each press. This stops the app learning its own tone as the user's voice.
- **Dynamic voice (`dynamicCue`):** a soft, babbling, Sims-like voice. Glottal-like source with jitter, shimmer and
  breath noise through three formant filters; phrases of syllables, each starting with a consonant-like gesture
  then a central vowel, all on eased glides. Gestures are either formant dips (`GESTURES`: nasal, glide, soft stop) or real
  consonant noise (`NOISY`: s, sh, f, z, t) from a band of noise that bypasses the vowel filters, so there is sibilance. It schedules ahead with a timer that `stopCue` clears.
- **Vowels in SDV (`VOWEL_DB`, `formantScale`):** the vowels are real measurements, not invented: Hillenbrand et al. (1995), 12 American
  English vowels from 139 speakers (data: github.com/santiagobarreda/hillenbrand_et_al_1995, MIT licence). Stored are the men's mean
  F1–F3 at 20% and 80% of each vowel (so each vowel has its own glide) and mean duration (so /ae/ is longer than /ih/). The weights `w`
  (reduced vowels most often) are my own estimate. Formants are scaled to the voice by the fitted law (f0/130)^(0.31, 0.33, 0.27)
  (r 0.82–0.87 over the 139 speakers), nudged toward the formants measured on the user. `MUMBLE` pulls vowels toward the average vowel.
- **Learning (`newProfile`, `learn`, `tuneFor`):** after about 5.5 s of detected speech SDV uses the user's median pitch and range, how often
  syllables carry frication and where the hiss sits (zero-crossing rate of loud unpitched frames inside speech), syllable rate (loudness
  peaks), phrase length and mean measured formants (LPC) for the vowel scale. After a few finished phrases it also uses the user's pitch
  shape and loudness shape over a phrase. Until then it uses the chosen note and defaults. The profile lives on the capture (it is lost
  when listening stops) and a failure in `learn` switches learning off without touching detection.
- **Consonants (`NOISY`):** levels, centres and the voiced/voiceless duration ratio from Jongman, Wayland & Wong (2000); rate, s/sh mix,
  durations and fade-ins from my CMU Arctic measurement; the two agree (see research/NOTES.md). Level and brightness are deliberately softer than
  the data (`SIB_SOFT_DB`, hiss centre capped at 4.8 kHz) because real sibilants sounded like a thin whistle on a headset. The burst "t" is an estimate.
  The paper's PDF is kept out of git and the deploy (`*.pdf` in .gitignore and .assetsignore).
- **Other:** "Match my voice" sets the note to the median speaking pitch. `draw` renders the 8 s timeline. `window.__mice` is the debug hook.

## UI
- The version label "MICE vN" is at the top. Bump it with `VERSION` in sw.js on every release (ui_check.js fails if they differ).
- Pad first; on touch screens it is 80% of the page height. All page text is non-selectable. Session and Cue sound panels collapse (state remembered).
- Hold key: Space, Left Ctrl, Left Shift or any key.

## PWA
- Files: `manifest.webmanifest`, `sw.js`, `icons/` (made by `make_icons.py`). Live at https://mice.keremk.workers.dev
  (Cloudflare Worker serving static assets, deploys from GitHub `main`; see wrangler.toml and .assetsignore).
- The service worker skips waiting (an installed iOS app is never fully closed, so waiting would pin the old version).
  Pages are network-first with the cache as the offline fallback; other files are cache-first.
- It registers only on http(s), so file:// use is unchanged.
- iOS: the tone is only reliably audible with a headset (without one iOS sends it to the quiet earpiece), and the
  microphone list has a single entry because iOS picks the input itself.

## Testing
See tests/README.md. Run `bash tests/suite.sh` after any change to audio, detection or the interface.
It checks the interface, voice detection (voice found; nothing found in silence, rising hiss or hum, even with the cue
leaking into the mic), Dynamic voice learning, and PWA install/offline.

## Known limits
- The FIR shape is fixed per session and only its gain adapts. Clock drift between different input and output devices is not tracked.
- Bluetooth output adds 100–300 ms of variable delay, so wired headphones are assumed.
- On the ScriptProcessor fallback, each audio dropout breaks the bleed model for about 20 ms.

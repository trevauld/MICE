# MICE (manual ideal choral effect)

index.html is a single-page PWA for stuttering practice. The user holds a pad or key just before voicing, and a
soft sustained tone (the "cue") plays while it is held: a manual version of the choral effect, an outside sound to
lock onto. While listening, MICE also detects the user's voice so that the "Dynamic voice" cue can learn from it
and become more like the user's own voice as a session goes on. Starting the cue automatically was tried and dropped (see the Auto cue note below).

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
- **Settings:** `S` is persisted in localStorage under `mice.*` (sound, note, volume, hold key, hiss, learning). Also `TIMBRES` and notes E2–A4 (MIDI 40–69).
- **Audio engine:** `startCue`/`stopCue` → `cueBus` → `out` (volume) → speakers.
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
  The probe is located in the recording from the recorded copy of the cue, not from the audio clock (they disagreed on iOS at the first start and
  caused "length cannot be negative"); a failed measurement is skipped with a message (`bleedSkipped`) and never stops listening. Test switch `?skew=S`.
- **Dynamic voice (`dynamicCue`):** a soft, babbling, Sims-like voice. Glottal-like source with jitter, shimmer and
  breath noise through three formant filters; phrases of syllables, each starting with a consonant-like gesture
  then a central vowel, all on eased glides. Gestures are either formant dips (`GESTURES`: nasal, glide, soft stop) or real
  consonant noise (`NOISY`: s, sh, f, z, t) from a band of noise that bypasses the vowel filters, so there is sibilance. It schedules ahead with a timer that `stopCue` clears.
- **Vowels in SDV (`VOWEL_DB`, `formantScale`):** the vowels are real measurements, not invented: Hillenbrand et al. (1995), 12 American
  English vowels from 139 speakers (data: github.com/santiagobarreda/hillenbrand_et_al_1995, MIT licence). Stored are the men's mean
  F1–F3 at 20% and 80% of each vowel (so each vowel has its own glide) and mean duration (so /ae/ is longer than /ih/). The weights `w`
  (reduced vowels most often) are my own estimate. Formants are scaled to the voice by the fitted law (f0/130)^(0.31, 0.33, 0.27)
  (r 0.82–0.87 over the 139 speakers), nudged toward the formants measured on the user. `MUMBLE` pulls vowels toward the average vowel.
- **Whose voice (`pressNear`, `learnOk`):** a voice assistant or call leaking into the microphone must not teach SDV (it once learned Claude's voice). Learning only counts speech where the cue
  was held (up to 0.8 s before the voice starts, 0.2 s after, or still held); the "Learn my voice while I hold the cue" checkbox switches it off; "Forget what it learned" resets it. As a second guard `learn` skips frames more than 8 semitones from the pitch
  learned so far. Test: `tests/leak_check.js`.
- **Learning (`newProfile`, `learn`, `tuneFor`):** after about 5.5 s of detected speech SDV uses the user's median pitch and range, how often
  syllables carry frication and where the hiss sits (zero-crossing rate of loud unpitched frames inside speech), syllable rate (loudness
  peaks), phrase length and mean measured formants (LPC) for the vowel scale. After a few finished phrases it also uses the user's pitch
  shape and loudness shape over a phrase. Until then it uses the chosen note and defaults. The profile lives on the capture (it is lost
  when listening stops) and a failure in `learn` switches learning off without touching detection.
- **Consonants (`NOISY`):** levels, centres and the voiced/voiceless duration ratio from Jongman, Wayland & Wong (2000); rate, s/sh mix,
  durations and fade-ins from my CMU Arctic measurement; the two agree (see research/NOTES.md). Level and brightness are deliberately softer than
  the data (the Hiss checkbox and level slider in Cue sound, shown only for the Dynamic voice; default -16 dB; hiss centre capped at 4.8 kHz) because real sibilants sounded like a thin whistle on a headset. The burst "t" is an estimate.
  The paper's PDF is kept out of git and the deploy (`*.pdf` in .gitignore and .assetsignore).
- **Auto cue: removed (tag `v23-auto`).** It tried to start the cue when speech started (with a room-and-voice setup and a latency meter). It could not be made reliable on a real phone
  (false starts in rustle and noise, missed real starts), and a voice-onset trigger can only react after the voice has begun, never to a block. Not planned.
- **Voice onset (`refineOnset`)** follows Chronset (Roux et al. 2017): from the confirmed voice it walks back along the recording to where the loudness first rose clear of the noise, up to 150 ms
  and never into the previous speech, bridging dips under 15 ms. "Clear of the noise" is 6 dB over the quiet frames just before (not the start-up floor), and it looks forward as well as
  back because the frame candidate can be early in noise. It sets where the blue voice bars start. Against known truth (`tests/onset_check.js`, located with a sync pulse): clean 0 ms,
  noisy room +3 to +4 ms, hiss-first onsets 0 to 2 ms (the previous version was 31 ms early in noise and 59 ms late on hiss-first onsets). Real speech is messier: Chronset itself agrees with
  human raters only to within 10 to 50 ms.
- **Screen awake (`keepAwake`):** a screen wake lock is held while listening (a locked phone stops the microphone) and re-requested when the page becomes visible again; if the browser has none, the status line says to set Auto-Lock to Never. Installed iOS web apps only got wake lock support in iOS 18.4; older versions need Auto-Lock off.
- **Other:** `draw` renders the 8 s timeline. `window.__mice` is the debug hook.

## UI
- One screen: the version label "MICE vN" (bump it with `VERSION` in sw.js on every release; ui_check.js fails if they differ), the Hold pad (80% of the page height on touch screens), a
  "Listening" panel (8 s graph, Start/Stop listening, status line, a warning line only when something is wrong), and one collapsible "Cue sound" panel (Sound, Note, Volume, Hold key; for the
  Dynamic voice also: learning status, "Learn my voice while I hold the cue", the hiss checkbox and level, "Forget what it learned").
- Deliberately not there: saving, statistics, a microphone chooser (the system default is used), mute, fade length (fixed 120 ms), a "Match my voice" button, the cue bleed report (only warnings are shown),
  and any automatic cue. All page text is non-selectable.
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

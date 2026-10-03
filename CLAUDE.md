# MICE (manual choral cue)

MICE.html is a single-page tool for stuttering practice. The user holds a pad or key just before voicing,
and a soft sustained tone (the "cue") plays while it is held: a manual version of the choral effect, an
outside sound to lock onto. During a session MICE also logs every press and the user's voice, so the timing
can be studied later. The long-term goal is to start the cue automatically.

## Hard constraints
- One self-contained file: no external scripts, fonts, CDNs or network requests. Recordings never leave the computer.
- It must work when opened straight from disk (file://) in Chrome or Edge, and ideally Safari.
- The AudioWorklet source is an inline string loaded from a data: URL, because blob: URLs fail on file:// in
  Chrome. A ScriptProcessor fallback exists, but it can lose audio when the page is busy.
- getUserMedia runs with echoCancellation, noiseSuppression and autoGainControl off. Keep them off: they would
  distort the timing and the bleed cancelling.

## Map of the script
- **Settings:** `S` is persisted in localStorage under `mice.*`. Also `TIMBRES`, `CONDITIONS`, and notes E2–A4 (MIDI 40–69).
- **Audio engine:** `startCue`/`stopCue` → `cueBus` → `out` (volume and mute) → speakers.
  `gateSrc` (ConstantSource) → `markBus` is a timing gate: 1 while the cue is held, 0.5 for calibration clicks.
  It is recorded but never played.
- **Capture:** `openCapture` feeds one worklet with 3 inputs: the mic, `out` (the cue as heard, after volume),
  and the gate. All three land in one sample stream, so press-to-voice leads are sample-accurate.
- **Analyzer (`makeAnalyzer`):**
  - Boxcar-decimates to about 16 kHz (14.7 kHz at 44.1 kHz).
  - Keeps rings for the raw mic, the cue, and the mic after bleed cancelling.
  - Finds press and release on the gate.
  - Emits 10 ms frames over 20 ms windows; `pitch()` uses normalized autocorrelation.
- **Voice detection (`onFrame`):**
  - States: `cal` (1.5 s of room noise) → `quiet` ⇄ `voice`, plus `hold` while the bleed is being measured.
  - Voice on: floor + 12 dB for 3 frames. Voice off: below floor + 8 dB for 12 frames. Segments under 60 ms are dropped.
  - `refineOnset` moves each voice start from the frame grid to the sample stream.
- **Cue bleed (the cue leaking into the mic):**
  - At session start `measureBleed` plays a 0.5 s hiss and 0.6 s of the cue while the user is quiet.
    The work is done in `bleedAttempt`, repeated once if other sound is detected.
  - It finds the path delay (coarse-to-fine cross-correlation on the hiss) and fits a 6 ms least-squares FIR.
  - It judges the fit on 10 ms blocks (medians) for the hiss, the cue and the silent gaps.
  - The analyzer subtracts gain × FIR(cue) from the mic.
  - At each press, `armGain`/`checkGain` re-estimate the gain from the first 30 ms of bleed, before the user's
    voice. A window only counts if the mic holds nothing but bleed and room noise. Voice decisions wait for this
    check, so OS volume changes are followed without false voice starts.
  - Any leftover bleed is allowed for through `leakAt` (`KLEAK` = 4, a 6 dB margin).
- **Sessions:**
  - `newSession` starts one.
  - `summarize` pairs each voice start with the latest press at most 800 ms before it, and not before the
    previous voice end minus 100 ms. If there is none, it uses a press up to 200 ms after.
  - `buildFiles` and a store-only zip writer produce the files. They are saved to a chosen folder (File System
    Access API, handle kept in IndexedDB) with autosave every 60 s, or downloaded as a .zip.
- **Round trip:** `rtFor` uses the bleed path delay when the cue bleeds into the mic, otherwise the click
  measurement from `measureDelay`.
- **Other:** "Match my voice" sets the note to the median speaking pitch. `draw` renders the timeline canvas.
  `window.__mice` is the debug hook.

## Session files
- **`mice_<time>_session.json`:** settings, `cue_bleed` (including the FIR taps, so cancelling can be redone
  offline), and a `summary` with every press/voice pair.
- **`events.csv`:** press, release, voice_on, voice_off, notes.
- **`frames.csv`:** every 10 ms; columns t_ms, level_db, clean_db, pitch_hz, voice, held, cue_db, cancel_gain.
- **`audio.wav`:** stereo at the analysis rate. Left is the raw mic, right is the cue as heard. Capped at 60 minutes.

## Testing
See tests/README.md.
- `tests/suite.sh` runs MICE in headless Chromium with a fake microphone: a WAV with known voice starts.
- It adds simulated bleed with these switches:
  - `?simbleed=G&simdelay=MS` mixes the cue into the mic.
  - `&simodd=1` distorts that bleed.
  - `?nocomp=1` turns cancelling off.
  - `?capture=script` forces the fallback path.
- It compares the saved leads with ground truth taken from the WAV. On the worklet path, app − truth should
  stay within about half a millisecond.
- Run it after any change to audio, timing or detection code.

## Known limits
- The FIR shape is fixed per session and only its gain adapts. Clock drift between different input and output
  devices, such as a USB mic with built-in speakers, is not tracked.
- Bluetooth output adds 100–300 ms of variable delay, so wired headphones are assumed.
- On the ScriptProcessor fallback, each audio dropout breaks the bleed model for about 20 ms.

## PWA
- `index.html` is the source; `sh build.sh` copies it to `MICE.html` (the open-from-disk copy). Edit index.html only.
- Extra files for installing: `manifest.webmanifest`, `sw.js` (precaches the shell; pages network-first, assets cache-first), `icons/` (made by `make_icons.py`).
- The service worker registers only on http(s), so file:// use is unchanged. Still no network requests: the worker only caches our own files.
- Bump `VERSION` in sw.js on each release. The worker skips waiting (an installed iOS app is never fully closed, so waiting would pin the old version). Pages are network-first with the cache as the offline fallback, so a launch online gets the latest.
- Host over HTTPS (any static host; localhost also counts). The mic and installing need a secure context.
- `tests/ui_check.js` checks the v2 interface (removed items, folds, hold keys, 80% pad on touch).
- `tests/pwa_check.js` checks install and offline reload (serve the folder on :8077 first).
- Live at https://mice.keremk.workers.dev (Cloudflare Worker, static assets, deploys from GitHub main; see wrangler.toml and .assetsignore).
- Checked on iOS Safari: works. It has no folder picker, so sessions download as .zip there.

## v2 interface
- Pad first; on touch screens it is 80% of the page height. Session and Cue sound panels collapse (state remembered).
- Saving at stop is optional (`S.save`, default off on iOS, on elsewhere). Condition and notes fields were removed from the UI and the session JSON.
- Hold key: Space, Left Ctrl, Left Shift or any key.

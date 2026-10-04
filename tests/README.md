# MICE tests

These run MICE in headless Chromium with a fake microphone that plays a WAV.

## Setup (once)
    cd tests
    npm install
    npx playwright install chromium
    pip install numpy

Node 18 or later and Python 3 are needed.

## Run everything
    bash suite.sh

The first run creates the test audio (`make_test_audio.py`, `make_speech.py`; the .wav files are not committed).

## What is checked
- `ui_check.js`: the interface (removed items stay removed, the version label matches `sw.js`, pad first and 80% tall on touch screens, collapsible panels, hold keys, text not selectable).
- `detect_check.js`: voice detection. With a voice WAV and the cue playing (with simulated bleed into the microphone, including the Dynamic voice as the cue) all 6 bursts must be found and the gaps between them must match. With no voice (a quiet room, hiss that gets louder like phone auto-gain, a low hum, the cue leaking into a silent room) nothing may be detected.
- `profile_check.js`: the Dynamic voice learns a speech-like WAV with known pitch, syllable rate, vowel formants and phrase shape.
- `onset_check.js`: how well MICE finds where speech started, from the recording alone (the reference for the latency meter), against known truth located with a sync pulse in each file: clean room within 5 ms, a room 20 dB noisier within 15 ms, and soft hiss-first onsets ("s", "f") must be found at the hiss, not at the voiced part.
- `auto_check.js`: the experimental auto cue: one start per voice burst with a small measured delay (the meter), nothing on silence, hiss or hum, loud non-voice sounds started then dropped as false starts, nothing when switched off, meter reset.
- `leak_check.js`: a second voice speaks first without the cue held (like a call leaking into the microphone) and the user answers while holding the cue; the Dynamic voice must learn the user's pitch, not the leaked voice. Also checks the "all speech" and "nothing" modes.
- `hiss_check.js`: the Hiss setting really turns the Dynamic voice's consonant noise on and off.
- `wake_check.js`: the screen wake lock is requested while listening, asked for again when the page comes back, released on stop; and the user is told what to do when there is no support.
- `pwa_check.js`: installs the service worker and reloads offline.

## Options
- `PAGE`: path to a different page (default `../index.html`).
- `CHROMIUM_PATH`: a Chromium binary, if not Playwright's own.
- URL switches (test only): `simbleed=G&simdelay=MS` mixes the cue into the microphone with gain G and delay MS; `simodd=1` ring-modulates that bleed; `nocomp=1` turns cancelling off; `capture=script` forces the ScriptProcessor fallback.

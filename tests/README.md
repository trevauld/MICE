# MICE tests

These run MICE.html in headless Chromium with a fake microphone. They play a WAV with known voice starts,
press the cue key at set times, save the session, and compare MICE's press-to-voice leads with ground truth
measured directly from the saved audio.

## Setup (once)
    cd tests
    npm install
    npx playwright install chromium
    pip install numpy

Node 18 or later and Python 3 are needed.

## Run
    bash suite.sh

The first run creates the test audio (`make_test_audio.py`). For each case you get:
- the bleed message MICE showed,
- the number of voice starts (6 expected) and cues with no voice (1 expected),
- the leads from MICE and from ground truth, and their difference. It should stay within about half a millisecond.

The `no_cancel` case is a deliberate failure: with cancelling off, every press shows up as a voice start
about 20 ms after it.

## Single runs
    node run_session.js "<url query>" <name> ['<json changes>' | delay]
    python3 ground_truth.py <name> <simbleed gain> <simdelay ms>

Changes made after the session starts: `{"timbre":"organ","note":"45","vol":"90","simgain":0.04}`.
`simgain` changes the simulated bleed, like the computer's volume keys would.

Environment variables:
- `WAV`: the fake microphone file (default `test_voice.wav`).
- `OFFSET`: seconds to shift the presses. Use 3 with `test_voice_talk.wav`.
- `PRE`: cue lead in seconds (default 0.08).
- `PAGE`: path to the page.
- `CHROMIUM_PATH`: a Chromium binary, if not Playwright's own.

URL switches (test only):
- `simbleed=G&simdelay=MS`: mixes the cue into the mic with gain G and delay MS.
- `simodd=1`: ring-modulates that bleed so it cannot be modelled.
- `nocomp=1`: turns cancelling off.
- `capture=script`: forces the ScriptProcessor fallback.

Output goes to `tests/out/` (the saved session .zip and a log per run).

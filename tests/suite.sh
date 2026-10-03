#!/bin/bash
# Runs MICE in headless Chromium with a fake microphone and checks every case against ground truth.
cd "$(dirname "$0")" || exit 1
if [ ! -f test_voice.wav ] || [ ! -f test_voice_talk.wav ]; then python3 make_test_audio.py || exit 1; fi
[ -f test_speech.wav ] || python3 make_speech.py || exit 1
mkdir -p out
run() { # name, url query, simulated bleed gain, simulated delay ms, [json changes]
  echo "== $1"
  if ! node run_session.js "$2" "$1" "$5" > "out/$1.log" 2>&1; then echo "  FAILED"; tail -5 "out/$1.log"; return; fi
  grep '^bleed:' "out/$1.log" | sed 's/^/  /'
  grep 'PAGEERROR\|^error' "out/$1.log" | sed 's/^/  /'
  python3 ground_truth.py "$1" "$3" "$4"
}
echo "Expected: 6 voice starts, 1 cue with no voice, MICE - truth within about 0.5 ms."
run clean "" 0 0
run bleed "?simbleed=0.08&simdelay=17.3" 0.08 17.3
run bleed_weak "?simbleed=0.02&simdelay=12.7" 0.02 12.7
run bleed_strong "?simbleed=0.35&simdelay=23.1" 0.35 23.1
run sound_changed "?simbleed=0.08&simdelay=17.3" 0.08 17.3 '{"timbre":"organ","note":"45","vol":"90"}'
run volume_down "?simbleed=0.08&simdelay=17.3" 0.04 17.3 '{"simgain":0.04}'
run volume_up "?simbleed=0.08&simdelay=17.3" 0.16 17.3 '{"simgain":0.16}'
export PRE=0.035; run short_lead "?simbleed=0.08&simdelay=17.3" 0.08 17.3; unset PRE
export WAV=test_voice_talk.wav OFFSET=3; run talk_during_setup "?simbleed=0.08&simdelay=17.3" 0.08 17.3; unset WAV OFFSET
TIMBRE0=dynamic run dynamic_from_start "?simbleed=0.08&simdelay=17.3" 0.08 17.3
run dynamic_switched "?simbleed=0.08&simdelay=17.3" 0.08 17.3 '{"timbre":"dynamic","vol":"90"}'
echo
echo "Deliberate failure, cancelling off: expect 7 voice starts, each about 20 ms after its press."
run no_cancel "?simbleed=0.08&simdelay=20&nocomp=1" 0.08 20
echo
echo "== rapid presses (every press and release must be logged)"
node stress.js "?simbleed=0.08&simdelay=17.3"

echo
echo "== Dynamic voice learns the speaker (about 5.5 s of speech)"
node profile_check.js

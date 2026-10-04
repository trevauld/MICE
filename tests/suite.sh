#!/bin/bash
# Runs every check. Needs: npm install, npx playwright install chromium, pip install numpy.
cd "$(dirname "$0")" || exit 1
[ -f test_voice.wav ] && [ -f test_silence.wav ] || python3 make_test_audio.py || exit 1
[ -f test_speech.wav ] || python3 make_speech.py || exit 1
fail=0
echo "== interface";  node ui_check.js || fail=1
echo "== voice detection (and no false voice in silence, hiss or hum)"; node detect_check.js || fail=1
echo "== Dynamic voice learns the speaker"; node profile_check.js || fail=1
echo "== another voice leaking into the microphone must not be learned"; node leak_check.js || fail=1
echo "== hiss setting"; node hiss_check.js || fail=1
echo "== screen stays awake while listening"; node wake_check.js || fail=1
echo "== installable and offline (serving the folder on :8077)"
python3 -m http.server 8077 --directory .. >/dev/null 2>&1 &
SRV=$!; sleep 1
node pwa_check.js || fail=1
kill $SRV 2>/dev/null
[ $fail = 0 ] && echo "ALL OK" || echo "SOMETHING FAILED"
exit $fail

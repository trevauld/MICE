#!/bin/sh
# index.html is the source. MICE.html is the same file, for opening straight from disk.
cp "$(dirname "$0")/index.html" "$(dirname "$0")/MICE.html"

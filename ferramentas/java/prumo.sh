#!/usr/bin/env bash
set -euo pipefail
pasta="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$pasta/out"
if [ ! -f "$pasta/out/Prumo.class" ] || [ "$pasta/src/Prumo.java" -nt "$pasta/out/Prumo.class" ]; then
  javac -encoding UTF-8 -d "$pasta/out" "$pasta/src/Prumo.java"
fi
exec java -Dstdout.encoding=UTF-8 -cp "$pasta/out" Prumo "$@"

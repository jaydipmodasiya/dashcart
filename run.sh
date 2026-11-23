#!/usr/bin/env bash
# DashCart - build and run (Linux / macOS)
#   ./run.sh          -> normal mode (real 30-40 minute delivery clock)
#   ./run.sh demo     -> demo mode (delivery runs 30x faster: ~70 seconds)
set -e
cd "$(dirname "$0")"

SPEED=1
[ "$1" = "demo" ] && SPEED=30

mkdir -p backend/out
javac -encoding UTF-8 -d backend/out backend/src/dashcart/*.java
echo "Compiled OK."
java -cp backend/out dashcart.Main 8080 frontend $SPEED

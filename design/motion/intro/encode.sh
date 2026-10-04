#!/usr/bin/env bash
# Encode the 120 fps PNG sequence into web-ready 60 fps video.
# Pairs of frames are blended (tmix) to give a natural 180 degree shutter motion blur.
set -euo pipefail
FRAMES="${1:?usage: encode.sh <frames-dir> [out-dir]}"
OUT="${2:-$(dirname "$0")/out}"
mkdir -p "$OUT"
VF="tmix=frames=2:weights='1 1',fps=60"

# H.264 MP4: universal playback
ffmpeg -y -hide_banner -loglevel error -framerate 120 -i "$FRAMES/f%04d.png" \
  -vf "$VF,format=yuv420p" -c:v libx264 -preset slow -crf 15 -tune film \
  -movflags +faststart "$OUT/idea-house-intro.mp4"

# VP9 WebM: smaller file for the website
ffmpeg -y -hide_banner -loglevel error -framerate 120 -i "$FRAMES/f%04d.png" \
  -vf "$VF,format=yuv420p" -c:v libvpx-vp9 -b:v 0 -crf 30 -row-mt 1 -deadline good -cpu-used 1 \
  "$OUT/idea-house-intro.webm"

# Poster (final frame) for instant first paint
ffmpeg -y -hide_banner -loglevel error -i "$FRAMES/$(ls "$FRAMES" | tail -1)" -q:v 3 "$OUT/idea-house-intro-poster.jpg"
ls -la "$OUT"

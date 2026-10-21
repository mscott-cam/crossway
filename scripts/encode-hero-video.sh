#!/usr/bin/env bash
set -euo pipefail

DEFAULT_URL='https://cdn.prod.website-files.com/662a778edf0dbc5f95970240%2F669ad776baab0822e5c3a6af_C008_03221843_C012-transcode.mp4'
INPUT="${1:-$DEFAULT_URL}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/scripts/data"
OUT="$ROOT/public/video"
mkdir -p "$DATA" "$OUT"

if [[ "$INPUT" =~ ^https?:// ]]; then
  SRC="$DATA/hero-source.mp4"
  [[ -f "$SRC" ]] || curl -sSfL -o "$SRC" "$INPUT"
else
  SRC="$INPUT"
fi

START=4.27
DURATION=27.23
CROP='crop=1280:684:0:18'
POSTER_AT=3

excerpt=(-ss "$START" -t "$DURATION" -i "$SRC")

encode_mp4() {
  ffmpeg -hide_banner -loglevel error -y "${excerpt[@]}" -an \
    -vf "$CROP,scale=$1:-2" \
    -c:v libx264 -preset slow -crf "$2" -profile:v main -pix_fmt yuv420p \
    -movflags +faststart "$OUT/lobby-$1.mp4"
}

encode_webm() {
  ffmpeg -hide_banner -loglevel error -y "${excerpt[@]}" -an \
    -vf "$CROP,scale=$1:-2" \
    -c:v libvpx-vp9 -b:v 0 -crf "$2" -deadline good -cpu-used 1 -row-mt 1 \
    -pix_fmt yuv420p "$OUT/lobby-$1.webm"
}

encode_mp4 1280 29
encode_mp4 720 30
encode_webm 1280 40
encode_webm 720 41

FRAME="$DATA/lobby-poster-frame.png"
ffmpeg -hide_banner -loglevel error -y \
  -ss "$(awk "BEGIN{print $START + $POSTER_AT}")" -i "$SRC" \
  -vf "$CROP" -frames:v 1 "$FRAME"

node "$ROOT/scripts/make-poster.mjs" "$FRAME" "$OUT/lobby-poster"

ls -l "$OUT"

#!/bin/bash
set -euo pipefail

DAY=$(TZ=Europe/Paris date +%F)
DIR="/tmp/tlm-marketing-$DAY"

rm -rf "$DIR"
mkdir -p "$DIR"

docker cp "touslesmatchs-api:/data/marketing/$DAY/." "$DIR/"

COUNT=0

for SVG in "$DIR"/*.svg; do
  [ -f "$SVG" ] || continue

  BASE="${SVG%.svg}"
  PNG="${BASE}.png"
  MP4="${BASE}.mp4"

  # SVG -> PNG 1080x1920
  ffmpeg -y \
    -i "$SVG" \
    -vf "scale=1080:1920:flags=lanczos" \
    -frames:v 1 \
    "$PNG" >/dev/null 2>&1

  # Vidéo verticale 12 secondes.
  # Léger zoom progressif pour éviter une simple image totalement statique.
  ffmpeg -y \
    -loop 1 \
    -i "$PNG" \
    -vf "scale=1200:2134,zoompan=z='min(zoom+0.0005,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=360:s=1080x1920:fps=30,format=yuv420p" \
    -t 12 \
    -r 30 \
    -c:v libx264 \
    -preset medium \
    -crf 20 \
    -movflags +faststart \
    "$MP4" >/dev/null 2>&1

  docker cp "$MP4" "touslesmatchs-api:/data/marketing/$DAY/$(basename "$MP4")"

  COUNT=$((COUNT+1))
done

echo "🎬 VIDEOS CREEES = $COUNT"
echo "📱 FORMAT = 1080x1920 / MP4 / 12s"
echo "🟢 AUCUNE PUBLICATION"
echo "🟢 AUCUN APPEL OPENROUTER"

[ "$COUNT" -ge 3 ]

#!/bin/sh
# Připraví perzistentní DATA_DIR při startu kontejneru.
#
# Všechna data (master CSV i editovatelné JSON) se naseedují JEN když chybí
# → editace přes admin (úprava JSON DB i nahrání nového master CSV) přežijí
# restart i auto-update image (watchtower).
#
# Pozn.: chceš-li vynutit obnovu souboru z image (např. čerstvý master CSV
# z buildu), smaž ho z volume — při dalším startu se naseeduje znovu.
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"

if [ -d /app/seed ]; then
  for f in /app/seed/*; do
    [ -e "$f" ] || continue
    name=$(basename "$f")
    if [ ! -e "$DATA_DIR/$name" ]; then
      cp "$f" "$DATA_DIR/$name"
      echo "[entrypoint] seeded $name"
    fi
  done
fi

exec "$@"

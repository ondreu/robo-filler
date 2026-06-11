#!/bin/sh
# Seed perzistentního DATA_DIR výchozími daty při prvním startu.
# Existující soubory (editované přes admin) se NEPŘEPISUJÍ — zůstávají zachovány
# i po auto-updatu image (watchtower).
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

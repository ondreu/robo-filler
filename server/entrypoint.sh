#!/bin/sh
# Připraví perzistentní DATA_DIR při startu kontejneru.
#
# Dvojí chování:
#  - REFERENČNÍ data (master CSV) se VŽDY přepíšou nejnovější verzí z image
#    → týdenní aktualizace z GitHubu se po update image projeví.
#  - EDITOVATELNÉ databáze (JSON wires/cables/kanban + jejich schémata) se
#    naseedují JEN když chybí → admin editace přežijí update image (watchtower).
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"

# Referenční CSV — vždy aktuální z image
for name in master-data.csv master-data-effi.csv; do
  if [ -f "/app/seed/$name" ]; then
    cp -f "/app/seed/$name" "$DATA_DIR/$name"
    echo "[entrypoint] refreshed $name"
  fi
done

# Editovatelné JSON databáze — seed jen při chybějícím souboru
for f in /app/seed/*.json; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  if [ ! -e "$DATA_DIR/$name" ]; then
    cp "$f" "$DATA_DIR/$name"
    echo "[entrypoint] seeded $name"
  fi
done

exec "$@"

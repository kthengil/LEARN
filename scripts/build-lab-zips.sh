#!/usr/bin/env bash
# Package each course lab from labs/<slug>/ into a standalone zip archive under downloads/<slug>-lab.zip.
# Usage: ./scripts/build-lab-zips.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABS_DIR="$ROOT_DIR/labs"
OUT_DIR="$ROOT_DIR/downloads"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$OUT_DIR"

for slug in ansible apache-kafka observability; do
  src="$LABS_DIR/$slug"
  pack_name="${slug}-lab"
  stage="$TMP_DIR/$pack_name"
  zip_path="$OUT_DIR/${pack_name}.zip"

  if [ ! -d "$src" ]; then
    echo "ERROR: Missing lab directory $src" >&2
    exit 1
  fi

  chmod +x "$src/check.sh"
  mkdir -p "$stage"
  cp -a "$src/." "$stage/"
  find "$stage" \( -name '.DS_Store' -o -name 'Thumbs.db' \) -delete

  rm -f "$zip_path"
  (cd "$TMP_DIR" && zip -q -r "$zip_path" "$pack_name")

  size=$(du -h "$zip_path" | awk '{print $1}')
  echo "Built downloads/${pack_name}.zip ($size)"
done

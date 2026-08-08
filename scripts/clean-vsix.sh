#!/usr/bin/env bash
# Removes built .vsix files. With no args, cleans every extension; with an
# extension name, cleans just that one.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

targets="$(resolve_extensions "${1:-}")" || exit 1
for ext in $targets; do
  dir="$EXTENSIONS_DIR/$ext"
  vsix_files=("$dir"/*.vsix)

  if [ ! -e "${vsix_files[0]}" ]; then
    echo "[$ext] No .vsix files to remove."
    continue
  fi

  for file in "${vsix_files[@]}"; do
    rm -f "$file"
    echo "[$ext] Removed $(basename "$file")"
  done
done

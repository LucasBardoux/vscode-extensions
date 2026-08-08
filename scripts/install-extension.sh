#!/usr/bin/env bash
# Installs a built .vsix into VS Code. With no args, installs every
# extension under extensions/*; with an extension name, installs just that one.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

targets="$(resolve_extensions "${1:-}")" || exit 1
for ext in $targets; do
  dir="$EXTENSIONS_DIR/$ext"
  vsix_files=("$dir"/*.vsix)

  if [ ! -e "${vsix_files[0]}" ]; then
    echo "[$ext] No .vsix file found - run 'npm run package -w extensions/$ext' first." >&2
    exit 1
  fi
  if [ "${#vsix_files[@]}" -gt 1 ]; then
    echo "[$ext] Multiple .vsix files found - run 'npm run clean:vsix' first." >&2
    exit 1
  fi

  echo "[$ext] Installing $(basename "${vsix_files[0]}")..."
  code --install-extension "${vsix_files[0]}"
done

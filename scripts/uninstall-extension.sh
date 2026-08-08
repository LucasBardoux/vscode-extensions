#!/usr/bin/env bash
# Uninstalls an extension from VS Code. With no args, uninstalls every
# extension under extensions/*; with an extension name, uninstalls just that one.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

targets="$(resolve_extensions "${1:-}")" || exit 1
for ext in $targets; do
  id="$(extension_id "$ext")"
  if code --uninstall-extension "$id"; then
    :
  else
    echo "[$ext] \"$id\" was not installed - nothing to uninstall."
  fi
done

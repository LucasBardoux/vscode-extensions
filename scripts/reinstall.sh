#!/usr/bin/env bash
# Full reinstall cycle (clean vsix -> uninstall -> package -> install). With no
# args, runs for every extension under extensions/*; with an extension name,
# runs just for that one.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

targets="$(resolve_extensions "${1:-}")" || exit 1
for ext in $targets; do
  "$SCRIPT_DIR/clean-vsix.sh" "$ext"
  "$SCRIPT_DIR/uninstall-extension.sh" "$ext"
  npm run package -w "extensions/$ext"
  "$SCRIPT_DIR/install-extension.sh" "$ext"
done

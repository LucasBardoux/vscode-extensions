#!/usr/bin/env bash
# Single entry point for the extension scripts.
#
# Usage: scripts/run.sh <command> [extension-name]
#
# Commands:
#   install, uninstall, clean-vsix, reinstall  - dispatch to the matching
#                                                 scripts/<command>.sh, dynamic
#                                                 across extensions/*
#   build, watch, clean, test, package         - forwarded to npm, scoped to
#                                                 the given extension or all
#                                                 workspaces
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

command="${1:-}"
extension="${2:-}"

if [ -z "$command" ]; then
  echo "Usage: scripts/run.sh <command> [extension-name]" >&2
  echo "Commands: install, uninstall, clean-vsix, reinstall, build, watch, clean, test, package" >&2
  exit 1
fi

case "$command" in
  install)
    "$SCRIPT_DIR/install-extension.sh" "$extension"
    ;;
  uninstall)
    "$SCRIPT_DIR/uninstall-extension.sh" "$extension"
    ;;
  clean-vsix)
    "$SCRIPT_DIR/clean-vsix.sh" "$extension"
    ;;
  reinstall)
    "$SCRIPT_DIR/reinstall.sh" "$extension"
    ;;
  build | watch | clean | test | package)
    if [ -n "$extension" ]; then
      resolve_extensions "$extension" > /dev/null
      npm run "$command" -w "extensions/$extension"
    else
      npm run "$command" --workspaces --if-present
    fi
    ;;
  *)
    echo "Error: unknown command '$command'." >&2
    echo "Commands: install, uninstall, clean-vsix, reinstall, build, watch, clean, test, package" >&2
    exit 1
    ;;
esac

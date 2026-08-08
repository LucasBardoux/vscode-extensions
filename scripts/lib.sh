#!/usr/bin/env bash
# Shared helpers for the vsix lifecycle scripts. Meant to be sourced, not run directly.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSIONS_DIR="$REPO_ROOT/extensions"

# Prints the directory name of every extension under extensions/*, one per line.
list_extensions() {
  for dir in "$EXTENSIONS_DIR"/*/; do
    [ -f "$dir/package.json" ] && basename "$dir"
  done
}

# Prints the extension(s) a script should act on: all of them if no name was
# given, or just the requested one if it exists. Exits with an error listing
# the valid names otherwise.
resolve_extensions() {
  local requested="${1:-}"

  if [ -z "$requested" ]; then
    list_extensions
    return
  fi

  if [ -f "$EXTENSIONS_DIR/$requested/package.json" ]; then
    echo "$requested"
    return
  fi

  echo "Error: no extension named '$requested' found in extensions/." >&2
  echo "Available extensions:" >&2
  list_extensions >&2
  exit 1
}

# Prints "<publisher>.<name>" for the given extension directory name.
# Runs node with its cwd inside the extension folder and requires a relative
# path, since git-bash's POSIX-style paths (e.g. /c/Users/...) aren't
# resolvable by a native Windows node.exe.
extension_id() {
  local dir="$1"
  (cd "$EXTENSIONS_DIR/$dir" && node -p "const p = require('./package.json'); \`\${p.publisher}.\${p.name}\`")
}

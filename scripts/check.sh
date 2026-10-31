#!/bin/sh
# Runs the house's checks against the current sources (scripts/check.ts): every room's script, the stairs, interrupting
# him on the way, the hello, reduced motion's still frames, and that nothing goes NaN, jumps or walks seated.
# Node runs the TypeScript directly but needs explicit .ts extensions and no "@/" alias, so a temp copy gets both.
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for f in $(find src/lib src/content scripts -name '*.ts'); do
  mkdir -p "$TMP/$(dirname "$f")"
  sed -E -e 's#from "(\.\.?/[^"]+)"#from "\1.ts"#' -e "s#from \"@/([^\"]+)\"#from \"$TMP/src/\\1.ts\"#" "$f" > "$TMP/$f"
done
node --experimental-strip-types --no-warnings "$TMP/scripts/check.ts"

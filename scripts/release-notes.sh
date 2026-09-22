#!/usr/bin/env bash
# Prints the CHANGELOG.md section for a version (e.g. 0.2.0). Fails if it is missing or empty.
set -euo pipefail
v="${1#v}"
notes=$(awk -v v="$v" '
  $0 ~ "^## \[" v "\]" { on=1; next }
  on && /^## \[/ { exit }
  on { print }
' CHANGELOG.md | sed -e '/./,$!d')
if [ -z "$(echo "$notes" | tr -d '[:space:]')" ]; then
  echo "CHANGELOG.md has no notes for $v - add a '## [$v] - YYYY-MM-DD' section first." >&2
  exit 1
fi
printf '%s\n' "$notes"

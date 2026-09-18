#!/usr/bin/env bash
# The "messy" fixture as a git repository with one uncommitted file that
# breaks its design system, so the review has something to find.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$HERE/../../tests/fixtures/messy/." .
git init -q && git -c user.name=eval -c user.email=eval@example.com add -A && git -c user.name=eval -c user.email=eval@example.com commit -qm base
printf 'export function NewThing() {\n  return <div style={{ color: "#3b81f5", margin: "27px" }} className="p-[11px]">x</div>;\n}\n' > components/NewThing.tsx

#!/usr/bin/env bash
# Seeds the empty eval workspace with the "messy" test fixture: a small React
# repo with duplicated components, stray colours and inline styles, so the
# skill has something real to roast. Runs before Claude starts (--scaffold).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$HERE/../../tests/fixtures/messy/." .

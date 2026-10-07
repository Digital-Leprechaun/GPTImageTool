#!/usr/bin/env sh
# Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
command -v node >/dev/null || { echo 'Install Node.js 22 or newer first.' >&2; exit 1; }
command -v codex >/dev/null || { echo 'Install the Codex CLI first. See INSTALL.md.' >&2; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'
npm ci
npm run build
node scripts/configure.mjs
codex plugin marketplace add "$PWD"
codex plugin add gpt-image-markup@joe-image-tools
echo 'Installed under AssetPack Games Tools. Restart Codex and open a new chat.'

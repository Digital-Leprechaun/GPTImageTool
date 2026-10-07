# Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT
[CmdletBinding()]
param([switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
foreach ($tool in @('node', 'npm.cmd')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 or newer (including npm), then run this installer again.' }
}
if (-not $PrepareOnly -and -not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw 'The Codex CLI must be on PATH. Install it before running this installer. See INSTALL.md.'
}
$nodeMajor = [int]((& node --version) -replace '^v(\d+).*$', '$1')
if ($nodeMajor -lt 22) { throw 'Node.js 22 or newer is required.' }
Push-Location -LiteralPath $PSScriptRoot
try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Viewer build failed.' }
    & node scripts/configure.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Local configuration failed.' }
    if (-not $PrepareOnly) {
        & codex plugin marketplace add $PSScriptRoot
        if ($LASTEXITCODE -ne 0) { throw 'Marketplace registration failed.' }
        & codex plugin add 'gpt-image-markup@joe-image-tools'
        if ($LASTEXITCODE -ne 0) { throw 'Plugin installation failed.' }
        Write-Host 'Installed under AssetPack Games Tools. Restart Codex and open a new chat.'
    }
} finally { Pop-Location }

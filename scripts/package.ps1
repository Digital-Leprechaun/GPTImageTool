# Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version = (Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
$release = Join-Path $project 'releases'
New-Item -ItemType Directory -Force -Path $release | Out-Null
$archivePath = Join-Path $release "assetpack-games-image-markup-$version.zip"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Explicit allowlist: never include user image history, local paths, dependency binaries, or Git internals.
$files = @('package.json','package-lock.json','README.md','INSTALL.md','LICENSE','NOTICE','CHANGELOG.md','install.ps1','install.sh','.gitignore','.codex-plugin/plugin.json','.agents/plugins/marketplace.json','server.mjs','dist/viewer.html')
foreach ($folder in @('lib','web','skills','scripts','.github')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $project $folder) -Recurse -File | ForEach-Object { $_.FullName.Substring($project.Length + 1) }
}
$files += 'tests/images.test.mjs', 'THIRD_PARTY_NOTICES.txt', '.gitattributes', 'UPGRADE.md'
$stream = [IO.File]::Open($archivePath, [IO.FileMode]::Create)
$zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in ($files | Sort-Object -Unique)) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $project $file), ('gpt-image-markup/' + $file.Replace('\','/'))) | Out-Null
    }
} finally { $zip.Dispose(); $stream.Dispose() }
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$archivePath.sha256", "$hash  $([IO.Path]::GetFileName($archivePath))`n")
Write-Host $archivePath

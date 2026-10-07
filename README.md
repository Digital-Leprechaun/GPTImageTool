# GPT Image Markup

A zoomable image viewer and colored highlighter editor from **AssetPack Games Tools**, inspired by the TwaZ book previewer.

Copyright (c) 2026 Joseph M Wilcox. Licensed under MIT. See LICENSE and THIRD_PARTY_NOTICES.txt.

## Install and share

Extract the release ZIP and follow INSTALL.md. The installer needs Node.js 22+, npm, and the Codex CLI. It configures this computer's paths and installs the plugin under **AssetPack Games Tools**. Keep the extracted folder in place after installation.

For an existing installation, follow [UPGRADE.md](UPGRADE.md) before replacing files. Keep your saved image workspace and reuse the installation folder.

To create a friend-testing ZIP from source, run npm ci, npm run build, then powershell -NoProfile -File scripts/package.ps1. The archive and SHA-256 checksum are written to releases/. The ZIP includes source, built viewer, licenses, and installers; dependencies are downloaded during installation. It excludes image history, screenshots, secrets, and machine-specific configuration.

Open an image → highlight yellow/red/blue/green regions → enter instructions → **Submit edits** → the same chat receives the source, marked reference, and instructions → the chat generates an edit and calls `finish_markup_edit` → the open viewer automatically loads the result for another pass.

After an edit returns, a Before/After slider reveals the edited image from left to right over its exact previous snapshot. Both layers share zoom and pan. Starting a new highlight restores the full edited view. Download in the top menu saves the current image without highlights or the comparison divider. Each completed edit compares against its own source, so repeated passes compare the latest two versions. Reopening a saved `data/requests/<UUID>/result-*.png` also restores that comparison.

The finishing step preserves every decoded RGBA pixel outside the painted selection. GPT Image masks are guidance rather than a strict boundary, so finishing composites through a binary stroke mask. Colored strokes are references, never artwork. Masks cover painted strokes, including their antialiased edges, and exclude unpainted enclosed interiors. Source snapshots are normalized to sRGB PNG; byte-identical preservation refers to those normalized pixels, not original JPEG file bytes or metadata.

## Run the local viewer

```powershell
cd path\to\gpt-image-markup
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open http://127.0.0.1:4318. The standalone preview saves requests and provides a copyable chat instruction. It cannot send messages directly without a host bridge. The installed MCP plugin sends directly through the current host session instead. No API key is used.

## Plugin integration

The compatibility manifest and skills provide the Codex package. The installer generates machine-local .mcp.json (excluded from Git and ZIP), registers the marketplace, and installs the plugin. The marketplace display name is **AssetPack Games Tools**; the internal catalog ID remains joe-image-tools for existing installations. Restart Codex and test in a new chat.

Verified on Windows with Codex desktop on October 7, 2026: import, highlighting, same-chat handoff, actual image generation, exact masked compositing, automatic result display, comparison scrubbing, and current-image download target. Other operating systems and host versions require testing.

The server registers an MCP Apps UI and OpenAI file entrypoints for PNG, JPG, JPEG, and WebP, plus a conversation-panel entrypoint. Compatible hosts can open this editor for supported files. Official documentation describes these file entrypoints in ChatGPT; support and default-viewer selection in the installed Codex build still require host verification. This is not a patch to the native app and does not intercept every existing image automatically.

Local source/candidate paths must resolve inside `GPT_IMAGE_ROOT` (the installer sets this to workspace/ in the extracted package). Files elsewhere can be imported by the user through the viewer. Requests, source/reference images, combined/per-color masks, and results live in `data/requests/<UUID>/`. Original files are never overwritten. The viewer checks completion every 2.5 seconds while open. Keep it open during editing; resuming after closing/reloading the viewer is not yet implemented.

`finish_markup_edit` refuses dimension mismatches so a resized or reframed candidate cannot silently damage registration. The chat needs an image-editing capability and must run the finishing tool; a text reply alone will not complete the request.

The HTTP server binds only to loopback and is for local testing. ChatGPT cloud cannot connect directly to this loopback endpoint. Remote ChatGPT deployment requires a separately authorized hosted/tunneled endpoint, authentication, and per-user storage isolation. Do not expose this development server publicly.

## Validate

```powershell
npm.cmd test
```

Tests check exact preservation of unpainted pixels, ring interiors, and rejection of mismatched candidate dimensions.

## Official references

- [Plugin file viewers and editors](https://developers.openai.com/plugins/build/extensions)
- [MCP Apps UI integration](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Image editing mask behavior](https://developers.openai.com/api/docs/guides/image-generation)

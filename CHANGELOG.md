# Changelog

## Unreleased — 2026-10-08

- Add Fence selections: click polygon vertices and close at the first point to select the filled interior.
- Cancel unfinished fences with Esc or Ctrl-Z; preserve all pixels outside brush and fence selections.
- Open Image Markup in the sidebar by default and reuse it after edits; restore before/after comparison when reopening saved results.
- Improve inline edit handoff and add tests for fence controls, selection masks, and legacy brush compatibility.

## 0.1.4 — 2026-10-07

- Include upgrade and rollback instructions that preserve image history and marketplace paths.
- Prepare the GitHub repository and release archive.

## 0.1.3 — 2026-10-07

- Drop a PNG, JPEG, or WebP file onto the viewer to replace the current image and start a fresh markup pass.
- Reject replacement during a pending edit to keep its result attached to the correct source.

## 0.1.2 — 2026-10-07

- Rename the marketplace display label to AssetPack Games Tools.
- Add MIT licensing, copyright notices, and friend-testing installation instructions.
- Add installers that configure machine-local paths and a clean ZIP release script.

## 0.1.1 — 2026-10-07

- Add before/after comparison scrubbing and current-image download.
- Add the Asset Pack Games logo to the viewer header.

## 0.1.0 — 2026-10-07

- Add zoom, pan, colored highlighting, same-chat edit handoff, and automatic result display.
- Preserve every unselected source pixel when finishing an edit.

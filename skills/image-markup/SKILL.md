---
name: image-markup
description: Open an image in the markup viewer or apply an image markup request submitted from that viewer. Use for colored highlighted region edits with a request ID.
---

Use `open_image_markup` to open the editor. If a local source is outside `GPT_IMAGE_ROOT`, have the user import it through the viewer rather than broaden file access automatically.

When the viewer submits an edit request:

1. Call `get_markup_request` with its request ID. Inspect the saved source and marked reference. Read the prompt and each used color's instructions. Highlight colors are annotations; never render them as artwork.
2. Use the available image editing tool with the source and colored reference. Brush strokes select only painted areas; their enclosed unpainted interiors are excluded. Completed fences select their entire filled polygon interior. The saved selection mask defines the exact boundary. Preserve scene registration, dimensions, and all unrelated objects.
3. Save an aligned candidate PNG inside `GPT_IMAGE_ROOT`. If image generation returns other dimensions, align it deliberately before finishing; do not blindly stretch a differently framed scene.
4. Call `finish_markup_edit` with the request ID and candidate path. This is required: it copies candidate pixels only inside the selection and keeps the saved source pixels everywhere else. It creates a new result and marks the request completed. The open viewer polls completion and loads that result for another markup pass.
5. For an inline workflow, call `open_image_markup` with `sourcePath` set to the successful finish result's `resultPath`. This opens a fresh editor at the current point in the chat and restores the saved original for before/after comparison. The submitting editor collapses its controls when it detects completion; its chat entry remains in history. Updating the older viewer through polling alone does not put the result beside the completion message. For a sidebar workflow, keep the existing viewer.
6. Report completion only after finishing succeeds and the requested viewer is opened. If generation, alignment, or opening fails, explain the failure in the chat; do not pretend that step completed.

These tools do not generate images themselves or use an API key. The active chat supplies image editing. Do not claim that the native viewer is globally replaced on hosts where file entrypoints are unsupported.

Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT

---
name: image-markup
description: Open an image in the markup viewer or apply an image markup request submitted from that viewer. Use for colored highlighted region edits with a request ID.
---

Use `open_image_markup` to open the editor. If a local source is outside `GPT_IMAGE_ROOT`, have the user import it through the viewer rather than broaden file access automatically.

When the viewer submits an edit request:

1. Call `get_markup_request` with its request ID. Inspect the saved source and marked reference. Read the prompt and each used color's instructions. Highlight colors are annotations; never render them as artwork.
2. Use the available image editing tool with the source and colored reference. Paint strokes define the selected areas; enclosed unpainted interiors are excluded. Preserve scene registration, dimensions, and all unrelated objects.
3. Save an aligned candidate PNG inside `GPT_IMAGE_ROOT`. If image generation returns other dimensions, align it deliberately before finishing; do not blindly stretch a differently framed scene.
4. Call `finish_markup_edit` with the request ID and candidate path. This is required: it copies candidate pixels only inside the selection and keeps the saved source pixels everywhere else. It creates a new result and marks the request completed. The open viewer polls completion and loads that result for another markup pass.
5. Report completion only after that tool succeeds. If generation or alignment fails, explain the failure in the chat; do not pretend the request completed.

These tools do not generate images themselves or use an API key. The active chat supplies image editing. Do not claim that the native viewer is globally replaced on hosts where file entrypoints are unsupported.

Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT

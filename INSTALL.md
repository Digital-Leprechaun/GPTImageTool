# Install GPT Image Markup

Copyright (c) 2026 Joseph M Wilcox. Licensed under MIT.

This ZIP is a local Codex plugin package. Extract it first; it is not a cloud ChatGPT upload. It needs Node.js 22 or newer, npm, and the Codex CLI on PATH. The installer downloads locked npm dependencies, builds the viewer, configures this computer's paths, and installs the local plugin. No image API key is needed; image generation comes from your active chat.

If the Codex CLI is missing, install it with `npm install -g @openai/codex`. Use a Codex desktop version that supports plugins and MCP Apps. Windows installation is tested; the macOS/Linux shell installer is included but has not been tested on those platforms.

1. Extract the ZIP into a permanent writable folder, for example `Documents/AssetPackGames/GPTImageMarkup`. Keep this folder after installation: the server runs from it.
2. Open a terminal in the extracted `gpt-image-markup` folder.
3. On Windows, run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
   ```

   On macOS/Linux, run `sh ./install.sh`.
4. Restart Codex and open a new chat. The marketplace label is **AssetPack Games Tools**. The internal catalog ID remains `joe-image-tools` to retain existing installs.
5. Ask: **Open Image Markup so I can import an image.** Use Open image, highlight a small area, add instructions, and Submit edits. Keep the viewer open. After the edit returns, scrub the comparison slider and download the result.

The local image workspace is `workspace/` in the extracted folder. Images outside it can be imported through Open image. The chat must save edit candidates inside this workspace and call `finish_markup_edit`; the included skill explains that workflow. If your chat does not have image editing available, it cannot produce the candidate.

To update, extract a new release into its own permanent folder and run its installer. Do not move an installed folder without rerunning the installer. To remove this plugin, run `codex plugin remove gpt-image-markup@joe-image-tools`. You can then remove the extracted folder after saving any wanted images in `workspace/`.

For feedback, include your OS, Codex version, the step that failed, and any error message. Never include private images or credentials unless you intend to share them.

Packaging follows the [official OpenAI local plugin and marketplace documentation](https://developers.openai.com/plugins/build/plugins).

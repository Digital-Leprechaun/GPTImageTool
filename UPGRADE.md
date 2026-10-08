# Upgrade GPT Image Markup

Copyright (c) 2026 Joseph M Wilcox. Licensed under MIT.

## Upgrade an existing ZIP installation

1. Finish any pending image edit, download wanted results, and close the markup viewer. Quit Codex before replacing the plugin files.
2. Back up your current extracted `gpt-image-markup` folder. Your saved images and requests are in `workspace/`; keep that folder. Earlier development installations may use `data/` in the project root instead; keep that too.
3. Extract the new ZIP into a temporary folder. Copy the contents of its `gpt-image-markup` directory **into the existing installation directory**, allowing release files to be replaced. Do not delete your existing directory or its `workspace/` or `data/` folders. The ZIP contains neither of those folders.
4. Open a terminal in the existing installation directory and run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
   ```

   On macOS/Linux, run `sh ./install.sh`.

   The installer refreshes dependencies, rebuilds the viewer, regenerates paths, and installs the new version using the same plugin ID. It leaves saved image history in place. No uninstall is required.
5. Restart Codex and open a new chat. Say **Open Image Markup**. Test a dropped PNG, JPEG, or WebP, then highlight and submit an edit. After completion, check the comparison slider and Download.

If installation fails, keep your backup and report the failing step and message. To roll back, close Codex, restore the previous release files to the same installation directory while keeping your current saved images, then rerun that release's installer.

## Moving to another installation folder

The marketplace ID `joe-image-tools` may still point at the old folder. Preserve your saved images first, then run `codex plugin marketplace remove joe-image-tools` to remove that catalog registration, and run the installer in the new folder to register it again. This does not mean deleting the old image files. Restart Codex afterward. Keep the new installation folder in place.

## This release

Version 0.1.5 adds filled polygon Fence selections and opens Image Markup in the sidebar by default. Click vertices, then click the first point to close a fence; Esc or Ctrl-Z cancels an unfinished fence. The sidebar viewer loads completed edits automatically, and reopening a saved result restores before/after comparison. Existing brush highlights, image-file drag-and-drop, Download, and image history remain supported. File replacement is refused while an image edit is pending; drop the file again once the edit finishes.

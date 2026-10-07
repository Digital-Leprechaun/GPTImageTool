// Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Keep dependencies in the extracted package and writable image history outside the plugin cache.
const directory = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(directory, 'workspace');
await mkdir(root, { recursive: true });
const config = { mcpServers: { 'gpt-image-markup': {
  command: process.execPath,
  args: [resolve(directory, 'server.mjs'), '--stdio'],
  env: { GPT_IMAGE_ROOT: root }
} } };
await writeFile(resolve(directory, '.mcp.json'), `${JSON.stringify(config, null, 2)}\n`);
console.log(`Image workspace: ${root}`);

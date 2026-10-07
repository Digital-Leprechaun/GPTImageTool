// Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const directory = resolve(process.argv[2] || '.');
const client = new Client({ name:'package-smoke-test', version:'1.0.0' });
const transport = new StdioClientTransport({ command:process.execPath,
  args:[resolve(directory,'server.mjs'),'--stdio'],
  env:{...process.env,GPT_IMAGE_ROOT:resolve(directory,'workspace')} });
try {
  await client.connect(transport);
  const tools = await client.listTools();
  for(const name of ['open_image_markup','get_markup_request','finish_markup_edit'])assert(tools.tools.some(t=>t.name===name));
  const response = await client.callTool({name:'open_image_markup',arguments:{}});
  assert(!response.isError);
  const resource = await client.readResource({uri:'ui://gpt-image-markup/viewer.html'});
  const html = resource.contents[0].text;
  for(const value of ['Asset Pack Games','Before and after comparison','Download','Copyright'])assert(html.includes(value));
  console.log('MCP initialization, tools, viewer resource, branding, comparison and download: passed.');
} finally { await client.close(); }

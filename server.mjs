/*! Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT */
import express from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { OpenAIExtensions } from '@openai/mcp-extensions/server';
import { z } from 'zod';
import { decodeImage, requestSchema } from './lib/images.mjs';
import { saveRequest, getRequest, finishRequest, requestDir, readLocalImage } from './lib/store.mjs';

const directory = fileURLToPath(new URL('.', import.meta.url));
const uri = 'ui://gpt-image-markup/viewer.html';
const text = value => ({ type: 'text', text: JSON.stringify(value) });
const result = value => ({ content: [text(value)], structuredContent: value });
function createServer() {
  const server = new McpServer({ name: 'gpt-image-markup', version: '0.1.4' });
  new OpenAIExtensions(server);
  registerAppResource(server, 'Image markup', uri, {}, async () => ({ contents: [{ uri,
    mimeType: RESOURCE_MIME_TYPE, text: await readFile(resolve(directory, 'dist/viewer.html'), 'utf8'),
    _meta: { 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'fullscreen' } }
  }] }));
  registerAppTool(server, 'open_image_markup', {
    title: 'Open image markup', description: 'Open an image to zoom and highlight edit regions. Optional sourcePath must be inside GPT_IMAGE_ROOT. The user can also import an image.',
    inputSchema: { sourcePath: z.string().optional(), file: z.object({ name: z.string(), resourceUri: z.string() }).optional() },
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: uri }, 'openai/ui': { entrypoints: [
      { type: 'thread' }, { type: 'file', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
    ] } }
  }, async ({ sourcePath }) => {
    const image = sourcePath ? await readLocalImage(sourcePath) : undefined;
    return { content: [{ type: 'text', text: 'Highlight image regions and submit an edit request.' }],
      structuredContent: { name: sourcePath || 'Image markup' },
      _meta: image ? { source: `data:image/png;base64,${image.toString('base64')}` } : {} };
  });
  server.registerTool('save_markup_request', {
    description: 'Save an exact source snapshot, colored reference, masks, and prompt. Saving alone does not start generation.',
    inputSchema: requestSchema, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
  }, async args => result(await saveRequest(args)));
  server.registerTool('get_markup_request', { description: 'Read the edit instructions and source/reference images for a saved request. Call before editing.',
    inputSchema: { requestId: z.uuid() }, annotations: { readOnlyHint: true }
  }, async ({ requestId }) => {
    const request = await getRequest(requestId);
    const content = [text(request)];
    for (const name of ['source.png', 'marked-reference.png']) {
      const bytes = await readFile(resolve(requestDir(requestId), name));
      content.push({ type: 'image', mimeType: 'image/png', data: bytes.toString('base64') });
    }
    return { content, structuredContent: request };
  });
  server.registerTool('get_markup_status', {
    description: 'Read request completion and return the finished image to the markup viewer.',
    inputSchema: { requestId: z.uuid() }, annotations: { readOnlyHint: true }
  }, async ({ requestId }) => {
    const request = await getRequest(requestId);
    return { ...result(request), _meta: request.resultPath ? {
      source: `data:image/png;base64,${(await readFile(request.resultPath)).toString('base64')}`
    } : {} };
  });
  server.registerTool('finish_markup_edit', {
    description: 'After generating the edit, composite it through the saved selection mask to preserve every unselected source pixel. Dimensions must match. Returns a new PNG, never overwrites the original.',
    inputSchema: { requestId: z.uuid(), candidatePath: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, async ({ requestId, candidatePath }) => result(await finishRequest(requestId, await readLocalImage(candidatePath))));
  return server;
}
if (process.argv.includes('--stdio')) {
  await createServer().connect(new StdioServerTransport());
} else {
  const app = express();
  // Local development only. No remote deployment without authentication and isolated storage.
  app.use((req, res, next) => {
    if (!['127.0.0.1', 'localhost'].includes(req.hostname)) return res.sendStatus(403);
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return res.sendStatus(403);
    next();
  });
  app.use(express.json({ limit: '42mb' }));
  app.get('/', (_req, res) => res.sendFile(resolve(directory, 'dist/viewer.html')));
  app.post('/api/requests', async (req, res, next) => {
    try { res.json(await saveRequest(req.body)); } catch (e) { next(e); }
  });
  app.post('/api/finish', async (req, res, next) => {
    try { const input = z.object({ requestId: z.uuid(), candidate: z.string().max(40_000_000) }).parse(req.body);
      res.json(await finishRequest(input.requestId, decodeImage(input.candidate))); } catch (e) { next(e); }
  });
  app.get('/api/requests/:id', async (req, res, next) => {
    try { const request = await getRequest(req.params.id);
      res.json({ ...request, source: request.resultPath ? `data:image/png;base64,${(await readFile(request.resultPath)).toString('base64')}` : undefined });
    } catch (e) { next(e); }
  });
  app.post('/mcp', async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.use((error, _req, res, _next) => res.status(400).json({ error: error.message }));
  const port = Number(process.env.PORT || 4318);
  app.listen(port, '127.0.0.1', () => console.log(`Image markup: http://127.0.0.1:${port}`));
}

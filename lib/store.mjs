/*! Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT */
import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { z } from 'zod';
import { buildReferences, compositeSelection, decodeImage, normalizeImage, requestSchema, sha256 } from './images.mjs';

export const root = resolve(process.env.GPT_IMAGE_ROOT || process.cwd());
export const dataRoot = resolve(root, 'data/requests');
const idSchema = z.uuid();
export const requestDir = id => resolve(dataRoot, idSchema.parse(id));
export async function readLocalImage(path) {
  const base = await realpath(root), file = await realpath(resolve(root, path));
  const within = relative(base, file);
  if (isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`)) throw new Error('Image must be inside GPT_IMAGE_ROOT. Import other images through the viewer.');
  return normalizeImage(await readFile(file));
}
export async function saveRequest(input) {
  const payload = requestSchema.parse(input);
  const dir = requestDir(payload.requestId);
  const payloadHash = sha256(Buffer.from(JSON.stringify(payload)));
  try {
    const prior = await getRequest(payload.requestId);
    if (prior.payloadHash !== payloadHash) throw new Error('This request ID already belongs to another edit.');
    return prior;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const source = await normalizeImage(decodeImage(payload.source));
  const refs = await buildReferences(source, payload.strokes);
  const groups = Object.keys((await import('./images.mjs')).palette).filter(c => payload.strokes.some(s => s.color === c));
  await mkdir(dataRoot, { recursive: true });
  await mkdir(dir); // Refuse to overwrite an existing request, including an incomplete save.
  await writeFile(resolve(dir, 'source.png'), source);
  await writeFile(resolve(dir, 'marked-reference.png'), refs.marked);
  await writeFile(resolve(dir, 'selection-mask.png'), refs.mask);
  await writeFile(resolve(dir, 'api-mask.png'), refs.apiMask);
  for (const color of groups) {
    const perColor = await buildReferences(source, payload.strokes.filter(s => s.color === color));
    await writeFile(resolve(dir, `selection-mask-${color}.png`), perColor.mask);
  }
  const request = { schema: 1, id: payload.requestId, name: payload.name, prompt: payload.prompt,
    strokes: payload.strokes, colors: groups, width: refs.width, height: refs.height,
    sourceSha256: sha256(source), payloadHash, status: 'saved', createdAt: new Date().toISOString(),
    directory: dir, boundary: 'Only highlighted pixels may change. Brush strokes exclude unpainted enclosed areas; completed fences include their filled interiors.' };
  await writeFile(resolve(dir, 'request.json'), JSON.stringify(request, null, 2));
  return request;
}
export async function getRequest(id) {
  return JSON.parse(await readFile(resolve(requestDir(id), 'request.json'), 'utf8'));
}
export async function finishRequest(id, candidate) {
  const request = await getRequest(id), dir = requestDir(id);
  const source = await readFile(resolve(dir, 'source.png'));
  if (sha256(source) !== request.sourceSha256) throw new Error('Saved source changed. Refusing to apply.');
  const mask = await readFile(resolve(dir, 'selection-mask.png'));
  const result = await compositeSelection(source, await normalizeImage(candidate), mask);
  const resultName = `result-${crypto.randomUUID()}.png`;
  await writeFile(resolve(dir, resultName), result);
  request.status = 'completed'; request.resultPath = resolve(dir, resultName); request.completedAt = new Date().toISOString();
  await writeFile(resolve(dir, 'request.json'), JSON.stringify(request, null, 2));
  return request;
}

/*! Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const palette = { red: '#ff5656', yellow: '#ffd34f', blue: '#479dff', green: '#4cda80' };
const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
export const requestSchema = z.object({
  requestId: z.uuid(), name: z.string().max(200),
  source: z.string().max(40_000_000),
  prompt: z.string().trim().min(1).max(12000),
  strokes: z.array(z.object({ color: z.enum(['red', 'yellow', 'blue', 'green']),
    kind: z.enum(['brush', 'fence']).optional(),
    width: z.number().min(.001).max(.5), points: z.array(point).min(1).max(4000)
  }).refine(s=>s.kind!=='fence'||s.points.length>=3,{message:'A fence needs at least three points.'})).min(1).max(100)
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function decodeImage(value) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error('Use a PNG, JPEG, or WebP image.');
  return Buffer.from(match[2], 'base64');
}
export async function normalizeImage(bytes) {
  const meta = await sharp(bytes, { limitInputPixels: 24_000_000 }).metadata();
  if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages || 1) > 1) throw new Error('Use a single-frame PNG, JPEG, or WebP.');
  return sharp(bytes, { limitInputPixels: 24_000_000 }).rotate().toColourspace('srgb').ensureAlpha().png().toBuffer();
}
function strokeSvg(strokes, width, height, colors) {
  const body = strokes.map(s => {
    const radius = s.width * height / 2, color = colors ? palette[s.color] : '#ffffff';
    if(s.kind==='fence')return `<polygon points="${s.points.map(([px,py])=>`${px*width},${py*height}`).join(' ')}" fill="${color}" fill-rule="evenodd"/>`;
    const [x, y] = s.points[0];
    return s.points.length === 1
      ? `<circle cx="${x * width}" cy="${y * height}" r="${radius}" fill="${color}"/>`
      : `<polyline points="${s.points.map(([px, py]) => `${px * width},${py * height}`).join(' ')}" stroke="${color}" stroke-width="${radius * 2}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
}
export async function buildReferences(source, strokes) {
  const { width, height } = await sharp(source).metadata();
  const selection = await sharp(strokeSvg(strokes, width, height, false)).ensureAlpha().raw().toBuffer();
  const maskBytes = Buffer.alloc(width * height), apiBytes = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < maskBytes.length; i++) {
    // Binary authorization boundary: antialiased stroke-edge pixels belong to the selection.
    maskBytes[i] = selection[i * 4 + 3] > 0 ? 255 : 0;
    apiBytes[i * 4 + 3] = 255 - maskBytes[i];
  }
  const mask = await sharp(maskBytes, { raw: { width, height, channels: 1 } }).png().toBuffer();
  const apiMask = await sharp(apiBytes, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const overlay = await sharp(strokeSvg(strokes, width, height, true)).ensureAlpha().raw().toBuffer();
  for (let i = 3; i < overlay.length; i += 4) overlay[i] = Math.round(overlay[i] * .38);
  const marked = await sharp(source).composite([{ input: overlay, raw: { width, height, channels: 4 } }]).png().toBuffer();
  return { width, height, mask, apiMask, marked };
}
export async function compositeSelection(source, candidate, mask) {
  const original = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const edited = await sharp(candidate).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (original.info.width !== edited.info.width || original.info.height !== edited.info.height) {
    throw new Error(`Edited image must be ${original.info.width} × ${original.info.height}. Dimensions differ; align the candidate before applying it.`);
  }
  const selection = await sharp(mask).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  if (selection.info.width !== original.info.width || selection.info.height !== original.info.height) throw new Error('Mask dimensions differ.');
  const pixels = Buffer.from(original.data);
  for (let i = 0; i < selection.data.length; i++) {
    if (selection.data[i] === 255) edited.data.copy(pixels, i * 4, i * 4, i * 4 + 4);
  }
  return sharp(pixels, { raw: original.info }).png().toBuffer();
}

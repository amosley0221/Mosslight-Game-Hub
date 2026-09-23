import { useEffect, useState } from 'react';
import { fileSrc } from '../platform';
import type { GitHubStore } from './github';

/**
 * Synced images live in the sync repo under images/<sha256>.jpg and are referenced
 * as "img:images/<hash>.jpg". Each device downloads them once into Cache Storage.
 */
const CACHE = 'mosslight-images-v1';
const listeners = new Set<() => void>();
let store: GitHubStore | null = null;
export const setImageStore = (s: GitHubStore | null) => { store = s; listeners.forEach(l => l()); };
export const hasImageStore = () => !!store;

const mem = new Map<string, string>();
const inflight = new Map<string, Promise<string | undefined>>();

async function sha256Hex(bytes: Uint8Array) {
  const h = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function cachePut(ref: string, blob: Blob) {
  try { const c = await caches.open(CACHE); await c.put('https://mosslight.local/' + ref, new Response(blob)); } catch { /* no Cache Storage */ }
}
async function cacheGet(ref: string): Promise<Blob | null> {
  try { const c = await caches.open(CACHE); const r = await c.match('https://mosslight.local/' + ref); return r ? r.blob() : null; } catch { return null; }
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac' };
const mimeOf = (ref: string) => MIME[(ref.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

/**
 * Upload bytes to the sync repo; returns an "img:" reference every device can resolve
 * (used for cover art, concept art, shared project art and PDF guides).
 */
export async function uploadFile(bytes: Uint8Array, ext = 'jpg'): Promise<string | null> {
  if (!store) return null;
  const dir = ext === 'pdf' || /^(mp3|wav|ogg|flac|m4a|aac)$/.test(ext) ? 'files' : 'images';
  const path = `${dir}/${await sha256Hex(bytes)}.${ext}`;
  const ref = 'img:' + path;
  if (!(await store.exists(path))) {
    const r = await store.write(path, bytes, null, 'Add ' + dir);
    if (r === 'conflict' && !(await store.exists(path))) throw new Error('Upload conflict');
  }
  const blob = new Blob([bytes as BlobPart], { type: MIME[ext] || 'application/octet-stream' });
  await cachePut(ref, blob);
  mem.set(ref, URL.createObjectURL(blob));
  return ref;
}

export const uploadImage = uploadFile;

export async function resolveRef(ref: string): Promise<string | undefined> {
  if (mem.has(ref)) return mem.get(ref);
  if (inflight.has(ref)) return inflight.get(ref);
  const p = (async () => {
    let blob = await cacheGet(ref);
    if (!blob && store) {
      blob = await store.readBytes(ref.slice(4)).catch(() => null);
      if (blob) await cachePut(ref, blob);
    }
    if (!blob) return undefined;
    // GitHub serves raw bytes without a useful type; set it so PDFs and images display.
    const url = URL.createObjectURL(blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: mimeOf(ref) }));
    mem.set(ref, url);
    listeners.forEach(l => l());
    return url;
  })();
  inflight.set(ref, p);
  p.finally(() => inflight.delete(ref));
  return p;
}

/** Resolves a stored image reference (img: ref, local path, data/http URL) to an <img> src. */
export function useImageSrc(ref?: string): string | undefined {
  const [v, bump] = useState(0);
  const isRef = !!ref && ref.startsWith('img:');
  useEffect(() => {
    if (!isRef || mem.has(ref!)) return;
    const l = () => bump(n => n + 1);
    listeners.add(l);
    void resolveRef(ref!);
    return () => { listeners.delete(l); };
  }, [ref, isRef, v]);
  if (!ref) return undefined;
  return isRef ? mem.get(ref) : fileSrc(ref);
}

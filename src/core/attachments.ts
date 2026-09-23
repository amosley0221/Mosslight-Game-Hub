import type { Attachment, Project } from './types';
import { fmtSize, uid } from './util';
import { homePath, isDesktop, joinPath, readFileBytes, saveBytes } from '../platform';
import { deviceId, localFolder } from '../sync/device';
import { resolveRef, uploadFile } from '../sync/images';

/** Files this session has in memory, so we don't re-read them to send. */
const cache = new Map<string, { bytes: Uint8Array; mime: string }>();

const MAX_SHARE = 60 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1568; // Anthropic's recommended maximum for images.
const MAX_TEXT = 20000;

export function kindOf(name: string, mime = ''): Attachment['kind'] {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'].includes(ext)) return 'image';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'fbx', 'blend', 'glb', 'unitypackage'].includes(ext)) return 'archive';
  if (ext === 'pdf') return 'pdf';
  if (mime.startsWith('text/') || ['txt', 'md', 'json', 'csv', 'log', 'yml', 'yaml', 'xml', 'cs', 'cpp', 'h', 'gd', 'ts', 'tsx', 'js', 'py', 'lua', 'hlsl', 'glsl', 'shader'].includes(ext)) return 'text';
  return 'other';
}

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Shrink big screenshots so they fit comfortably in an API request. */
async function fitImage(file: Blob): Promise<{ bytes: Uint8Array; mime: string }> {
  const raw = new Uint8Array(await file.arrayBuffer());
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = Math.max(img.width, img.height);
    if (max <= MAX_IMAGE_EDGE && raw.length < 4 * 1024 * 1024) return { bytes: raw, mime: file.type || 'image/png' };
    const k = MAX_IMAGE_EDGE / max;
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.85).split(',')[1];
    return { bytes: Uint8Array.from(atob(data), ch => ch.charCodeAt(0)), mime: 'image/jpeg' };
  } catch {
    return { bytes: raw, mime: file.type || 'application/octet-stream' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function thumbOf(file: Blob): Promise<string | undefined> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 360 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Where dropped files land on disk, so local agents can open them. */
async function inboxFor(proj: Project | null) {
  const lf = proj && localFolder(proj);
  return lf?.path ? joinPath(lf.path, 'Mosslight', 'Inbox') : homePath('Mosslight', 'Inbox', proj?.id || 'chat');
}

/**
 * Prepares dropped/picked files for the chat: saves them where agents can reach them,
 * makes a preview, and (with sync on) copies them so the other devices see them too.
 */
export async function prepareAttachments(files: File[], proj: Project | null, synced: boolean, onStep?: (s: string) => void): Promise<Attachment[]> {
  const out: Attachment[] = [];
  const dir = await inboxFor(proj).catch(() => '');
  for (const f of files) {
    onStep?.(`Adding ${f.name}…`);
    const kind = kindOf(f.name, f.type);
    const a: Attachment = { id: uid(), name: f.name, kind, size: f.size, mime: f.type || undefined };
    const payload = kind === 'image' ? await fitImage(f) : { bytes: new Uint8Array(await f.arrayBuffer()), mime: f.type || 'application/octet-stream' };
    cache.set(a.id, payload);
    if (kind === 'image') a.thumb = await thumbOf(f);
    // Keep the original on disk so Claude Code / Codex can open it.
    if (isDesktop && dir) {
      try {
        const name = `${Date.now().toString(36)}_${f.name.replace(/[^\w.() -]+/g, '_')}`;
        a.path = await saveBytes(new Uint8Array(await f.arrayBuffer()), await joinPath(dir, name), '');
        a.device = deviceId;
      } catch { /* can't write — the in-memory copy still works for this session */ }
    }
    if (synced && f.size <= MAX_SHARE) {
      try { a.ref = (await uploadFile(payload.bytes, (f.name.split('.').pop() || 'bin').toLowerCase())) || undefined; } catch { /* stays local */ }
    }
    out.push(a);
  }
  return out;
}

/** The bytes of an attachment, from memory, disk or sync. */
export async function attachmentBytes(a: Attachment): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const hit = cache.get(a.id);
  if (hit) return hit;
  try {
    if (a.path && isDesktop && (!a.device || a.device === deviceId)) {
      const bytes = await readFileBytes(a.path, MAX_SHARE);
      const v = { bytes, mime: a.mime || 'application/octet-stream' };
      cache.set(a.id, v);
      return v;
    }
    if (a.ref) {
      const url = await resolveRef(a.ref);
      if (!url) return null;
      const blob = await (await fetch(url)).blob();
      const v = { bytes: new Uint8Array(await blob.arrayBuffer()), mime: a.mime || blob.type };
      cache.set(a.id, v);
      return v;
    }
  } catch { /* unavailable on this device */ }
  return null;
}

/** A line per attached file, so any agent knows what came with the message. */
export async function describeAttachments(list: Attachment[]): Promise<string> {
  if (!list.length) return '';
  const lines: string[] = ['The user attached these files:'];
  for (const a of list) {
    lines.push(`- ${a.name} (${a.kind}, ${fmtSize(a.size)})${a.path ? ` — saved at ${a.path}` : ''}`);
    if (a.kind === 'text') {
      const b = await attachmentBytes(a);
      if (b) {
        const text = new TextDecoder().decode(b.bytes).slice(0, MAX_TEXT);
        lines.push('```\n' + text + (b.bytes.length > MAX_TEXT ? '\n… (truncated)' : '') + '\n```');
      }
    }
  }
  if (list.some(a => a.path && a.kind !== 'image' && a.kind !== 'text')) {
    lines.push('Files that are not images are on disk at the paths above — open, unzip or import them from there when you need to.');
  }
  return lines.join('\n');
}

/** Image (and PDF) blocks for the Anthropic API. */
export async function claudeBlocks(list: Attachment[]) {
  const blocks: Record<string, unknown>[] = [];
  for (const a of list.slice(0, 8)) {
    if (a.kind !== 'image' && a.kind !== 'pdf') continue;
    const b = await attachmentBytes(a);
    if (!b) continue;
    blocks.push(a.kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64(b.bytes) } }
      : { type: 'image', source: { type: 'base64', media_type: b.mime.startsWith('image/') ? b.mime : 'image/png', data: b64(b.bytes) } });
  }
  return blocks;
}

/** Image blocks for OpenAI-style chat APIs (data URLs). */
export async function openAiBlocks(list: Attachment[]) {
  const blocks: Record<string, unknown>[] = [];
  for (const a of list.slice(0, 8)) {
    if (a.kind !== 'image') continue;
    const b = await attachmentBytes(a);
    if (!b) continue;
    blocks.push({ type: 'image_url', image_url: { url: `data:${b.mime};base64,${b64(b.bytes)}` } });
  }
  return blocks;
}

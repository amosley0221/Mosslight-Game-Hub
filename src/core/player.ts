import { useEffect, useState } from 'react';
import type { MusicTrack } from './types';
import { fileSrc, isDesktop } from '../platform';
import { resolveRef } from '../sync/images';
import { deviceId } from '../sync/device';

/**
 * One audio element for the whole app, so a song keeps playing while you move
 * between tabs, projects and the chat.
 */
export interface PlayerState {
  track: MusicTrack | null;
  queue: MusicTrack[];
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  error: string;
}

let el: HTMLAudioElement | null = null;
let state: PlayerState = { track: null, queue: [], playing: false, loading: false, time: 0, duration: 0, error: '' };
const listeners = new Set<() => void>();
const emit = (patch: Partial<PlayerState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };

function audio() {
  if (el) return el;
  el = new Audio();
  el.preload = 'metadata';
  el.addEventListener('timeupdate', () => emit({ time: el!.currentTime }));
  el.addEventListener('durationchange', () => emit({ duration: Number.isFinite(el!.duration) ? el!.duration : 0 }));
  el.addEventListener('play', () => emit({ playing: true }));
  el.addEventListener('pause', () => emit({ playing: false }));
  el.addEventListener('ended', () => next());
  el.addEventListener('error', () => emit({ playing: false, loading: false, error: 'This track couldn\'t be played on this device' }));
  return el;
}

/** Where the audio bytes come from on this device: the local file, or the synced copy. */
export function canPlay(t: MusicTrack) {
  return (isDesktop && (!t.device || t.device === deviceId)) || !!t.ref;
}

async function sourceFor(t: MusicTrack): Promise<string | undefined> {
  if (isDesktop && (!t.device || t.device === deviceId)) return fileSrc(t.path);
  return t.ref ? resolveRef(t.ref) : undefined;
}

export async function play(track: MusicTrack, queue: MusicTrack[] = []) {
  const a = audio();
  if (state.track?.id === track.id && a.src) { void a.play(); return; }
  emit({ track, queue: queue.length ? queue : [track], loading: true, error: '', time: 0, duration: 0 });
  const src = await sourceFor(track);
  if (!src) { emit({ loading: false, playing: false, error: 'Not on this device yet — share it from the computer that has it' }); return; }
  a.src = src;
  emit({ loading: false });
  try { await a.play(); } catch { emit({ playing: false }); }
}

export const pause = () => audio().pause();
export const resume = () => void audio().play().catch(() => {});
export const toggle = () => (state.playing ? pause() : state.track ? resume() : undefined);
export const seek = (t: number) => { audio().currentTime = t; emit({ time: t }); };
export function stop() {
  audio().pause();
  audio().removeAttribute('src');
  emit({ track: null, playing: false, time: 0, duration: 0, error: '' });
}

function step(dir: 1 | -1) {
  const { queue, track } = state;
  if (!track || queue.length < 2) return;
  const i = queue.findIndex(t => t.id === track.id);
  const nextTrack = queue[(i + dir + queue.length) % queue.length];
  if (nextTrack) void play(nextTrack, queue);
}
export const next = () => step(1);
export const prev = () => step(-1);

export function usePlayer(): PlayerState {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state;
}

export const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

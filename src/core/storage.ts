/**
 * Where the library lives on this device.
 *
 * localStorage caps out around 5 MB and throws once you pass it, which used to be swallowed —
 * so a big library stopped saving without saying so. This keeps the library in IndexedDB
 * (hundreds of MB), migrates the old localStorage copy on first run, and reports failures.
 */
const DB = 'mosslight';
const STORE = 'state';
const ID = 'hub';
export const LEGACY_KEY = 'gdh:state:v3';

const hasIdb = () => typeof indexedDB !== 'undefined';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open the local database'));
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error || new Error('Local database write failed'));
    tx.oncomplete = () => db.close();
  }));
}

/** The old localStorage copy, read synchronously so the first paint isn't empty. */
export function readLegacy<T>(): T | null {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null') as T | null;
  } catch {
    return null;
  }
}

/** The saved library: IndexedDB first, the old localStorage copy if this device hasn't moved yet. */
export async function loadState<T>(): Promise<T | null> {
  if (hasIdb()) {
    try {
      const v = await run<T | undefined>('readonly', s => s.get(ID));
      if (v) return v;
    } catch { /* fall through to the legacy copy */ }
  }
  return readLegacy<T>();
}

/** Saves the library. Throws when it can't — the caller shows that, it must never be silent. */
export async function saveState(data: unknown): Promise<void> {
  if (!hasIdb()) {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
    return;
  }
  // structuredClone (what IndexedDB stores with) rejects anything non-plain; our state is JSON already.
  await run('readwrite', s => s.put(JSON.parse(JSON.stringify(data)), ID));
  // Once IndexedDB holds it, free the 5 MB the old copy was taking.
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* nothing to free */ }
}

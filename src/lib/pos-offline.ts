// Offline persistence for POS cart + queued sales.
// - Cart draft: auto-saved to localStorage so a page reload / brief network drop
//   won't lose the current cart.
// - Sales queue: sales attempted while offline (or that failed with a network
//   error) are queued locally and retried automatically when the connection
//   returns. All payloads carry an `idempotency_key` so retries are safe.

export type SaleQueueItem = {
  id: string;
  created_at: number;
  payload: any;
  is_update: boolean;
  sale_id?: string;
};

const DRAFT_KEY = "pos:draft-cart";
const QUEUE_KEY = "pos:sale-queue";

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function loadDraft<T>(): T | null {
  const raw = safeGet(DRAFT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
export function saveDraft<T>(draft: T | null) {
  if (draft == null) { safeRemove(DRAFT_KEY); return; }
  safeSet(DRAFT_KEY, JSON.stringify(draft));
}
export function clearDraft() { safeRemove(DRAFT_KEY); }

export function readQueue(): SaleQueueItem[] {
  const raw = safeGet(QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
export function writeQueue(items: SaleQueueItem[]) {
  safeSet(QUEUE_KEY, JSON.stringify(items));
}
export function enqueueSale(item: Omit<SaleQueueItem, "id" | "created_at">): SaleQueueItem {
  const id = `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const full: SaleQueueItem = { id, created_at: Date.now(), ...item };
  const q = readQueue();
  q.push(full);
  writeQueue(q);
  return full;
}
export function removeFromQueue(id: string) {
  writeQueue(readQueue().filter((x) => x.id !== id));
}

export function isNetworkError(e: any): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String(e?.message ?? e ?? "").toLowerCase();
  return /network|failed to fetch|load failed|net::err|offline|typeerror: fetch/.test(msg);
}
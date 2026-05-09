const store = new Map();
const TTL_MS = 24 * 60 * 60 * 1000;

export function saveShare(id, payload) {
  store.set(id, { ...payload, expiresAt: Date.now() + TTL_MS });
}

export function getShare(id) {
  const entry = store.get(id);
  if (!entry) return { status: 'not_found' };
  if (Date.now() > entry.expiresAt) {
    store.delete(id);
    return { status: 'expired' };
  }
  const { expiresAt, ...data } = entry;
  return { status: 'ok', data };
}

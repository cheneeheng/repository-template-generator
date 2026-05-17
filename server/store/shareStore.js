import redis from '../lib/redis.js';

const TTL_SECONDS = 24 * 60 * 60;
const KEY = (id) => `share:${id}`;

export async function saveShare(id, payload) {
  await redis.set(KEY(id), JSON.stringify(payload), 'EX', TTL_SECONDS);
}

export async function getShare(id) {
  const raw = await redis.get(KEY(id));
  if (!raw) return { status: 'not_found' };
  return { status: 'ok', data: JSON.parse(raw) };
}

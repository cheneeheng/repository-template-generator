const KEY = 'ftg:workspace';
const MAX_ENTRIES = 20;

export function loadWorkspace() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveEntry(entry) {
  const list = loadWorkspace().filter(e => e.id !== entry.id);
  const updated = [entry, ...list].slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function deleteEntry(id) {
  const list = loadWorkspace().filter(e => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}

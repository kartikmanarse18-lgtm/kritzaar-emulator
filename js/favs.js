// Favorites stored on this device only (localStorage). Safe if storage is blocked.
const KEY = 'kz-favs';
const read = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch { return []; } };
export const favList = read;
export const isFav = (id) => read().includes(id);
export function toggleFav(id) {
  const a = read(); const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1); else a.unshift(id);
  try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 200))); } catch { /* storage blocked */ }
  document.dispatchEvent(new CustomEvent('kz-favs', { detail: { id, on: i < 0 } }));
  return i < 0;
}

export class ReaderState {
  constructor(storage) {
    this.storage = storage;
  }
  read(id, count) {
    try {
      const s = JSON.parse(this.storage.getItem('book-state:' + id) || 'null');
      return {
        cursor: Number.isInteger(s?.cursor)
          ? Math.max(0, Math.min(Math.floor(count / 2) * 2, Math.floor(s.cursor / 2) * 2))
          : 0,
        open: s?.open === true,
        bookmarks: [
          ...new Set(
            (Array.isArray(s?.bookmarks) ? s.bookmarks : []).filter(
              (p) => Number.isInteger(p) && p >= 1 && p <= count,
            ),
          ),
        ].sort((a, b) => a - b),
      };
    } catch {
      return { cursor: 0, open: false, bookmarks: [] };
    }
  }
  write(id, state) {
    try {
      this.storage.setItem('book-state:' + id, JSON.stringify({ ...state, updated: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }
  preference(key, fallback) {
    try {
      const value = JSON.parse(
        this.storage.getItem('book-pref:' + key) ?? JSON.stringify(fallback),
      );
      return typeof value === typeof fallback ? value : fallback;
    } catch {
      return fallback;
    }
  }
  setPreference(key, value) {
    try {
      this.storage.setItem('book-pref:' + key, JSON.stringify(value));
    } catch {}
  }
}
export async function documentId(data) {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return 'pdf-' + [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

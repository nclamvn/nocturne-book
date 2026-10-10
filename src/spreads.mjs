export function lastSpreadCursor(count) {
  return Math.floor(count / 2) * 2;
}
export function cursorForPage(page, count) {
  if (!Number.isInteger(page) || page < 1 || page > count)
    throw new RangeError('Page outside document');
  return page === 1 ? 0 : Math.floor(page / 2) * 2;
}
export function spreadRange(cursor, count) {
  return { first: Math.max(1, Math.min(cursor, count)), last: Math.min(cursor + 1, count) };
}

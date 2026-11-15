// Order of the stores. Default: the store with the most coupons comes first.
// If the admin put the stores in their own order (rows have a `sort`), those come first in that order,
// and any store without a position follows, by number of coupons.
export function orderStores(coupons, rows) {
  const map = new Map(); // lower-case name -> { key, name, count, row }
  (coupons || []).forEach((c) => {
    const k = String(c.store || '').trim().toLowerCase();
    if (!k) return;
    const e = map.get(k) || { key: k, name: String(c.store).trim(), count: 0, row: null };
    e.count += 1; map.set(k, e);
  });
  (rows || []).forEach((r) => {
    const k = String(r.name).trim().toLowerCase();
    const e = map.get(k) || { key: k, name: r.name, count: 0, row: null };
    e.row = r; e.name = r.name; map.set(k, e);
  });
  const list = [...map.values()];
  list.sort((a, b) => {
    const sa = a.row && a.row.sort != null ? a.row.sort : null;
    const sb = b.row && b.row.sort != null ? b.row.sort : null;
    if (sa != null && sb != null) return sa - sb;
    if (sa != null) return -1;
    if (sb != null) return 1;
    return b.count - a.count || a.name.localeCompare(b.name);
  });
  return list;
}

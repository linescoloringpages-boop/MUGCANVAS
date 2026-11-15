export const CATEGORIES = ['Fashion', 'Electronics', 'Travel', 'Food', 'Home', 'Beauty'];

export const CC = ['US','CA','MX','BR','AR','CL','CO','GB','IE','FR','DE','ES','PT','IT','NL','BE','CH','AT','SE','NO','DK','FI','PL','CZ','GR','TR','IL','AE','SA','EG','ZA','NG','KE','IN','PK','BD','SG','MY','TH','VN','ID','PH','HK','TW','CN','JP','KR','AU','NZ','RU','UA','RO','HU'];

export function cname(c) {
  if (!c || c === 'WW') return 'Worldwide';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c; } catch { return c; }
}

export function sortedCountries() {
  return CC.slice().sort((a, b) => cname(a).localeCompare(cname(b)));
}

export function guessLoc() {
  try {
    const l = (navigator.language || '').split('-')[1];
    return l && CC.includes(l.toUpperCase()) ? l.toUpperCase() : '';
  } catch { return ''; }
}

// A deal shows when it is worldwide or matches the visitor's chosen country (empty = all regions).
export const inLoc = (loc, x) => !loc || !x.country || x.country === 'WW' || x.country === loc;

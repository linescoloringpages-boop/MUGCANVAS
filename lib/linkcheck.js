// Automatic link quality + safety check. Server only (used from app/api/check-link).
//
// 1. Basic rules: only http/https, no user:password@ tricks, no IP-address hosts, no internal hosts,
//    standard ports only, sane length.
// 2. Follows redirects (up to 6 hops) WITHOUT trusting them: every hop is re-checked.
// 3. Every URL on the way is looked up in Google Web Risk (malware, social engineering/phishing,
//    unwanted software).
// 4. The final page must answer (not a dead link).
//
// Our own server does the fetching, so it refuses to connect to private/internal addresses
// (checked again at connection time, which also defeats DNS tricks).
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const MAX_HOPS = 6;
const TIMEOUT_MS = 4000;
const DEADLINE_MS = 8500; // hosting functions often stop after 10 seconds
const WEBRISK_KEY = () => process.env.WEBRISK_API_KEY || '';

function ipv4Private(ip) {
  const p = ip.split('.').map(Number);
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && p[2] === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && p[2] === 2) ||
    (a === 198 && b === 51 && p[2] === 100) ||
    (a === 203 && b === 0 && p[2] === 113)
  );
}
export function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return ipv4Private(m[1]);
    return /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || s.startsWith('ff') || s.startsWith('2001:db8');
  }
  return true; // not an IP at all: treat as unsafe
}

// Used by http(s).request: resolves the name and refuses anything that is not a public address.
function safeLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return cb(new Error('blocked address'));
    if (options && options.all) return cb(null, addrs);
    return cb(null, addrs[0].address, addrs[0].family);
  });
}

// Returns an error text when the URL is not acceptable, or null.
export function basicProblem(raw) {
  if (typeof raw !== 'string' || raw.length > 2000) return 'The link is too long.';
  let u;
  try { u = new URL(raw); } catch { return 'The link is not a valid web address.'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Only http and https links are allowed.';
  if (u.username || u.password) return 'The link contains a user name or password part, which is a common trick.';
  const h = u.hostname.toLowerCase();
  if (net.isIP(h.replace(/^\[|\]$/g, ''))) return 'The link points to a raw IP address instead of a website name.';
  if (!h.includes('.') || h === 'localhost' || /\.(local|internal|localhost|lan|home|corp)$/.test(h)) return 'The link points to an internal address.';
  if (u.port && u.port !== '80' && u.port !== '443') return 'The link uses an unusual port.';
  if (/(^|\.)xn--/.test(h)) return 'The link uses an international look-alike domain name (xn--). Check it by hand.';
  return null;
}

// Free option without a billing account: Google Safe Browsing (non-commercial use only). Used only when no Web Risk key is set.
async function safeBrowsing(url, key) {
  try {
    const r = await fetch('https://safebrowsing.googleapis.com/v4/threatMatches:find?key=' + encodeURIComponent(key), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        client: { clientId: 'dealora', clientVersion: '1.0' },
        threatInfo: { threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'], platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'], threatEntries: [{ url }] },
      }),
    });
    if (!r.ok) {
      let why = '';
      try { const e = await r.json(); why = e && e.error && e.error.message ? ' ' + String(e.error.message).slice(0, 160) : ''; } catch { /* no body */ }
      return { error: 'Safe Browsing answered with an error (' + r.status + ').' + why };
    }
    const j = await r.json();
    const m = j && Array.isArray(j.matches) ? j.matches : [];
    return { threats: m.map((x) => x.threatType) };
  } catch {
    return { error: 'Safe Browsing could not be reached.' };
  }
}

async function webRisk(url) {
  const key = WEBRISK_KEY();
  if (!key) {
    const sb = process.env.SAFEBROWSING_API_KEY || '';
    if (sb) return safeBrowsing(url, sb);
    return { error: 'No safety-check key is set on the server (WEBRISK_API_KEY or SAFEBROWSING_API_KEY).' };
  }
  const qs = new URLSearchParams();
  ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'].forEach((t) => qs.append('threatTypes', t));
  qs.set('uri', url);
  qs.set('key', key);
  try {
    const r = await fetch('https://webrisk.googleapis.com/v1/uris:search?' + qs.toString(), { signal: AbortSignal.timeout(4000) });
    if (!r.ok) {
      let why = '';
      try { const e = await r.json(); why = e && e.error && e.error.message ? ' ' + String(e.error.message).slice(0, 160) : ''; } catch { /* no body */ }
      return { error: 'Web Risk answered with an error (' + r.status + ').' + why };
    }
    const j = await r.json();
    if (j && j.threat && Array.isArray(j.threat.threatTypes) && j.threat.threatTypes.length) return { threats: j.threat.threatTypes };
    return { threats: [] };
  } catch {
    return { error: 'Web Risk could not be reached.' };
  }
}

function once(u, method) {
  return new Promise((resolve) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method, lookup: safeLookup, timeout: TIMEOUT_MS,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; DealoraLinkCheck/1.0)', accept: 'text/html,*/*;q=0.8', 'accept-language': 'en' },
    }, (res) => {
      res.destroy(); // we only need the status and headers
      resolve({ status: res.statusCode, location: res.headers.location || null });
    });
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', (e) => resolve({ error: e && e.message ? e.message : 'error' }));
    req.end();
  });
}

async function fetchHop(u) {
  let r = await once(u, 'HEAD');
  if (r.error || [400, 403, 404, 405, 501].includes(r.status)) {
    const g = await once(u, 'GET');
    if (!g.error || r.error) r = g;
  }
  return r;
}

// Result: { status: 'safe' | 'unsafe' | 'broken' | 'unverified', note, finalUrl, hops }
export async function checkLink(raw) {
  const t0 = Date.now();
  const hops = [];
  let cur = String(raw || '').trim();
  let webRiskDown = '';
  for (let i = 0; i <= MAX_HOPS; i++) {
    if (Date.now() - t0 > DEADLINE_MS) return { status: 'unverified', note: 'The check took too long. Press Check again.', finalUrl: cur, hops };
    const problem = basicProblem(cur);
    if (problem) {
      const soft = /look-alike/.test(problem);
      return { status: soft ? 'unverified' : 'unsafe', note: problem, finalUrl: cur, hops };
    }
    const u = new URL(cur);
    const wr = await webRisk(u.toString());
    if (wr.threats && wr.threats.length) {
      return { status: 'unsafe', note: 'Google Web Risk flagged ' + u.hostname + ': ' + wr.threats.join(', ').toLowerCase().replace(/_/g, ' ') + '.', finalUrl: cur, hops };
    }
    if (wr.error) webRiskDown = wr.error;
    const r = await fetchHop(u);
    hops.push({ url: u.toString(), status: r.status || 0 });
    if (r.error) {
      if (/blocked address/.test(r.error)) return { status: 'unsafe', note: 'The link leads to a private or internal address.', finalUrl: cur, hops };
      return { status: 'broken', note: 'The site did not answer (' + r.error + ').', finalUrl: cur, hops };
    }
    if (r.status >= 300 && r.status < 400 && r.location) {
      try { cur = new URL(r.location, u).toString(); } catch { return { status: 'broken', note: 'Bad redirect.', finalUrl: cur, hops }; }
      continue;
    }
    // reached the final page
    if (webRiskDown) return { status: 'unverified', note: 'Safety service unavailable: ' + webRiskDown, finalUrl: cur, hops };
    if (r.status === 404 || r.status === 410 || r.status >= 500) return { status: 'broken', note: 'The page answered with error ' + r.status + '.', finalUrl: cur, hops };
    const via = hops.length > 1 ? ' after ' + (hops.length - 1) + ' redirect' + (hops.length > 2 ? 's' : '') : '';
    return { status: 'safe', note: 'Not listed by Google Web Risk; page answers (' + r.status + ')' + via + ' at ' + u.hostname + '.', finalUrl: cur, hops };
  }
  return { status: 'unverified', note: 'Too many redirects.', finalUrl: cur, hops };
}

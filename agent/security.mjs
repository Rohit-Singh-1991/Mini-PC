import net from 'node:net';
import dns from 'node:dns/promises';

function privateIPv4(value) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113);
}

function parseIPv6Words(value) {
  if (value.includes('%')) return null; // Zone identifiers are never accepted.
  let normalized = value.toLowerCase();
  const dotted = normalized.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const octets = dotted[1].split('.').map(Number);
    if (octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = normalized.slice(0, -dotted[1].length) + high + ':' + low;
  }
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0;
  if ((halves.length === 2 && missing < 1) ||
      (halves.length === 1 && left.length !== 8)) return null;
  const groups = halves.length === 2
    ? [...left, ...Array(missing).fill('0'), ...right]
    : left;
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map(g => Number.parseInt(g, 16));
}

/** Returns true for non-public, special-purpose, or malformed IP addresses. */
export function isPrivateAddress(value) {
  const version = net.isIP(value);
  if (version === 4) return privateIPv4(value);
  if (version !== 6) return true;

  const w = parseIPv6Words(value);
  if (!w) return true;
  const [a, b, c, d, e, f, g, h] = w;

  // IPv4-mapped IPv6: ::ffff:a.b.c.d or its hexadecimal form.
  if (w.slice(0, 5).every(x => x === 0) && f === 0xffff) {
    const ipv4 = [g >> 8, g & 255, h >> 8, h & 255].join('.');
    return privateIPv4(ipv4);
  }

  // Unspecified, loopback, and IPv4-compatible IPv6 ranges.
  if (w.slice(0, 6).every(x => x === 0)) return true;

  // Unique-local, link-local and multicast ranges.
  if ((a & 0xfe00) === 0xfc00 || (a & 0xffc0) === 0xfe80 || (a & 0xff00) === 0xff00) return true;

  // IPv6 transition, protocol-assignment, documentation and translation ranges.
  if ((a === 0x2001 && (b <= 0x01ff || b === 0x0db8)) || a === 0x2002) return true;
  if (a === 0x3fff && b <= 0x0fff) return true; // Documentation prefix 3fff::/20
  if (a === 0x0100 && b === 0 && c === 0 && d === 0) return true; // Discard-only 100::/64
  if (a === 0x0064 && b === 0xff9b && (c === 0 || c === 1)) return true; // NAT64
  return false;
}

/**
 * Only allow HTTP(S) URLs whose hostname resolves exclusively to public IPs.
 * This validation is also applied to browser subrequests and redirects.
 */
export async function safeUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a full URL with http:// or https://');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS websites are allowed.');
  }
  if (url.username || url.password) {
    throw new Error('URLs containing embedded usernames or passwords are blocked.');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  const localSuffixes = ['.localhost', '.local', '.internal', '.lan', '.test', '.invalid', '.example', '.home.arpa'];
  if (host === 'localhost' || localSuffixes.some(suffix => host.endsWith(suffix))) {
    throw new Error('Local/private network hosts are blocked.');
  }

  const version = net.isIP(host);
  if (version) {
    if (isPrivateAddress(host)) throw new Error('Private or reserved IP blocked.');
  } else {
    let addresses;
    try {
      addresses = await dns.lookup(host, { all: true, verbatim: true });
    } catch {
      throw new Error('Host could not be resolved.');
    }
    if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) {
      throw new Error('Host resolves to a private or reserved IP; blocked.');
    }
  }
  return url;
}


/** Redact OAuth/session credentials before exposing any URL in the dashboard or activity log. */
export function redactUrlForDisplay(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return '';
  }
  url.username = '';
  url.password = '';
  const sensitiveKey = /(token|access_token|refresh_token|id_token|auth|authorization|password|secret|client_secret|code|session|signature|(^|[_-])sig($|[_-])|api[_-]?key|jwt|state)/i;
  for (const key of [...url.searchParams.keys()]) {
    if (sensitiveKey.test(key)) url.searchParams.set(key, '[redacted]');
  }
  if (sensitiveKey.test(url.hash)) url.hash = '#[redacted]';
  return url.toString();
}


/** Validate a WebSocket URL using the same public-address rules as HTTP(S) pages. */
export async function safeWebSocketUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid ws:// or wss:// URL.');
  }
  if (!['ws:', 'wss:'].includes(url.protocol)) {
    throw new Error('Only public ws:// and wss:// destinations are allowed.');
  }
  const httpUrl = new URL(url.href);
  httpUrl.protocol = url.protocol === 'ws:' ? 'http:' : 'https:';
  await safeUrl(httpUrl.href);
  return url;
}

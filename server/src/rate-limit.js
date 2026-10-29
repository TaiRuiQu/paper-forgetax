import { isIP } from 'node:net';

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function clientIp(req) {
  const header = req.headers['cf-connecting-ip'];
  const forwarded = typeof header === 'string' ? header.trim() : '';
  const xff = req.headers['x-forwarded-for'];
  const firstForwarded = typeof xff === 'string' ? xff.split(',')[0].trim() : '';
  const ip = isIP(forwarded) ? forwarded
    : isIP(firstForwarded) ? firstForwarded : req.socket.remoteAddress || 'unknown';
  // IPv6 has multiple equivalent spellings; use a single key for all of them.
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
}

export function createAuthRateLimiter(now = Date.now) {
  const attempts = new Map();
  let nextCleanup = 0;

  // Returns the seconds until the next allowed attempt, or zero when allowed.
  return ip => {
    const time = now();
    if (time >= nextCleanup) {
      for (const [key, timestamps] of attempts) {
        if (timestamps.at(-1) <= time - WINDOW_MS) attempts.delete(key);
      }
      nextCleanup = time + 60_000;
    }
    const recent = (attempts.get(ip) || []).filter(timestamp => timestamp > time - WINDOW_MS);
    if (recent.length >= MAX_ATTEMPTS) {
      return Math.ceil((recent[0] + WINDOW_MS - time) / 1000);
    }
    recent.push(time);
    attempts.set(ip, recent);
    return 0;
  };
}

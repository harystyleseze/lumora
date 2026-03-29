import type { RequestHandler } from 'express';

interface RateWindow {
  count: number;
  resetAt: number;
}

const windows = new Map<string, RateWindow>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

// Evict expired windows every 5 minutes to prevent unbounded Map growth
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of windows) {
    if (now > win.resetAt) windows.delete(key);
  }
}, 5 * 60_000).unref();

export const rateLimit: RequestHandler = (req, res, next) => {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  let win = windows.get(key);

  if (!win || now > win.resetAt) {
    win = { count: 0, resetAt: now + WINDOW_MS };
    windows.set(key, win);
  }

  win.count++;

  if (win.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  next();
};

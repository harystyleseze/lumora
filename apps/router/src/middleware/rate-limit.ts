import type { RequestHandler } from 'express';

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export const rateLimit: RequestHandler = (req, res, next) => {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  let window = windows.get(key);

  if (!window || now > window.resetAt) {
    window = { count: 0, resetAt: now + WINDOW_MS };
    windows.set(key, window);
  }

  window.count++;

  if (window.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  next();
};

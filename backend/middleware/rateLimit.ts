import rateLimit from "express-rate-limit";

/** Global limiter: 100 requests / minute / IP. */
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
});

/** Tighter limiter for write/mint endpoints: 10 requests / minute / IP. */
export const writeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many write requests, please slow down" },
});

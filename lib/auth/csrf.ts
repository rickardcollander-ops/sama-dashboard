/**
 * Double-submit-cookie CSRF protection.
 *
 * Issues a 32-byte random token in a non-httpOnly cookie (so the client can
 * read it) and requires the same token in the ``X-CSRF-Token`` header on
 * state-changing requests. Same-site=Lax + Secure means the cookie won't
 * leak cross-origin; the header check defends against an attacker that can
 * make a request from another tab they control.
 *
 * Helpers are scoped to API route handlers (not middleware) because we need
 * Node runtime crypto and per-route opt-in.
 */

import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "sama_csrf";
const HEADER_NAME = "x-csrf-token";

function generate(): string {
  return randomBytes(32).toString("base64url");
}

export async function ensureCsrfCookie(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;
  const value = generate();
  store.set(COOKIE_NAME, value, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return value;
}

export async function verifyCsrf(req: NextRequest): Promise<boolean> {
  // Bypass for GET/HEAD/OPTIONS — only state-changing methods need CSRF.
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return true;
  }
  const store = await cookies();
  const cookieValue = store.get(COOKIE_NAME)?.value;
  const headerValue = req.headers.get(HEADER_NAME);
  if (!cookieValue || !headerValue) return false;
  if (cookieValue.length !== headerValue.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(headerValue));
  } catch {
    return false;
  }
}

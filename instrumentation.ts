/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * Initialises Sentry on the Node runtime when ``SENTRY_DSN`` is set.
 * ``beforeSend`` redacts known sensitive headers and tokens so the
 * MISSION_SECRET / Supabase service-role key never end up in error reports.
 */

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
      sendDefaultPii: false,
      beforeSend(event) {
        const headers = event.request?.headers;
        if (headers && typeof headers === "object") {
          for (const k of Object.keys(headers)) {
            const lower = k.toLowerCase();
            if (
              lower === "authorization" ||
              lower === "cookie" ||
              lower === "set-cookie" ||
              lower.startsWith("x-sama-") ||
              lower === "x-tenant-id"
            ) {
              (headers as Record<string, string>)[k] = "[redacted]";
            }
          }
        }
        if (event.request?.data && typeof event.request.data === "string") {
          event.request.data = event.request.data
            .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
            .replace(/Bearer\s+[A-Za-z0-9_\-.=]+/gi, "Bearer [redacted]");
        }
        return event;
      },
    });
  }
}

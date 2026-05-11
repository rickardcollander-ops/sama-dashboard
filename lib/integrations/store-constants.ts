/**
 * Maximum number of GEO queries a tenant can have under monitoring at once.
 * Each tracked query fans out across ChatGPT, Claude, Perplexity and Gemini
 * on every weekly check, so the cap is sized to the weekly token budget.
 */
export const MAX_GEO_QUERIES = 7;

/**
 * Cooldown enforced server-side between manual /api/ai-visibility/check runs.
 * The scheduled weekly cron triggers within the same window, so users see a
 * countdown instead of a re-run button until the next cycle.
 */
export const AI_VISIBILITY_LOCK_DAYS = 7;

/**
 * Show the "review your tracked queries" reminder once the saved set has
 * been untouched for this many days. Lower than the lock window would spam
 * users; higher would let stale queries linger across multiple cycles.
 */
export const GEO_QUERIES_STALE_DAYS = 14;

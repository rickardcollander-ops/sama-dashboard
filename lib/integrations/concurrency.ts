/**
 * Run an async mapper over `items` with at most `limit` in flight at once.
 *
 * The cron fan-outs trigger the backend once per site; each call is a quick
 * "kick off async work" round-trip, so firing them strictly sequentially just
 * stacks network latency × N sites. A bounded pool keeps the proxy/backend
 * from being hit all-at-once while still overlapping the waits. Results come
 * back in input order; the mapper is responsible for its own error handling
 * (so one failure doesn't abort the rest).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

import { notFound } from "next/navigation";

// Catch-all under /c so any unmatched URL (e.g. /c/foobar) renders the
// customer-portal not-found.tsx rather than the global Next 404.
export default function CustomerCatchAll() {
  notFound();
}

/** Class, queue and ticket screens stay immediate. Organization shells do not reload on every scan. */
export function realtimeCadence(topic: string): { debounceMs: number; pollMs: number } {
  if (topic.startsWith("school:") || topic.startsWith("business:")) {
    return { debounceMs: 2_000, pollMs: 30_000 };
  }
  return { debounceMs: 180, pollMs: 15_000 };
}

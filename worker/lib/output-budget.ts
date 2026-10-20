export interface BudgetChunk {
  /** The portion of the delta that still fits inside the budget. */
  text: string;
  /** True once the total appended length reaches the configured limit. */
  reachedLimit: boolean;
}

/**
 * Tracks how many answer characters were emitted. A provider delta can be
 * longer than the remaining budget, so callers must send only `text`.
 */
export function createOutputBudget(limit: number): {
  readonly used: number;
  append(delta: string): BudgetChunk;
} {
  const max = Math.max(0, Math.floor(limit));
  let used = 0;

  return {
    get used() {
      return used;
    },
    append(delta: string): BudgetChunk {
      const text = delta.slice(0, Math.max(0, max - used));
      used += text.length;
      return { text, reachedLimit: used >= max };
    },
  };
}

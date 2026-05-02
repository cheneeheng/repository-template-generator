const CHAR_BUDGET = parseInt(process.env.MAX_HISTORY_CHARS ?? '600000', 10);

/**
 * Truncates history to fit within the char budget.
 * Drops oldest assistant turns first (they contain full file trees).
 * If even user turns alone exceed the budget, drops oldest user turns last.
 */
export function truncateHistory(history) {
  let chars = history.reduce((sum, m) => sum + m.content.length, 0);
  if (chars <= CHAR_BUDGET) return history;

  const result = [...history];

  for (let i = 0; i < result.length && chars > CHAR_BUDGET; ) {
    if (result[i].role === 'assistant') {
      chars -= result[i].content.length;
      result.splice(i, 1);
    } else {
      i++;
    }
  }

  while (result.length > 0 && chars > CHAR_BUDGET) {
    chars -= result[0].content.length;
    result.shift();
  }

  return result;
}

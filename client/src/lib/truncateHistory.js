const CHAR_BUDGET = 600_000;

export function truncateHistory(history, budget = CHAR_BUDGET) {
  let chars = history.reduce((sum, m) => sum + m.content.length, 0);
  if (chars <= budget) return history;

  const result = [...history];

  for (let i = 0; i < result.length && chars > budget; ) {
    if (result[i].role === 'assistant') {
      chars -= result[i].content.length;
      result.splice(i, 1);
    } else {
      i++;
    }
  }

  while (result.length > 0 && chars > budget) {
    chars -= result[0].content.length;
    result.shift();
  }

  return result;
}

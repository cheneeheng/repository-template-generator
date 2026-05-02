const CHAR_BUDGET = 600_000;

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

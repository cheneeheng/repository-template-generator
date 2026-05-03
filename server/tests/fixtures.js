export const makeFile = (path, content = `content of ${path}`) => ({ path, content });

export const makeFileTree = (count = 3) =>
  Array.from({ length: count }, (_, i) => makeFile(`file${i}.js`));

export const makeHistory = (turns = 2) =>
  Array.from({ length: turns * 2 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `turn ${Math.floor(i / 2)} ${ i % 2 === 0 ? 'instruction' : JSON.stringify(makeFileTree(2)) }`,
  }));

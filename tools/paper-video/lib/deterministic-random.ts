export const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

export const shuffleWithSeed = <T,>(items: T[], seed: number) => {
  const random = createSeededRandom(seed);
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

export const pickOneWithSeed = <T,>(items: T[], seed: number) => {
  if (items.length === 0) {
    return undefined;
  }

  const random = createSeededRandom(seed);
  return items[Math.floor(random() * items.length)];
};

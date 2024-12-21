export const arrayMissingValue = (haystack: string[], needles: string[]): string => {
  const haystackSet = new Set(haystack);
  for (const needle of needles) {
    if (!haystackSet.has(needle)) {
      return needle;
    }
  }
  return "";
};

export const arraySortDescending = (a: string, b: string) => (a > b ? -1 : b > a ? 1 : 0);

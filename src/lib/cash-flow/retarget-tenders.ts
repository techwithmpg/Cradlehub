/** Retain methods/references/physical cash while retargeting the amount to collect. */
export function retargetDiscountTenders<T extends { amount: string }>(
  lines: T[],
  previousBalance: number,
  nextBalance: number
): T[] {
  const previous = lines.reduce((sum, line) => sum + Math.round(Number(line.amount) * 100 || 0), 0);
  let remaining =
    previous === Math.round(previousBalance * 100)
      ? Math.round(nextBalance * 100)
      : Math.min(previous, Math.round(nextBalance * 100));
  return lines.flatMap((line, index) => {
    const amount =
      index === lines.length - 1
        ? remaining
        : Math.min(remaining, Math.max(0, Math.round(Number(line.amount) * 100 || 0)));
    remaining -= amount;
    return amount > 0 ? [{ ...line, amount: (amount / 100).toFixed(2) }] : [];
  });
}

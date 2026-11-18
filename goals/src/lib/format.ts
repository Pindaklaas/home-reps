/** Spanish number with thousands separator even for 4 digits (5.000, not 5000). */
export function formatNumber(n: number, maxDecimals = 0): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: maxDecimals, useGrouping: "always" }).format(n);
}

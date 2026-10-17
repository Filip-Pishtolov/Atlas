const EUR = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const EUR_PRECISE = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(cents: number): string {
  return EUR.format(Math.round(cents) / 100);
}

export function formatMoneyPrecise(cents: number): string {
  return EUR_PRECISE.format(Math.round(cents) / 100);
}

export function parseEurosToCents(input: string | number): number | null {
  const raw = String(input).trim().replace(/[€\s,]/g, '');
  if (raw === '' || !/^-?\d+(\.\d{1,2})?$/.test(raw)) return null;
  return Math.round(parseFloat(raw) * 100);
}

export function centsToEuroInput(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

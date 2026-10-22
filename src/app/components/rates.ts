// ─── showing a price per unit ────────────────────────────────────────────────
//
// Ingestion was priced at $2.76 per GB and printed with two decimals, which is
// right until a cheap log plan arrives at $0.001 per GB. Then two decimals say
// "$0.00", and that is not a rounding artefact — it is a different claim. It
// tells the reader the data is free. Worse, $0.0010 and $0.0005 both print as
// $0.00, so two rates that differ by half look identical.
//
// The instinct is to add decimals. That is the wrong fix: "$2.7600 per GB"
// taxes every common row to accommodate a rare one, and a column of numbers
// with four decimals is no longer scannable.
//
// The real problem is the unit, not the precision. A rate is a number *and* a
// denominator, and "per GB" is simply the wrong denominator for a price this
// small — nobody buys one gigabyte. Rescale the denominator and the number
// comes back into human range with no loss and no extra digits:
//
//     $0.001 per GB   →   $1.00 per TB
//     $0.075 per GB   →   $75.00 per TB
//     $2.76  per GB   →   $2.76 per GB      (already fine, left alone)
//
// So: pick the unit that lets two decimals carry the value, and never let a
// price that is not zero print as zero.
//
// Billing units here are decimal — 1 TB is 1,000 GB, the way an invoice counts
// it, not 1,024.

export type RateUnit = 'GB' | 'TB' | 'PB';

const SCALE: { per: RateUnit; gb: number }[] = [
  { per: 'GB', gb: 1 },
  { per: 'TB', gb: 1_000 },
  { per: 'PB', gb: 1_000_000 },
];

/**
 * Below this, two decimals stop carrying the number: 0.075 would print as
 * "0.08" and lose a figure, 0.001 would print as "0.00" and lose the lot. Ten
 * cents is the point where two decimals still hold two significant digits.
 */
const READABLE = 0.1;

/**
 * The unit that suits these rates. Given several — a column, a comparison —
 * the smallest one decides, because a column has to share a unit or the
 * numbers in it stop being comparable at a glance.
 */
export function rateUnitFor(perGb: number | number[]): RateUnit {
  const rates = (Array.isArray(perGb) ? perGb : [perGb]).filter(r => r > 0);
  if (rates.length === 0) return 'GB';
  const smallest = Math.min(...rates);
  return (SCALE.find(s => smallest * s.gb >= READABLE) ?? SCALE[SCALE.length - 1]).per;
}

const factor = (unit: RateUnit) => SCALE.find(s => s.per === unit)!.gb;

/**
 * The rate itself, in the given unit — or in whichever unit suits it, if none
 * is given. Free is "Free", not "$0.00": zero is a fact worth stating plainly
 * rather than something to be read off a decimal point.
 */
export function formatRate(perGb: number, unit?: RateUnit, currency = '$'): string {
  if (perGb === 0) return 'Free';
  const u = unit ?? rateUnitFor(perGb);
  const scaled = perGb * factor(u);

  // A rate too small even for petabytes has no sensible denominator left, so
  // it falls back to significant figures rather than silently reading as zero.
  const text = scaled < 0.01
    ? scaled.toPrecision(2)
    : scaled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `${currency}${text} / ${u}`;
}

/** Just the number, for a cell whose column header already carries the unit. */
export function formatRateValue(perGb: number, unit: RateUnit, currency = '$'): string {
  if (perGb === 0) return 'Free';
  const scaled = perGb * factor(unit);
  return currency + (scaled < 0.01
    ? scaled.toPrecision(2)
    : scaled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

/**
 * The untouched figure, for a tooltip. Whatever the display rounds to, the
 * exact rate is one hover away — a price nobody can check is a price nobody
 * trusts.
 */
export function exactRate(perGb: number, currency = '$'): string {
  if (perGb === 0) return 'Not billed';
  const digits = Math.max(2, -Math.floor(Math.log10(perGb)) + 1);
  return `${currency}${perGb.toFixed(Math.min(digits, 10))} per GB, as billed`;
}

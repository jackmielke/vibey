// Minimal cron next-run calculator. Supports the 5-field cron we use:
//   minute hour day-of-month month day-of-week
// Each field: "*", "N", "*/N", "A,B,C", or "A-B".
// Good enough for the SCHEDULE_PRESETS in Scheduled Heartbeat.

type Field = number[]; // sorted, unique allowed values

function expandField(expr: string, min: number, max: number): Field {
  const out = new Set<number>();
  for (const part of expr.split(",")) {
    const stepMatch = part.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/);
    let lo = min, hi = max, step = 1;
    if (stepMatch) {
      step = parseInt(stepMatch[2], 10);
      const base = stepMatch[1];
      if (base !== "*") {
        const [a, b] = base.split("-").map((n) => parseInt(n, 10));
        lo = a; hi = isNaN(b) ? max : b;
      }
    } else if (part === "*") {
      // full range, step 1
    } else if (part.includes("-")) {
      const [a, b] = part.split("-").map((n) => parseInt(n, 10));
      lo = a; hi = b;
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) { lo = n; hi = n; }
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return [...out].filter((v) => v >= min && v <= max).sort((a, b) => a - b);
}

export function nextCronRun(cron: string, from: Date = new Date()): Date | null {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  let mins: Field, hours: Field, doms: Field, months: Field, dows: Field;
  try {
    mins = expandField(parts[0], 0, 59);
    hours = expandField(parts[1], 0, 23);
    doms = expandField(parts[2], 1, 31);
    months = expandField(parts[3], 1, 12);
    dows = expandField(parts[4], 0, 6);
  } catch {
    return null;
  }
  if (!mins.length || !hours.length || !doms.length || !months.length || !dows.length) return null;

  // Cron is interpreted in UTC (matches pg_cron default).
  const d = new Date(Date.UTC(
    from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(),
    from.getUTCHours(), from.getUTCMinutes() + 1, 0, 0,
  ));

  for (let i = 0; i < 366 * 24 * 60; i++) {
    const M = d.getUTCMonth() + 1;
    const D = d.getUTCDate();
    const W = d.getUTCDay();
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (months.includes(M) && doms.includes(D) && dows.includes(W) && hours.includes(h) && mins.includes(m)) {
      return new Date(d);
    }
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }
  return null;
}

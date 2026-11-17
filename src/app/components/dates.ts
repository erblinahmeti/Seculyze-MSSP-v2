// Exact timestamps for tables and panels: "17 Nov 2026, 08:29" (24-hour,
// day first, like the audit log). Anything that isn't a parseable date —
// e.g. older mock data that still says "1h ago" — is shown as it is.
export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date}, ${time}`;
}

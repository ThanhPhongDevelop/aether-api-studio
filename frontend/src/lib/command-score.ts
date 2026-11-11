/** All query terms must match; label prefixes rank highest. */
export function scoreCommand(command: { label: string; keywords?: string; detail?: string }, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const label = command.label.toLowerCase();
  const haystack = `${label} ${command.keywords ?? ''} ${command.detail ?? ''}`.toLowerCase();
  let total = 0;
  for (const term of terms) {
    if (label.startsWith(term)) total += 3;
    else if (label.split(/\s+/).some((word) => word.startsWith(term))) total += 2.5;
    else if (label.includes(term)) total += 2;
    else if (haystack.includes(term)) total += 1;
    else return 0;
  }
  return total;
}

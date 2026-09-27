/**
 * Locates a cited passage inside page text, ignoring case and whitespace runs.
 * Falls back to progressively shorter prefixes, because evidence may have been trimmed
 * before it was attached. Offsets index into the whitespace-normalised text.
 */
export function normalise(text: string): string {
  return text.replace(/\s+/g, " ");
}

export function findRange(text: string, needle: string): [number, number] | null {
  const hay = normalise(text).toLowerCase();
  const n = normalise(needle.trim()).toLowerCase();
  for (const len of [n.length, 200, 120, 60, 30]) {
    const frag = n.slice(0, len);
    if (frag.length < 12) break;
    const idx = hay.indexOf(frag);
    if (idx >= 0) return [idx, idx + frag.length];
  }
  return null;
}

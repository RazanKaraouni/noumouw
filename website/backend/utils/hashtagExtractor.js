/**
 * Extract hashtags from post body text (#word, letters/numbers/underscore).
 * Returns lowercase unique tags without the leading #.
 */
export function extractHashtags(text) {
  const body = String(text || '');
  if (!body.trim()) return [];

  const matches = body.match(/#([\p{L}\p{N}_]+)/gu) || [];
  const seen = new Set();
  const tags = [];

  for (const match of matches) {
    const tag = match.slice(1).toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

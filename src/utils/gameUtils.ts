/**
 * Replaces each word in a game title with an underscore,
 * preserving punctuation and spacing as hints.
 * e.g. "Hollow Knight: Silksong" → "_ _: _"
 */
export function getTitlePlaceholder(name: string): string {
  if (!name) return ''
  const tokens = name.trim().split(/(\s+|[:.,!?;])/)
  return tokens
    .map((token) => (/\w+/.test(token) ? '_' : token))
    .join('')
    .replace(/\s+/g, ' ')
}

/**
 * Returns a sequential grid number based on days since the game launched (2025-01-01 = Grid #1).
 */
export function getGridNumber(dateStr: string): number {
  const start = new Date('2025-01-01')
  const current = new Date(dateStr)
  const diff = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff + 1
}

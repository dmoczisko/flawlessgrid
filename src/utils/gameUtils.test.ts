import { describe, it, expect } from 'vitest'
import { getTitlePlaceholder, getGridNumber } from './gameUtils'

describe('getTitlePlaceholder', () => {
  it('replaces each word with an underscore', () => {
    expect(getTitlePlaceholder('Portal 2')).toBe('_ _')
  })

  it('preserves colons and spacing around punctuation', () => {
    expect(getTitlePlaceholder('The Legend of Zelda: Breath of the Wild')).toBe(
      '_ _ _ _: _ _ _ _',
    )
  })

  it('handles a single word', () => {
    expect(getTitlePlaceholder('Hades')).toBe('_')
  })

  it('preserves other punctuation', () => {
    expect(getTitlePlaceholder('Hollow Knight: Silksong')).toBe('_ _: _')
  })

  it('returns empty string for empty input', () => {
    expect(getTitlePlaceholder('')).toBe('')
  })
})

describe('getGridNumber', () => {
  it('returns 1 for the launch date (2025-01-01)', () => {
    expect(getGridNumber('2025-01-01')).toBe(1)
  })

  it('returns 2 for the day after launch', () => {
    expect(getGridNumber('2025-01-02')).toBe(2)
  })

  it('increments correctly across months', () => {
    expect(getGridNumber('2025-02-01')).toBe(32) // 31 days in Jan + 1
  })
})

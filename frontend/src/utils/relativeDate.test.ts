import { describe, expect, it, vi, afterEach } from 'vitest'
import { relativeDate } from './relativeDate'

const NOW = new Date('2026-05-10T12:00:00Z').getTime()

function isoAgo(ms: number) {
  return new Date(NOW - ms).toISOString()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('relativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('returns "Just now" for < 60 seconds ago', () => {
    expect(relativeDate(isoAgo(30_000))).toBe('Just now')
  })

  it('returns "1 minute ago" for exactly 60 seconds ago', () => {
    expect(relativeDate(isoAgo(60_000))).toBe('1 minute ago')
  })

  it('returns "5 minutes ago" for 5 minutes ago', () => {
    expect(relativeDate(isoAgo(5 * 60_000))).toBe('5 minutes ago')
  })

  it('returns "1 hour ago" for exactly 60 minutes ago', () => {
    expect(relativeDate(isoAgo(60 * 60_000))).toBe('1 hour ago')
  })

  it('returns "3 hours ago" for 3 hours ago', () => {
    expect(relativeDate(isoAgo(3 * 60 * 60_000))).toBe('3 hours ago')
  })

  it('returns "1 day ago" for exactly 24 hours ago', () => {
    expect(relativeDate(isoAgo(24 * 60 * 60_000))).toBe('1 day ago')
  })

  it('returns "6 days ago" for 6 days ago', () => {
    expect(relativeDate(isoAgo(6 * 24 * 60 * 60_000))).toBe('6 days ago')
  })

  it('returns a formatted date for 7+ days ago', () => {
    const result = relativeDate(isoAgo(7 * 24 * 60 * 60_000))
    expect(result).toMatch(/\d+/)
  })
})

import { describe, it, expect } from 'vitest'
import { parseIsoDuration } from '../../../src/lib/channels/youtube-api.ts'

describe('parseIsoDuration', () => {
  // --- Basic single-component durations ---

  it('parses hours only: PT1H -> 3600', () => {
    expect(parseIsoDuration('PT1H')).toBe(3600)
  })

  it('parses minutes only: PT4M -> 240', () => {
    expect(parseIsoDuration('PT4M')).toBe(240)
  })

  it('parses seconds only: PT30S -> 30', () => {
    expect(parseIsoDuration('PT30S')).toBe(30)
  })

  it('parses zero seconds: PT0S -> 0', () => {
    expect(parseIsoDuration('PT0S')).toBe(0)
  })

  // --- Combined durations ---

  it('parses minutes and seconds: PT4M13S -> 253', () => {
    expect(parseIsoDuration('PT4M13S')).toBe(253)
  })

  it('parses hours and minutes: PT1H30M -> 5400', () => {
    expect(parseIsoDuration('PT1H30M')).toBe(5400)
  })

  it('parses hours, minutes, and seconds: PT2H15M45S -> 8145', () => {
    expect(parseIsoDuration('PT2H15M45S')).toBe(8145)
  })

  // --- Days component ---

  it('parses days only: P1D -> 86400', () => {
    expect(parseIsoDuration('P1D')).toBe(86400)
  })

  it('parses days and time: P1DT2H3M4S -> 93784', () => {
    expect(parseIsoDuration('P1DT2H3M4S')).toBe(93784)
  })

  it('parses multiple days: P3D -> 259200', () => {
    expect(parseIsoDuration('P3D')).toBe(259200)
  })

  // --- Weeks component ---

  it('parses weeks only: P1W -> 604800', () => {
    expect(parseIsoDuration('P1W')).toBe(604800)
  })

  it('parses weeks with time: P2WT3H -> 1219200 + 10800 = 1230000', () => {
    expect(parseIsoDuration('P2WT3H')).toBe(2 * 7 * 86400 + 3 * 3600)
  })

  // --- Boundary and large values ---

  it('parses a long video: PT1H59M59S -> 7199', () => {
    expect(parseIsoDuration('PT1H59M59S')).toBe(7199)
  })

  it('parses many hours: PT100H -> 360000', () => {
    expect(parseIsoDuration('PT100H')).toBe(360000)
  })

  it('parses large days + full time: P10DT23H59M59S', () => {
    const expected = 10 * 86400 + 23 * 3600 + 59 * 60 + 59
    expect(parseIsoDuration('P10DT23H59M59S')).toBe(expected)
  })

  // --- Fractional seconds (YouTube sometimes emits these) ---

  it('rounds fractional seconds: PT1.5S -> 2', () => {
    expect(parseIsoDuration('PT1.5S')).toBe(2)
  })

  it('rounds fractional seconds down: PT1.4S -> 1', () => {
    expect(parseIsoDuration('PT1.4S')).toBe(1)
  })

  // --- Invalid inputs ---

  it('throws on completely invalid string', () => {
    expect(() => parseIsoDuration('not-a-duration')).toThrow(
      'Invalid ISO 8601 duration: "not-a-duration"',
    )
  })

  it('throws on empty string', () => {
    expect(() => parseIsoDuration('')).toThrow('Invalid ISO 8601 duration: ""')
  })

  it('throws on duration missing P prefix', () => {
    expect(() => parseIsoDuration('T1H')).toThrow('Invalid ISO 8601 duration')
  })

  it('throws on duration with invalid characters', () => {
    expect(() => parseIsoDuration('P1X')).toThrow('Invalid ISO 8601 duration')
  })

  // --- Edge: bare P with no components (technically valid ISO 8601 = 0) ---
  it('parses bare P (no components) as 0', () => {
    expect(parseIsoDuration('P')).toBe(0)
  })
})

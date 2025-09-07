import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, getAmountColorClass } from './format'

describe('formatCurrency', () => {
  it('should format a positive number correctly', () => {
    expect(formatCurrency(1234.56)).toBe('1.234,56 €')
  })

  it('should format a negative number correctly', () => {
    expect(formatCurrency(-1234.56)).toBe('-1.234,56 €')
  })

  it('should format a number with no decimals correctly', () => {
    expect(formatCurrency(1000)).toBe('1.000,00 €')
  })

  it('should format a number less than 1000 correctly', () => {
    expect(formatCurrency(123.45)).toBe('123,45 €')
  })

  it('should handle zero correctly', () => {
    expect(formatCurrency(0)).toBe('0,00 €')
  })

  it('should use a different currency symbol', () => {
    expect(formatCurrency(1234.56, '$')).toBe('1.234,56 $')
  })
})

describe('formatDate', () => {
  it('should format a date string correctly', () => {
    // Note: The result depends on the testing environment's timezone.
    // This test assumes a UTC or similar environment.
    // If running in a different timezone, this might need adjustment.
    expect(formatDate('2023-10-26T10:00:00.000Z')).toBe('26/10/2023')
  })
})

describe('getAmountColorClass', () => {
  it('should return green for positive amounts', () => {
    expect(getAmountColorClass(100)).toContain('text-green-600')
  })

  it('should return red for negative amounts', () => {
    expect(getAmountColorClass(-100)).toContain('text-red-600')
  })

  it('should return red for zero', () => {
    expect(getAmountColorClass(0)).toContain('text-red-600')
  })
})

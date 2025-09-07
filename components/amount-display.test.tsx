import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AmountDisplay } from './amount-display'

describe('AmountDisplay', () => {
  it('renders the formatted amount for a positive number', () => {
    render(<AmountDisplay amount={1234.56} />)
    expect(screen.getByText('1.234,56 €')).toBeInTheDocument()
  })

  it('renders the formatted amount for a negative number', () => {
    render(<AmountDisplay amount={-1234.56} />)
    expect(screen.getByText('-1.234,56 €')).toBeInTheDocument()
  })

  it('renders the formatted amount for zero', () => {
    render(<AmountDisplay amount={0} />)
    expect(screen.getByText('0,00 €')).toBeInTheDocument()
  })

  it('renders with different sizes', () => {
    const { rerender } = render(<AmountDisplay amount={100} size="sm" />)
    expect(screen.getByText('100,00 €')).toBeInTheDocument()

    rerender(<AmountDisplay amount={100} size="lg" />)
    expect(screen.getByText('100,00 €')).toBeInTheDocument()
  })
})

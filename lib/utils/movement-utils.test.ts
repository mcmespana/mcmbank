import { describe, it, expect } from 'vitest'
import { enrichMovementsWithData, getAccountDisplayName, getAccountIcon } from './movement-utils'
import type { Movimiento, Cuenta, Categoria } from '@/lib/types/database'

describe('enrichMovementsWithData', () => {
  const movements: Movimiento[] = [
    { id: 'm1', cuenta_id: 'c1', categoria_id: 'cat1', fecha: '2023-01-01', concepto: 'Mov 1', importe: 100, delegacion_id: 'd1', creado_en: '', ignorado: false },
    { id: 'm2', cuenta_id: 'c2', categoria_id: 'cat2', fecha: '2023-01-02', concepto: 'Mov 2', importe: 200, delegacion_id: 'd1', creado_en: '', ignorado: false },
  ]
  const accounts: Cuenta[] = [
    { id: 'c1', nombre: 'Cuenta 1', tipo: 'banco', delegacion_id: 'd1', creado_en: '' },
    { id: 'c2', nombre: 'Cuenta 2', tipo: 'caja', delegacion_id: 'd1', creado_en: '' },
  ]
  const categories: Categoria[] = [
    { id: 'cat1', nombre: 'Cat 1', tipo: 'ingreso', delegacion_id: 'd1', creado_en: '' },
    { id: 'cat2', nombre: 'Cat 2', tipo: 'gasto', delegacion_id: 'd1', creado_en: '' },
  ]

  it('should enrich movements with account and category data', () => {
    const enriched = enrichMovementsWithData(movements, accounts, categories)
    expect(enriched[0].cuenta).toEqual(accounts[0])
    expect(enriched[0].categoria).toEqual(categories[0])
    expect(enriched[1].cuenta).toEqual(accounts[1])
    expect(enriched[1].categoria).toEqual(categories[1])
  })

  it('should handle missing account or category', () => {
    const movementsWithMissing = [
      { id: 'm3', cuenta_id: 'c99', categoria_id: 'cat99', fecha: '2023-01-03', concepto: 'Mov 3', importe: 300, delegacion_id: 'd1', creado_en: '', ignorado: false },
    ]
    const enriched = enrichMovementsWithData(movementsWithMissing, accounts, categories)
    expect(enriched[0].cuenta).toBeUndefined()
    expect(enriched[0].categoria).toBeUndefined()
  })
})

describe('getAccountDisplayName', () => {
  it('should return just the name for cash accounts', () => {
    const cuenta: Cuenta = { id: 'c1', nombre: 'Caja General', tipo: 'caja', delegacion_id: 'd1', creado_en: '' }
    expect(getAccountDisplayName(cuenta)).toBe('Caja General')
  })

  it('should return bank and name for bank accounts', () => {
    const cuenta: Cuenta = { id: 'c2', nombre: 'Cuenta Corriente', tipo: 'banco', banco_nombre: 'Banco Ficticio', delegacion_id: 'd1', creado_en: '' }
    expect(getAccountDisplayName(cuenta)).toBe('Banco Ficticio - Cuenta Corriente')
  })

  it('should handle bank accounts without a bank name', () => {
    const cuenta: Cuenta = { id: 'c3', nombre: 'Cuenta Sin Banco', tipo: 'banco', delegacion_id: 'd1', creado_en: '' }
    expect(getAccountDisplayName(cuenta)).toBe('Cuenta Sin Banco')
  })
})

describe('getAccountIcon', () => {
  it('should return a bank icon for bank accounts', () => {
    const cuenta: Cuenta = { id: 'c1', nombre: 'Cuenta Banco', tipo: 'banco', delegacion_id: 'd1', creado_en: '' }
    expect(getAccountIcon(cuenta)).toBe('🏦')
  })

  it('should return a cash icon for cash accounts', () => {
    const cuenta: Cuenta = { id: 'c2', nombre: 'Caja', tipo: 'caja', delegacion_id: 'd1', creado_en: '' }
    expect(getAccountIcon(cuenta)).toBe('💵')
  })
})

/**
 * Script para debuggear el filtrado de delegaciones
 * Verifica que las transacciones mostradas correspondan solo a la delegación seleccionada
 */

// Para usar en la consola del navegador
function debugDelegationFilter() {
  console.log('🔍 Debugging delegation filter...')
  
  // Buscar elementos en el DOM
  const delegationSelector = document.querySelector('[data-testid="delegation-selector"]') ||
                           document.querySelector('button[role="combobox"]')
  
  const transactionRows = document.querySelectorAll('[data-testid="transaction-row"]') ||
                         document.querySelectorAll('tbody tr')
  
  console.log('🏢 Delegation selector found:', !!delegationSelector)
  console.log('📊 Transaction rows found:', transactionRows.length)
  
  if (delegationSelector) {
    const selectedDelegation = delegationSelector.textContent
    console.log('📍 Selected delegation:', selectedDelegation)
  }
  
  // Analizar las transacciones visibles
  const visibleTransactions = []
  transactionRows.forEach((row, index) => {
    const cells = row.querySelectorAll('td')
    if (cells.length > 0) {
      // Buscar información de la cuenta (puede estar en diferentes columnas)
      const accountInfo = Array.from(cells).find(cell => 
        cell.textContent.includes('Cuenta') || 
        cell.querySelector('[data-testid="account-info"]')
      )
      
      visibleTransactions.push({
        index,
        accountInfo: accountInfo?.textContent || 'No encontrada',
        allCells: Array.from(cells).map(c => c.textContent.slice(0, 50))
      })
    }
  })
  
  console.log('🔍 Visible transactions:', visibleTransactions.slice(0, 5))
  
  // Verificar en el store/context si hay acceso
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    console.log('⚛️ React internals available for deeper inspection')
  }
  
  return {
    delegationSelector: !!delegationSelector,
    transactionCount: transactionRows.length,
    visibleTransactions: visibleTransactions.slice(0, 3)
  }
}

// Para usar en Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { debugDelegationFilter }
}

console.log('🛠️ Debug script loaded. Run debugDelegationFilter() in console to inspect delegation filtering.')

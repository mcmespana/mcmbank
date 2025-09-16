export const isDebugEnabled: boolean =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true'

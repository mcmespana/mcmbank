const debugEnabled = process.env.NEXT_PUBLIC_DEBUG === 'true'

if (!debugEnabled) {
  console.log = () => {}
  console.debug = () => {}
}

export { debugEnabled }
export function debugLog(...args: unknown[]) {
  if (debugEnabled) {
    console.log(...args)
  }
}

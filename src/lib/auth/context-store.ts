import { AsyncLocalStorage } from 'async_hooks'
import type { AuthContext } from './types'

export const authContextStore = new AsyncLocalStorage<AuthContext>()

export function getAuthContext(): AuthContext {
  const ctx = authContextStore.getStore()
  if (!ctx) {
    throw new Error('AuthContext not available. Call buildAuthContext() first.')
  }
  return ctx
}



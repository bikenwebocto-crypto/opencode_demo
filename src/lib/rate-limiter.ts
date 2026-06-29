// Rate limiting service for voucher verification
// Uses in-memory storage with automatic cleanup

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitStore {
  [key: string]: RateLimitEntry
}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute
}

class RateLimiter {
  private stores: {
    user: RateLimitStore
    ip: RateLimitStore
    device: RateLimitStore
  } = {
    user: {},
    ip: {},
    device: {},
  }

  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  /**
   * Check if a request is rate limited
   * @returns true if rate limited, false if allowed
   */
  isRateLimited(
    identifier: string,
    type: 'user' | 'ip' | 'device',
    config: RateLimitConfig = DEFAULT_CONFIG
  ): boolean {
    const store = this.stores[type]
    const now = Date.now()
    const entry = store[identifier]

    if (!entry || now > entry.resetAt) {
      // Create new entry or reset expired one
      store[identifier] = {
        count: 1,
        resetAt: now + config.windowMs,
      }
      return false
    }

    // Increment count
    entry.count++

    // Check if over limit
    return entry.count > config.maxRequests
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemainingRequests(
    identifier: string,
    type: 'user' | 'ip' | 'device',
    config: RateLimitConfig = DEFAULT_CONFIG
  ): number {
    const store = this.stores[type]
    const now = Date.now()
    const entry = store[identifier]

    if (!entry || now > entry.resetAt) {
      return config.maxRequests
    }

    return Math.max(0, config.maxRequests - entry.count)
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  getResetTime(
    identifier: string,
    type: 'user' | 'ip' | 'device'
  ): number {
    const store = this.stores[type]
    const now = Date.now()
    const entry = store[identifier]

    if (!entry || now > entry.resetAt) {
      return 0
    }

    return entry.resetAt - now
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string, type: 'user' | 'ip' | 'device'): void {
    delete this.stores[type][identifier]
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()

    for (const type of ['user', 'ip', 'device'] as const) {
      const store = this.stores[type]
      for (const key in store) {
        const entry = store[key]
        if (entry && now > entry.resetAt) {
          delete store[key]
        }
      }
    }
  }

  /**
   * Stop the cleanup interval (for testing/shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Clear all rate limits (for testing)
   */
  clear(): void {
    this.stores = {
      user: {},
      ip: {},
      device: {},
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()

/**
 * Check rate limits for voucher verification
 * Checks user, IP, and device limits
 */
export function checkVoucherRateLimits(
  userId: string,
  ipAddress?: string,
  deviceId?: string
): {
  limited: boolean
  type?: 'user' | 'ip' | 'device'
  remaining?: number
  resetMs?: number
} {
  const userConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute per user
  }

  const ipConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute per IP
  }

  const deviceConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 15, // 15 requests per minute per device
  }

  // Check user limit
  if (rateLimiter.isRateLimited(userId, 'user', userConfig)) {
    return {
      limited: true,
      type: 'user',
      remaining: 0,
      resetMs: rateLimiter.getResetTime(userId, 'user'),
    }
  }

  // Check IP limit
  if (ipAddress && rateLimiter.isRateLimited(ipAddress, 'ip', ipConfig)) {
    return {
      limited: true,
      type: 'ip',
      remaining: 0,
      resetMs: rateLimiter.getResetTime(ipAddress, 'ip'),
    }
  }

  // Check device limit
  if (deviceId && rateLimiter.isRateLimited(deviceId, 'device', deviceConfig)) {
    return {
      limited: true,
      type: 'device',
      remaining: 0,
      resetMs: rateLimiter.getResetTime(deviceId, 'device'),
    }
  }

  return {
    limited: false,
    remaining: rateLimiter.getRemainingRequests(userId, 'user', userConfig),
  }
}

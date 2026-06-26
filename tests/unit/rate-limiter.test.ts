// Unit tests for rate limiter service

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimiter, checkVoucherRateLimits } from '@/lib/rate-limiter'

describe('Rate Limiter Service', () => {
  beforeEach(() => {
    rateLimiter.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rateLimiter', () => {
    it('should allow requests within limit', () => {
      const config = { windowMs: 60000, maxRequests: 5 }

      const result1 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result1).toBe(false)

      const result2 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result2).toBe(false)

      const result3 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result3).toBe(false)
    })

    it('should block requests exceeding limit', () => {
      const config = { windowMs: 60000, maxRequests: 3 }

      rateLimiter.isRateLimited('user-123', 'user', config)
      rateLimiter.isRateLimited('user-123', 'user', config)
      rateLimiter.isRateLimited('user-123', 'user', config)

      const result4 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result4).toBe(true)
    })

    it('should reset after window expires', () => {
      const config = { windowMs: 60000, maxRequests: 2 }

      rateLimiter.isRateLimited('user-123', 'user', config)
      rateLimiter.isRateLimited('user-123', 'user', config)

      const result3 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result3).toBe(true)

      // Advance time past the window
      vi.advanceTimersByTime(61000)

      const result4 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result4).toBe(false)
    })

    it('should track different identifiers separately', () => {
      const config = { windowMs: 60000, maxRequests: 2 }

      rateLimiter.isRateLimited('user-123', 'user', config)
      rateLimiter.isRateLimited('user-123', 'user', config)

      const result1 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result1).toBe(true)

      const result2 = rateLimiter.isRateLimited('user-456', 'user', config)
      expect(result2).toBe(false)
    })

    it('should track different types separately', () => {
      const config = { windowMs: 60000, maxRequests: 2 }

      rateLimiter.isRateLimited('id-123', 'user', config)
      rateLimiter.isRateLimited('id-123', 'user', config)

      const userResult = rateLimiter.isRateLimited('id-123', 'user', config)
      expect(userResult).toBe(true)

      const ipResult = rateLimiter.isRateLimited('id-123', 'ip', config)
      expect(ipResult).toBe(false)
    })

    it('should return remaining requests', () => {
      const config = { windowMs: 60000, maxRequests: 5 }

      rateLimiter.isRateLimited('user-123', 'user', config)
      rateLimiter.isRateLimited('user-123', 'user', config)

      const remaining = rateLimiter.getRemainingRequests('user-123', 'user', config)
      expect(remaining).toBe(3)
    })

    it('should return reset time', () => {
      const config = { windowMs: 60000, maxRequests: 5 }

      rateLimiter.isRateLimited('user-123', 'user', config)

      const resetTime = rateLimiter.getResetTime('user-123', 'user')
      expect(resetTime).toBeGreaterThan(0)
      expect(resetTime).toBeLessThanOrEqual(60000)
    })

    it('should reset specific identifier', () => {
      const config = { windowMs: 60000, maxRequests: 2 }

      rateLimiter.isRateLimited('user-123', 'user', config)
      rateLimiter.isRateLimited('user-123', 'user', config)

      const result1 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result1).toBe(true)

      rateLimiter.reset('user-123', 'user')

      const result2 = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(result2).toBe(false)
    })

    it('should clear all rate limits', () => {
      const config = { windowMs: 60000, maxRequests: 2 }

      rateLimiter.isRateLimited('user-123', 'user', config)
      rateLimiter.isRateLimited('user-123', 'user', config)
      rateLimiter.isRateLimited('ip-456', 'ip', config)
      rateLimiter.isRateLimited('ip-456', 'ip', config)

      rateLimiter.clear()

      const userResult = rateLimiter.isRateLimited('user-123', 'user', config)
      expect(userResult).toBe(false)

      const ipResult = rateLimiter.isRateLimited('ip-456', 'ip', config)
      expect(ipResult).toBe(false)
    })
  })

  describe('checkVoucherRateLimits', () => {
    it('should allow requests within all limits', () => {
      const result = checkVoucherRateLimits('user-123', '192.168.1.1', 'device-123')

      expect(result.limited).toBe(false)
      expect(result.remaining).toBeGreaterThan(0)
    })

    it('should block when user limit exceeded', () => {
      // User limit is 10 per minute
      for (let i = 0; i < 11; i++) {
        checkVoucherRateLimits('user-123', '192.168.1.1', 'device-123')
      }

      const result = checkVoucherRateLimits('user-123', '192.168.1.1', 'device-123')

      expect(result.limited).toBe(true)
      expect(result.type).toBe('user')
      expect(result.remaining).toBe(0)
      expect(result.resetMs).toBeGreaterThan(0)
    })

    it('should block when IP limit exceeded', () => {
      // IP limit is 30 per minute
      for (let i = 0; i < 31; i++) {
        checkVoucherRateLimits(`user-${i}`, '192.168.1.1', `device-${i}`)
      }

      const result = checkVoucherRateLimits('user-999', '192.168.1.1', 'device-999')

      expect(result.limited).toBe(true)
      expect(result.type).toBe('ip')
    })

    it('should block when device limit exceeded', () => {
      // Device limit is 15 per minute
      for (let i = 0; i < 16; i++) {
        checkVoucherRateLimits(`user-${i}`, `192.168.1.${i}`, 'device-123')
      }

      const result = checkVoucherRateLimits('user-999', '192.168.1.999', 'device-123')

      expect(result.limited).toBe(true)
      expect(result.type).toBe('device')
    })

    it('should not check IP when not provided', () => {
      const result = checkVoucherRateLimits('user-123', undefined, 'device-123')

      expect(result.limited).toBe(false)
    })

    it('should not check device when not provided', () => {
      const result = checkVoucherRateLimits('user-123', '192.168.1.1', undefined)

      expect(result.limited).toBe(false)
    })

    it('should return remaining requests count', () => {
      checkVoucherRateLimits('user-123', '192.168.1.1', 'device-123')
      checkVoucherRateLimits('user-123', '192.168.1.1', 'device-123')

      const result = checkVoucherRateLimits('user-123', '192.168.1.1', 'device-123')

      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(7) // 10 - 3 = 7
    })
  })
})

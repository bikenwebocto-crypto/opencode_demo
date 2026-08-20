import type { AuthContext } from './types'

export class AuthError extends Error {
  code = 'UNAUTHORIZED'
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends Error {
  code = 'FORBIDDEN'
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export function requireRole(ctx: AuthContext, roles: string[]): void {
  if (!roles.includes(ctx.role)) {
    throw new ForbiddenError(`Required role ${roles.join(' or ')}, got ${ctx.role}`)
  }
}

export function requireProfileType(ctx: AuthContext, types: string[]): void {
  if (!types.includes(ctx.profileType)) {
    throw new ForbiddenError(`Required profile ${types.join(' or ')}, got ${ctx.profileType}`)
  }
}

export function requireActive(ctx: AuthContext): void {
  if (!ctx.isActive) {
    throw new AuthError('Account is not active')
  }
  if (ctx.profileStatus && ctx.profileStatus !== 'ACTIVE') {
    throw new ForbiddenError('Profile is not active')
  }
}

export function requireCompany(ctx: AuthContext, companyId: string): void {
  if (ctx.companyId !== companyId) {
    throw new ForbiddenError('Company mismatch')
  }
}

export function requireAdmin(ctx: AuthContext): void {
  requireRole(ctx, ['SUPER_ADMIN'])
}

export function requireMerchant(ctx: AuthContext): void {
  requireRole(ctx, ['MERCHANT'])
}

export function requireEmployee(ctx: AuthContext): void {
  requireRole(ctx, ['EMPLOYEE'])
}

export function requireCompanyAdmin(ctx: AuthContext): void {
  requireRole(ctx, ['COMPANY_ADMIN'])
}

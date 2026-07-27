import type { User } from '@supabase/supabase-js'
import type { Account, Employee, Merchant, CompanyAdmin, AdminUser, Company } from '@prisma/client'

export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MERCHANT' | 'EMPLOYEE'
export type ProfileType = 'ADMIN' | 'COMPANY' | 'MERCHANT' | 'EMPLOYEE'

export type AuthProfile = Employee | Merchant | CompanyAdmin | AdminUser | null

export interface AuthContext {
  user: User
  accessToken: string
  account: Account
  role: Role
  profileType: ProfileType
  profileId: string | null
  profile: AuthProfile
  companyId: string | null
  company: Company | null
  isActive: boolean
  accountStatus: string
  profileStatus: string | null
  companyStatus: string | null
}

export interface AuthResult {
  user: User
  accessToken: string
}

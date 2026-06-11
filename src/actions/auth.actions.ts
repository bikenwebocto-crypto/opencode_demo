'use server'

import { prisma } from '@/lib/prisma'
import { signIn, signOut } from '@/auth'
import bcrypt from 'bcryptjs'
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@/schemas'
import type { LoginResponse, UserType } from '@/types'

export async function loginAction(formData: FormData): Promise<LoginResponse> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    userType: formData.get('userType') as UserType,
  }
  const parsed = loginSchema.parse(raw)

  const user = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase().trim() } })
  if (!user) throw new Error('Invalid credentials')

  const ok = await bcrypt.compare(parsed.password, user.passwordHash)
  if (!ok) throw new Error('Invalid credentials')

  if (user.role.toLowerCase() !== parsed.userType.toLowerCase()) {
    throw new Error('Account type mismatch')
  }

  await signIn('credentials', {
    email: parsed.email,
    password: parsed.password,
    redirect: false,
  })

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      userType: (user.role === 'admin' ? 'admin' : user.role === 'merchant' ? 'merchant' : user.role === 'company_admin' ? 'company_admin' : 'employee') as UserType,
      name: user.fullName,
      isActive: true,
    },
    accessToken: '',
    refreshToken: '',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as unknown as LoginResponse
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false })
}

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get('email') as string,
    userType: formData.get('userType') as UserType,
  }
  const parsed = forgotPasswordSchema.parse(raw)

  const user = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase().trim() } })
  if (!user) return

  const tempPassword = Math.random().toString(36).slice(-10)
  const hash = await bcrypt.hash(tempPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  })

  console.log(`[forgotPassword] Reset password for ${parsed.email} → ${tempPassword}`)
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const raw = {
    token: formData.get('token') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }
  const parsed = resetPasswordSchema.parse(raw)
  console.log(`[resetPassword] Reset with token=${parsed.token} (no-op stub)`)
}

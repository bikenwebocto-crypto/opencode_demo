import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: UserRole
      fullName: string
    } & DefaultSession['user']
  }

  interface User {
    id?: string
    email?: string | null
    role?: UserRole
    fullName?: string
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase()
        const password = String(credentials?.password ?? '')
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          fullName: user.fullName,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.fullName = user.fullName
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) ?? session.user.id
        session.user.role = token.role as UserRole
        session.user.fullName = (token.fullName as string) ?? session.user.name ?? ''
      }
      return session
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const isAuthed = !!auth?.user
      const role = auth?.user?.role

      const PUBLIC_PATHS = ['/login', '/unauthorized', '/api/auth']
      if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true
      if (pathname === '/') return true

      if (!isAuthed) return false

      if (pathname.startsWith('/admin') && role !== 'admin') return false
      if (pathname.startsWith('/merchant') && role !== 'merchant') return false
      if (pathname.startsWith('/company') && role !== 'company_admin') return false
      if (pathname.startsWith('/employee') && role !== 'employee') return false

      return true
    },
  },
})

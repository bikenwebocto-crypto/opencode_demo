'use client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const syncedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const onAuth = useCallback(async () => {
    if (syncedRef.current) return
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) return

    try {
      const res = await fetch('/api/auth/sync-admin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const body = await res.json()

      if (!res.ok) {
        if (body?.error?.code === 'EMAIL_ALREADY_EXISTS') {
          setError('This email is already assigned to another account.')
        } else {
          setError('You are not mapped to any role or account.')
        }
        return
      }

      if (body.redirectTo) {
        router.push(body.redirectTo)
        router.refresh()
      } else {
        router.push('/employee')
        router.refresh()
      }
    } catch {
      setError('Failed to verify your account. Please try again.')
    }
  }, [router])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        onAuth()
      }
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [onAuth])

  return (
    <div style={{ maxWidth: 420, margin: '100px auto' }}>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google', 'github']}
      />
    </div>
  )
}

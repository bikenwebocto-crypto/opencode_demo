'use client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const syncedRef = useRef(false)

  const onAuth = useCallback(async () => {
      if (syncedRef.current) return
      const {
        data: { session },
      } = await supabase.auth.getSession()

      console.log('Session:', session)

      if (!session?.access_token) {
        return
      }
      
      if (session?.access_token) {
      fetch('/api/auth/sync-admin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {})
    }

    router.push('/admin')
    router.refresh()
  }, [router])

  useEffect(() => {
    console.log('Setting up auth state change listener')
    const { data: { subscription }, } = supabase.auth.onAuthStateChange((event) => {
                                            console.log('Auth event:', event)
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
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google', 'github']}
      />
    </div>
  )
}

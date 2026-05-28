'use client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase/client'
import {useEffect} from 'react'
import { useRouter } from 'next/navigation' 

export default function LoginPage() {
const router = useRouter();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event)

      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in:', session)

        try {
          // Send tokens to server API
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
          })

          const result = await response.json()

          console.log('Session API response:', result)

          if (result.success) {
            console.log('Cookies set successfully')
            // redirect after cookies are stored
            router.push('/admin')
          } else {
            console.error('Failed to store session')
          }
        } catch (error) {
          console.error('Session sync error:', error)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])  

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



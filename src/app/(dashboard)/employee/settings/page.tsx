'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmployeeLayout } from '@/components/employee/EmployeeLayout'
import { showToast } from '@/hooks/use-toast'
import { Bell, Lock, Mail, Save } from 'lucide-react'

interface Prefs {
  newOffers: boolean
  offerExpiry: boolean
  redemptionUpdates: boolean
  weeklyDigest: boolean
  marketingEmails: boolean
}

interface PrefsResponse {
  email: string
  preferences: Prefs
}

async function fetchPrefs(): Promise<PrefsResponse> {
  const res = await fetch('/api/employee/settings')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json.data
}

export default function EmployeeSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['employee-settings'], queryFn: fetchPrefs })
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const values: PrefsResponse | null = prefs ? { email: data?.email ?? '', preferences: prefs } : data ?? null

  const save = useMutation({
    mutationFn: async (preferences: Prefs) => {
      const res = await fetch('/api/employee/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to save')
      return json
    },
    onSuccess: () => showToast({ type: 'success', title: 'Preferences saved' }),
    onError: (e: any) => showToast({ type: 'error', title: 'Save failed', description: e?.message }),
  })

  if (isLoading || !values) {
    return (
      <EmployeeLayout>
        <Skeleton className="h-64 w-full" />
      </EmployeeLayout>
    )
  }

  return (
    <EmployeeLayout>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" /> Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Choose what you want to be notified about.
            </p>
            {([
              ['newOffers', 'New offers from merchants'],
              ['offerExpiry', 'Offer expiry reminders'],
              ['redemptionUpdates', 'Redemption status updates'],
              ['weeklyDigest', 'Weekly digest of top offers'],
              ['marketingEmails', 'Marketing emails'],
            ] as [keyof Prefs, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.preferences[key]}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...(p ?? values.preferences), [key]: e.target.checked }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
            <Button onClick={() => save.mutate(values.preferences)} disabled={save.isPending}>
              <Save className="mr-1 h-4 w-4" />
              {save.isPending ? 'Saving…' : 'Save Preferences'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{values.email}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              To change your email, contact your company admin.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" /> Privacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your data is visible to the merchants you redeem offers with. We share your name, email,
              and company only to facilitate redemptions.
            </p>
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  )
}

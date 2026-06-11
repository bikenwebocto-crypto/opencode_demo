'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { showToast } from '@/hooks/use-toast'
import { Lock, Mail, Bell, Shield } from 'lucide-react'

interface Prefs {
  newRedemption: boolean
  offerApproval: boolean
  offerRejection: boolean
  profileChangeRequest: boolean
  issueResponse: boolean
  weeklyReport: boolean
  marketingEmails: boolean
}

interface PrefsResponse {
  email: string
  preferences: Prefs
}

async function fetchPrefs(): Promise<PrefsResponse> {
  const res = await fetch('/api/merchant/settings/notifications')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json.data
}

export default function MerchantSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['merchant-settings-notifications'], queryFn: fetchPrefs })

  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [email, setEmail] = useState({ newEmail: '', password: '' })
  const [emailError, setEmailError] = useState<string | null>(null)

  const current = data
  const values = prefs ?? current?.preferences ?? null

  const savePrefs = useMutation({
    mutationFn: async (preferences: Prefs) => {
      const res = await fetch('/api/merchant/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to save')
      return json
    },
    onSuccess: () => {
      showToast({ type: 'success', title: 'Preferences saved' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Save failed', description: e?.message }),
  })

  const changePwd = useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const res = await fetch('/api/merchant/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to change password')
      return json
    },
    onSuccess: () => {
      setPwd({ current: '', next: '', confirm: '' })
      setPwdError(null)
      showToast({ type: 'success', title: 'Password changed' })
    },
    onError: (e: any) => setPwdError(e?.message ?? 'Failed to change password'),
  })

  const changeEmail = useMutation({
    mutationFn: async (body: { newEmail: string; password: string }) => {
      const res = await fetch('/api/merchant/settings/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to change email')
      return json
    },
    onSuccess: () => {
      setEmail({ newEmail: '', password: '' })
      setEmailError(null)
      showToast({ type: 'success', title: 'Email updated' })
    },
    onError: (e: any) => setEmailError(e?.message ?? 'Failed to change email'),
  })

  function handlePwdSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    if (pwd.next !== pwd.confirm) {
      setPwdError('Passwords do not match')
      return
    }
    if (pwd.next.length < 8) {
      setPwdError('New password must be at least 8 characters')
      return
    }
    changePwd.mutate({ currentPassword: pwd.current, newPassword: pwd.next })
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    changeEmail.mutate({ newEmail: email.newEmail, password: email.password })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Account, security, and notification preferences" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" /> Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Business Name</label>
              <Input value={current?.email ?? ''} readOnly className="bg-muted/30" placeholder="(see profile)" />
              <p className="mt-1 text-xs text-muted-foreground">
                <a className="text-primary hover:underline" href="/merchant/profile">Edit in profile</a>
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
              <Input value={current?.email ?? ''} readOnly className="bg-muted/30" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" /> Security — Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePwdSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Current Password</label>
              <Input
                type="password"
                value={pwd.current}
                onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">New Password</label>
                <Input
                  type="password"
                  value={pwd.next}
                  onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirm New Password</label>
                <Input
                  type="password"
                  value={pwd.confirm}
                  onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                  required
                />
              </div>
            </div>
            {pwdError && <p className="text-xs text-destructive">{pwdError}</p>}
            <Button type="submit" disabled={changePwd.isPending}>
              {changePwd.isPending ? 'Changing…' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" /> Security — Change Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">New Email</label>
              <Input
                type="email"
                value={email.newEmail}
                onChange={(e) => setEmail((p) => ({ ...p, newEmail: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirm Password</label>
              <Input
                type="password"
                value={email.password}
                onChange={(e) => setEmail((p) => ({ ...p, password: e.target.value }))}
                required
              />
            </div>
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            <Button type="submit" disabled={changeEmail.isPending}>
              {changeEmail.isPending ? 'Updating…' : 'Change Email'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" /> Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          {values && (
            <div className="space-y-2">
              {([
                ['newRedemption', 'New redemptions'],
                ['offerApproval', 'Offer approvals'],
                ['offerRejection', 'Offer rejections'],
                ['profileChangeRequest', 'Profile change request updates'],
                ['issueResponse', 'Issue responses'],
                ['weeklyReport', 'Weekly performance report'],
                ['marketingEmails', 'Marketing emails'],
              ] as [keyof Prefs, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={values[key]}
                    onChange={(e) => setPrefs((p) => ({ ...(p ?? values), [key]: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <Button
                onClick={() => savePrefs.mutate(values)}
                disabled={savePrefs.isPending}
                className="mt-2"
              >
                {savePrefs.isPending ? 'Saving…' : 'Save Preferences'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

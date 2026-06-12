'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsForm } from '@/features/settings/components/settings-form'
import { SecuritySection } from '@/features/settings/components/security-section'
import { useUpdateCompanyProfile, useChangePassword, useLogoutAllDevices, useExportCompanyData, useRequestCancellation } from '@/hooks/queries/use-company-settings'
import { showToast } from '@/hooks/use-toast'
import { Download, LogOut, AlertTriangle } from 'lucide-react'

export default function CompanySettingsPage() {
  const updateProfile = useUpdateCompanyProfile()
  const changePassword = useChangePassword()
  const logoutAll = useLogoutAllDevices()
  const exportData = useExportCompanyData()
  const requestCancel = useRequestCancellation()

  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {}
    formData.forEach((value, key) => { if (value) data[key] = value })
    try {
      await updateProfile.mutateAsync(data)
      showToast({ type: 'success', title: 'Profile updated' })
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed', description: err.message })
    }
  }

  const handlePasswordChange = async (data: { currentPassword: string; newPassword: string }) => {
    try {
      await changePassword.mutateAsync(data)
      showToast({ type: 'success', title: 'Password changed' })
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed', description: err.message })
    }
  }

  const handleCancel = async () => {
    if (!cancelReason || cancelReason.length < 10) {
      showToast({ type: 'error', title: 'Please provide a reason (at least 10 characters)' })
      return
    }
    try {
      await requestCancel.mutateAsync({ reason: cancelReason })
      showToast({ type: 'success', title: 'Cancellation request submitted' })
      setShowCancel(false)
      setCancelReason('')
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed', description: err.message })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your company account settings</p>
      </div>

      <SettingsForm title="Company Profile" description="Update your company information">
        <form onSubmit={handleProfileUpdate} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Company Name</label>
            <Input name="name" placeholder="Company name" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Phone</label>
            <Input name="phone" placeholder="Phone number" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Website</label>
            <Input name="website" placeholder="https://example.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Industry</label>
            <Input name="industry" placeholder="e.g. Technology, Healthcare" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Approved Domain</label>
            <Input name="approvedDomain" placeholder="e.g. company.com" />
          </div>
          <Button type="submit" disabled={updateProfile.isPending} className="sm:col-span-2">
            {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </SettingsForm>

      <SecuritySection onPasswordChange={handlePasswordChange} />

      <SettingsForm title="Session" description="Manage your active sessions">
        <div className="space-y-3">
          <Button variant="outline" onClick={() => logoutAll.mutate()} disabled={logoutAll.isPending}>
            <LogOut className="mr-2 h-4 w-4" /> Logout All Devices
          </Button>
        </div>
      </SettingsForm>

      <SettingsForm title="Data" description="Export or manage your company data">
        <div className="space-y-3">
          <Button variant="outline" onClick={() => exportData.mutate()} disabled={exportData.isPending}>
            <Download className="mr-2 h-4 w-4" /> Export Company Data
          </Button>
        </div>
      </SettingsForm>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!showCancel ? (
            <Button variant="destructive" onClick={() => setShowCancel(true)}>
              Request Account Cancellation
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border border-destructive/50 p-4">
              <p className="text-sm text-muted-foreground">Please provide a reason for cancellation:</p>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (min. 10 characters)"
              />
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleCancel} disabled={requestCancel.isPending}>
                  {requestCancel.isPending ? 'Submitting...' : 'Confirm Cancellation'}
                </Button>
                <Button variant="outline" onClick={() => { setShowCancel(false); setCancelReason('') }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

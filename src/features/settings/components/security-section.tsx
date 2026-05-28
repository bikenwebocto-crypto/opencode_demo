'use client'
import { useState } from 'react'
import { SettingsForm } from './settings-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SecuritySectionProps {
  onPasswordChange: (data: { currentPassword: string; newPassword: string }) => void
}

export function SecuritySection({ onPasswordChange }: SecuritySectionProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onPasswordChange({ currentPassword, newPassword })
    setCurrentPassword('')
    setNewPassword('')
  }

  return (
    <SettingsForm title="Security" description="Update your password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="current-password">Current Password</label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="new-password">New Password</label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit">Change Password</Button>
      </form>
    </SettingsForm>
  )
}

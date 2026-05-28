'use client'
import { useState } from 'react'
import { SettingsForm } from './settings-form'
import { Button } from '@/components/ui/button'

interface NotificationSectionProps {
  onSubmit: (data: { emailNotifications: boolean; pushNotifications: boolean; digestFrequency: string }) => void
}

export function NotificationSection({ onSubmit }: NotificationSectionProps) {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [digestFrequency, setDigestFrequency] = useState('daily')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ emailNotifications, pushNotifications, digestFrequency })
  }

  return (
    <SettingsForm title="Notifications" description="Manage your notification preferences">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="email-notifications">Email Notifications</label>
          <button
            id="email-notifications"
            type="button"
            role="switch"
            aria-checked={emailNotifications}
            onClick={() => setEmailNotifications(!emailNotifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailNotifications ? 'bg-primary' : 'bg-input'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${emailNotifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="push-notifications">Push Notifications</label>
          <button
            id="push-notifications"
            type="button"
            role="switch"
            aria-checked={pushNotifications}
            onClick={() => setPushNotifications(!pushNotifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pushNotifications ? 'bg-primary' : 'bg-input'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${pushNotifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="digest-frequency">Digest Frequency</label>
          <select
            id="digest-frequency"
            value={digestFrequency}
            onChange={(e) => setDigestFrequency(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <Button type="submit">Save Preferences</Button>
      </form>
    </SettingsForm>
  )
}

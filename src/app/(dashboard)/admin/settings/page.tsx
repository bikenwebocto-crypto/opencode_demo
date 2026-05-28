'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { SettingsForm } from '@/features/settings/components/settings-form'
import { NotificationSection } from '@/features/settings/components/notification-section'
import { SecuritySection } from '@/features/settings/components/security-section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure system preferences and security" />
      <SettingsForm title="General Settings" description="Manage system-wide preferences">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="maintenance-mode">Maintenance Mode</label>
            <button
              id="maintenance-mode"
              type="button"
              role="switch"
              aria-checked={maintenanceMode}
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${maintenanceMode ? 'bg-primary' : 'bg-input'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="debug-mode">Debug Mode</label>
            <button
              id="debug-mode"
              type="button"
              role="switch"
              aria-checked={debugMode}
              onClick={() => setDebugMode(!debugMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${debugMode ? 'bg-primary' : 'bg-input'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${debugMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <Button onClick={() => console.log('General settings saved')}>Save Settings</Button>
        </div>
      </SettingsForm>
      <NotificationSection onSubmit={(data) => console.log('Notification settings:', data)} />
      <SecuritySection onPasswordChange={(data) => console.log('Password change requested:', data)} />
    </div>
  )
}

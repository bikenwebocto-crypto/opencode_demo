'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { showToast } from '@/hooks/use-toast'
import { X, Save } from 'lucide-react'

export interface EmployeeEditFormData {
  firstName: string
  lastName: string
  email?: string
  employeeId: string
  department: string
  jobTitle: string
  phone: string
  status?: string
}

export interface EmployeeEditModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<EmployeeEditFormData>) => Promise<void> | void
  employee: Partial<EmployeeEditFormData> & { id: string }
  scope: 'admin' | 'company'
  saving?: boolean
}

export function EmployeeEditModal({
  open,
  onClose,
  onSave,
  employee,
  scope,
  saving,
}: EmployeeEditModalProps) {
  const [form, setForm] = useState<EmployeeEditFormData>({
    firstName: '',
    lastName: '',
    email: '',
    employeeId: '',
    department: '',
    jobTitle: '',
    phone: '',
    status: 'ACTIVE',
  })

  useEffect(() => {
    if (open && employee) {
      setForm({
        firstName: employee.firstName ?? '',
        lastName: employee.lastName ?? '',
        email: employee.email ?? '',
        employeeId: employee.employeeId ?? '',
        department: employee.department ?? '',
        jobTitle: employee.jobTitle ?? '',
        phone: employee.phone ?? '',
        status: employee.status ?? 'ACTIVE',
      })
    }
  }, [open, employee])

  if (!open) return null

  const isAdmin = scope === 'admin'

  const update = (field: keyof EmployeeEditFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim()) {
      showToast({ type: 'error', title: 'First name is required' })
      return
    }
    if (!form.lastName.trim()) {
      showToast({ type: 'error', title: 'Last name is required' })
      return
    }

    const payload: Partial<EmployeeEditFormData> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      employeeId: form.employeeId.trim() || undefined,
      department: form.department.trim() || undefined,
      jobTitle: form.jobTitle.trim() || undefined,
      phone: form.phone.trim() || undefined,
    }

    if (isAdmin) {
      if (form.email?.trim()) payload.email = form.email.trim()
      if (form.status) payload.status = form.status
    }

    try {
      await onSave(payload)
      showToast({ type: 'success', title: 'Employee updated' })
      onClose()
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed to update employee',
        description: err?.message,
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Edit Employee</h3>
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? 'Update profile fields. Email and status changes are logged.'
                : 'Update profile fields. Email and status cannot be changed here.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit dialog"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                First Name *
              </label>
              <Input
                value={form.firstName}
                onChange={update('firstName')}
                required
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Last Name *
              </label>
              <Input
                value={form.lastName}
                onChange={update('lastName')}
                required
                disabled={saving}
              />
            </div>
          </div>

          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={update('email')}
                disabled={saving}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Employee ID
              </label>
              <Input
                value={form.employeeId}
                onChange={update('employeeId')}
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Phone
              </label>
              <Input
                value={form.phone}
                onChange={update('phone')}
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Department
              </label>
              <Input
                value={form.department}
                onChange={update('department')}
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Job Title
              </label>
              <Input
                value={form.jobTitle}
                onChange={update('jobTitle')}
                disabled={saving}
              />
            </div>
          </div>

          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Status
              </label>
              <select
                value={form.status ?? 'ACTIVE'}
                onChange={update('status')}
                disabled={saving}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="INVITED">Invited</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="INELIGIBLE">Ineligible</option>
              </select>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

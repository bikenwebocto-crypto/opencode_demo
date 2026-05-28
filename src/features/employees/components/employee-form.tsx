'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save } from 'lucide-react'

const mockCompanies = [
  { id: 'com-001', name: 'TechCorp Inc.' },
  { id: 'com-002', name: 'Global Solutions Ltd' },
  { id: 'com-003', name: 'InnovateX' },
  { id: 'com-004', name: 'BlueOcean Corp' },
  { id: 'com-005', name: 'Pinnacle Partners' },
  { id: 'com-006', name: 'NorthStar Enterprises' },
]

interface FormData {
  name: string
  email: string
  password: string
  department: string
  companyId: string
}

interface FormErrors {
  [key: string]: string
}

export function EmployeeForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    department: '',
    companyId: '',
  })

  const setField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (!form.department.trim()) errs.department = 'Department is required'
    if (!form.companyId) errs.companyId = 'Company is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 1000))
    setIsSubmitting(false)
    router.push('/admin/employees')
  }

  const inputClass = (field: string) =>
    `w-full ${errors[field] ? 'border-destructive focus-visible:ring-destructive' : ''}`

  const companyName = mockCompanies.find((c) => c.id === form.companyId)?.name ?? ''

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Employee</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register a new employee under a company</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Employee Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Full Name <span className="text-destructive">*</span></label>
              <Input className={inputClass('name')} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Alice Johnson" />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email <span className="text-destructive">*</span></label>
              <Input type="email" className={inputClass('email')} value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="alice@company.com" />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password <span className="text-destructive">*</span></label>
              <Input type="password" className={inputClass('password')} value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder="Min. 8 characters" />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Department <span className="text-destructive">*</span></label>
              <Input className={inputClass('department')} value={form.department} onChange={(e) => setField('department', e.target.value)} placeholder="e.g. Engineering, Marketing" />
              {errors.department && <p className="mt-1 text-xs text-destructive">{errors.department}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Company Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Company <span className="text-destructive">*</span></label>
              <select
                value={form.companyId}
                onChange={(e) => setField('companyId', e.target.value)}
                className={`flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring ${errors.companyId ? 'border-destructive' : 'border-input'}`}
              >
                <option value="">Select a company</option>
                {mockCompanies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.companyId && <p className="mt-1 text-xs text-destructive">{errors.companyId}</p>}
            </div>
            {companyName && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-muted-foreground">Employee will be assigned to <span className="font-medium text-foreground">{companyName}</span></p>
              </div>
            )}
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              <p>Employees inherit offers &amp; perks available through their assigned company.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="mr-1 h-4 w-4" />
          {isSubmitting ? 'Saving...' : 'Save Employee'}
        </Button>
      </div>
    </form>
  )
}

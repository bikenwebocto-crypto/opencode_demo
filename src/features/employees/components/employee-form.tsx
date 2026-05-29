'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, Upload } from 'lucide-react'
import { CSVUploadDropzone } from '@/features/csv-uploads/components/csv-upload-dropzone'
import { useCreateEmployee } from '@/hooks/queries/use-employees'
import { useCompanies } from '@/hooks/queries/use-companies'
import { showToast } from '@/hooks/use-toast'

interface FormData {
  firstName: string
  lastName: string
  email: string
  department: string
  companyId: string
}

interface FormErrors {
  [key: string]: string
}

export function EmployeeForm() {
  const router = useRouter()
  const createEmployee = useCreateEmployee()
  const { data: companiesData } = useCompanies()
  const [errors, setErrors] = useState<FormErrors>({})
  const [showBulk, setShowBulk] = useState(false)

  const companies = useMemo(() => companiesData?.data ?? [], [companiesData])

  const [form, setForm] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
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
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim()) errs.lastName = 'Last name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.department.trim()) errs.department = 'Department is required'
    if (!form.companyId) errs.companyId = 'Company is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    createEmployee.mutate(form as unknown as Record<string, unknown>, {
      onSuccess: (res) => {
        showToast({ type: 'success', title: res.message ?? 'Employee created successfully' })
        router.push('/admin/employees')
      },
      onError: (err) => {
        showToast({ type: 'error', title: 'Failed to create employee', description: err.message })
      },
    })
  }

  const handleBulkUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(Boolean)
      if (lines.length < 2) {
        showToast({ type: 'error', title: 'CSV must have a header row and at least one data row' })
        return
      }
      const headers = (lines[0] ?? '').split(',').map((h) => h.trim().toLowerCase())

      const requiredFields = ['firstname', 'lastname', 'email', 'companyid', 'department']
      const missing = requiredFields.filter((f) => !headers.includes(f))
      if (missing.length > 0) {
        showToast({ type: 'error', title: 'Missing required columns', description: `Required: ${requiredFields.join(', ')}. Missing: ${missing.join(', ')}` })
        return
      }

      let successCount = 0
      let errorCount = 0
      const errMsgs: string[] = []

      const processLine = async (i: number) => {
        if (i >= lines.length - 1) {
          if (successCount > 0) showToast({ type: 'success', title: 'Bulk upload complete', description: `${successCount} created, ${errorCount} failed` })
          if (errorCount > 0) showToast({ type: 'error', title: 'Some rows failed', description: errMsgs.slice(0, 5).join('; ') })
          router.refresh()
          return
        }

        const vals = (lines[i + 1] ?? '').split(',').map((v) => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })

        try {
          const res = await fetch('/api/admin/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: row.firstname,
              lastName: row.lastname,
              email: row.email,
              companyId: row.companyid,
              department: row.department,
              jobTitle: row.jobtitle || '',
              phone: row.phone || '',
              employeeId: row.employeeid || '',
            }),
          })
          const json = await res.json()
          if (res.ok) successCount++
          else {
            errorCount++
            errMsgs.push(`Row ${i + 2}: ${json.error?.message ?? 'Unknown error'}`)
          }
        } catch {
          errorCount++
          errMsgs.push(`Row ${i + 2}: Network error`)
        }
        processLine(i + 1)
      }

      processLine(0)
    }
    reader.readAsText(file)
  }

  const inputClass = (field: string) =>
    `w-full ${errors[field] ? 'border-destructive focus-visible:ring-destructive' : ''}`

  const companyName = companies.find((c: any) => c.id === form.companyId)?.name ?? ''

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add Employee</h1>
            <p className="mt-1 text-sm text-muted-foreground">Register a new employee under a company</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => setShowBulk(!showBulk)}>
          <Upload className="mr-1 h-4 w-4" />Bulk Upload CSV
        </Button>
      </div>

      {showBulk && (
        <CSVUploadDropzone onUpload={handleBulkUpload} isUploading={createEmployee.isPending} acceptedFormats=".csv" />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Employee Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">First Name <span className="text-destructive">*</span></label>
                <Input className={inputClass('firstName')} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} placeholder="Alice" />
                {errors.firstName && <p className="mt-1 text-xs text-destructive">{errors.firstName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Last Name <span className="text-destructive">*</span></label>
                <Input className={inputClass('lastName')} value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} placeholder="Johnson" />
                {errors.lastName && <p className="mt-1 text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email <span className="text-destructive">*</span></label>
              <Input type="email" className={inputClass('email')} value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="alice@company.com" />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
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
                {companies.map((c: any) => (
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
        <Button type="submit" disabled={createEmployee.isPending}>
          <Save className="mr-1 h-4 w-4" />
          {createEmployee.isPending ? 'Saving...' : 'Save Employee'}
        </Button>
      </div>
    </form>
  )
}

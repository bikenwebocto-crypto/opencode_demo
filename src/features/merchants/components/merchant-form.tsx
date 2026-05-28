'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save } from 'lucide-react'

interface FormData {
  businessName: string
  email: string
  password: string
  contactName: string
  contactPhone: string
  categoryId: string
  description: string
  website: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
}

interface FormErrors {
  [key: string]: string
}

export function MerchantForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const [form, setForm] = useState<FormData>({
    businessName: '',
    email: '',
    password: '',
    contactName: '',
    contactPhone: '',
    categoryId: '',
    description: '',
    website: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
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

    if (!form.businessName.trim()) errs.businessName = 'Business name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (!form.contactName.trim()) errs.contactName = 'Contact name is required'
    if (!form.contactPhone.trim()) errs.contactPhone = 'Phone number is required'
    else if (!/^\+?[\d\s\-()]{7,20}$/.test(form.contactPhone)) errs.contactPhone = 'Invalid phone number'
    if (!form.addressLine1.trim()) errs.addressLine1 = 'Address is required'
    if (!form.city.trim()) errs.city = 'City is required'
    if (!form.postalCode.trim()) errs.postalCode = 'Postal code is required'
    if (!form.country.trim()) errs.country = 'Country is required'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000))
    setIsSubmitting(false)
    router.push('/admin/merchants')
  }

  const inputClass = (field: string) =>
    `w-full ${errors[field] ? 'border-destructive focus-visible:ring-destructive' : ''}`

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Merchant</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register a new merchant account</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Business Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Business Name <span className="text-destructive">*</span></label>
              <Input className={inputClass('businessName')} value={form.businessName} onChange={(e) => setField('businessName', e.target.value)} placeholder="e.g. Joe's Coffee Shop" />
              {errors.businessName && <p className="mt-1 text-xs text-destructive">{errors.businessName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email <span className="text-destructive">*</span></label>
              <Input type="email" className={inputClass('email')} value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="contact@business.com" />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password <span className="text-destructive">*</span></label>
              <Input type="password" className={inputClass('password')} value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder="Min. 8 characters" />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contact Name <span className="text-destructive">*</span></label>
              <Input className={inputClass('contactName')} value={form.contactName} onChange={(e) => setField('contactName', e.target.value)} placeholder="Full name" />
              {errors.contactName && <p className="mt-1 text-xs text-destructive">{errors.contactName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contact Phone <span className="text-destructive">*</span></label>
              <Input type="tel" className={inputClass('contactPhone')} value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} placeholder="+1 555-123-4567" />
              {errors.contactPhone && <p className="mt-1 text-xs text-destructive">{errors.contactPhone}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => setField('categoryId', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select category</option>
                <option value="food">Food &amp; Dining</option>
                <option value="retail">Retail</option>
                <option value="tech">Technology</option>
                <option value="health">Health &amp; Fitness</option>
                <option value="entertainment">Entertainment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Brief description of your business"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Website</label>
              <Input type="url" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://example.com" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Address Line 1 <span className="text-destructive">*</span></label>
              <Input className={inputClass('addressLine1')} value={form.addressLine1} onChange={(e) => setField('addressLine1', e.target.value)} placeholder="123 Main Street" />
              {errors.addressLine1 && <p className="mt-1 text-xs text-destructive">{errors.addressLine1}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Address Line 2</label>
              <Input value={form.addressLine2} onChange={(e) => setField('addressLine2', e.target.value)} placeholder="Suite 100" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">City <span className="text-destructive">*</span></label>
                <Input className={inputClass('city')} value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="New York" />
                {errors.city && <p className="mt-1 text-xs text-destructive">{errors.city}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">State</label>
                <Input value={form.state} onChange={(e) => setField('state', e.target.value)} placeholder="NY" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Postal Code <span className="text-destructive">*</span></label>
                <Input className={inputClass('postalCode')} value={form.postalCode} onChange={(e) => setField('postalCode', e.target.value)} placeholder="10001" />
                {errors.postalCode && <p className="mt-1 text-xs text-destructive">{errors.postalCode}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Country <span className="text-destructive">*</span></label>
                <Input className={inputClass('country')} value={form.country} onChange={(e) => setField('country', e.target.value)} placeholder="United States" />
                {errors.country && <p className="mt-1 text-xs text-destructive">{errors.country}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="mr-1 h-4 w-4" />
          {isSubmitting ? 'Saving...' : 'Save Merchant'}
        </Button>
      </div>
    </form>
  )
}

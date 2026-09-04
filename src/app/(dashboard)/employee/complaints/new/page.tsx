'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { showToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import {
  getPriorityForType,
  getPriorityForCategory,
  APPLICATION_SUPPORT_CATEGORIES,
  PRIORITY_STYLES,
} from '@/features/complaints/constants'

interface Offer {
  id: string
  title: string
  merchant: { businessName: string }
}

const COMPLAINT_KINDS = [
  { value: 'OFFER', label: 'Offer Complaint' },
  { value: 'APPLICATION_SUPPORT', label: 'Application Support' },
] as const

type ComplaintKind = typeof COMPLAINT_KINDS[number]['value']

const COMPLAINT_TYPES = [
  { value: 'MISLEADING', label: 'Misleading' },
  { value: 'INVALID_TERMS', label: 'Invalid Terms' },
  { value: 'NON_FUNCTIONAL', label: 'Non Functional' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
]

export default function NewComplaintPage() {
  const router = useRouter()
  const [complaintKind, setComplaintKind] = useState<ComplaintKind>('OFFER')
  const [offerId, setOfferId] = useState('')
  const [complaintType, setComplaintType] = useState('MISLEADING')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceUrls, setEvidenceUrls] = useState('')

  const [offerError, setOfferError] = useState(false)
  const [categoryError, setCategoryError] = useState(false)
  const [descriptionError, setDescriptionError] = useState(false)

  const offerRef = useRef<HTMLSelectElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  const isOfferMode = complaintKind === 'OFFER'
  const priority = isOfferMode ? getPriorityForType(complaintType) : getPriorityForCategory(category)

  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ['employee-offers-list'],
    enabled: isOfferMode,
    queryFn: async () => {
      const res = await fetch('/api/employee/offers?pageSize=200')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return json as { data: Offer[] }
    },
  })

  const createOfferComplaint = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to submit')
      return json
    },
    onSuccess: () => {
      showToast({ type: 'success', title: 'Complaint submitted', description: 'Your complaint has been filed successfully.' })
      router.push('/employee/complaints')
    },
    onError: (e: Error) => showToast({ type: 'error', title: 'Failed', description: e.message }),
  })

  const createAppSupport = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/complaints/application-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to submit')
      return json
    },
    onSuccess: () => {
      showToast({ type: 'success', title: 'Request submitted', description: 'Your application support request has been filed.' })
      router.push('/employee/complaints')
    },
    onError: (e: Error) => showToast({ type: 'error', title: 'Failed', description: e.message }),
  })

  const isSubmitting = createOfferComplaint.isPending || createAppSupport.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const missingOffer = isOfferMode && !offerId
    const missingCategory = !isOfferMode && !category
    const missingDescription = !description.trim()

    setOfferError(missingOffer)
    setCategoryError(missingCategory)
    setDescriptionError(missingDescription)

    if (missingOffer || missingCategory || missingDescription) {
      const firstInvalidRef = missingOffer ? offerRef : missingCategory ? categoryRef : descriptionRef
      firstInvalidRef.current?.focus()
      firstInvalidRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      showToast({
        type: 'error',
        title: 'Required',
        description: missingOffer
          ? 'Please select an offer.'
          : missingCategory
            ? 'Please select a category.'
            : 'Please provide a description.',
      })
      return
    }

    if (isOfferMode) {
      const urls = evidenceUrls.split(',').map((u) => u.trim()).filter(Boolean)
      createOfferComplaint.mutate({
        offerId,
        complaintType,
        description: description.trim(),
        ...(urls.length > 0 ? { evidenceUrls: urls } : {}),
      })
    } else {
      createAppSupport.mutate({
        description: description.trim(),
        category,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/employee/complaints"
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Complaints
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>File a Complaint</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Complaint Kind</label>
            <div className="flex gap-1 rounded-lg border bg-muted p-1">
              {COMPLAINT_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => {
                    setComplaintKind(k.value)
                    setOfferId('')
                    setComplaintType('MISLEADING')
                    setCategory('')
                    setEvidenceUrls('')
                    setOfferError(false)
                    setCategoryError(false)
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    complaintKind === k.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isOfferMode && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Offer *</label>
                {offersLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <select
                    ref={offerRef}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      offerError ? 'border-red-500 ring-2 ring-red-500 animate-pulse' : ''
                    }`}
                    value={offerId}
                    onChange={(e) => {
                      setOfferId(e.target.value)
                      if (offerError) setOfferError(false)
                    }}
                    required
                  >
                    <option value="">Select an offer…</option>
                    {(offersData?.data ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title} — {o.merchant?.businessName ?? ''}
                      </option>
                    ))}
                  </select>
                )}
                {offerError && (
                  <p className="mt-1 text-xs font-medium text-red-600">An offer is required.</p>
                )}
              </div>
            )}

            {isOfferMode && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Complaint Type *</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={complaintType}
                    onChange={(e) => setComplaintType(e.target.value)}
                  >
                    {COMPLAINT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                  <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
                      {priority}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" /> Auto-set based on complaint type
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!isOfferMode && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Category *</label>
                  <select
                    ref={categoryRef}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      categoryError ? 'border-red-500 ring-2 ring-red-500 animate-pulse' : ''
                    }`}
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value)
                      if (categoryError) setCategoryError(false)
                    }}
                  >
                    <option value="">Select a category…</option>
                    {APPLICATION_SUPPORT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  {categoryError && (
                    <p className="mt-1 text-xs font-medium text-red-600">A category is required.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                  <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
                      {priority}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" /> Auto-set based on category
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Description *</label>
              <textarea
                ref={descriptionRef}
                rows={5}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  descriptionError ? 'border-red-500 ring-2 ring-red-500 animate-pulse' : ''
                }`}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  if (descriptionError) setDescriptionError(false)
                }}
                placeholder={isOfferMode ? 'Describe the issue in detail...' : 'Describe your application support request...'}
                required
              />
              {descriptionError && (
                <p className="mt-1 text-xs font-medium text-red-600">A description is required.</p>
              )}
            </div>

            {isOfferMode && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Evidence URLs (optional)</label>
                <Input
                  value={evidenceUrls}
                  onChange={(e) => setEvidenceUrls(e.target.value)}
                  placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                />
                <p className="mt-1 text-xs text-muted-foreground">Comma-separated URLs to supporting evidence (screenshots, documents, etc.)</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/employee/complaints')}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Submitting…</>
                ) : isOfferMode ? (
                  'Submit Complaint'
                ) : (
                  'Submit Request'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
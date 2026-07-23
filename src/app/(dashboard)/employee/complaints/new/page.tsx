'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { showToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { getPriorityForType } from '@/features/complaints/constants'

interface Offer {
  id: string
  title: string
  merchant: { businessName: string }
}

const COMPLAINT_TYPES = [
  { value: 'MISLEADING', label: 'Misleading' },
  { value: 'INVALID_TERMS', label: 'Invalid Terms' },
  { value: 'NON_FUNCTIONAL', label: 'Non Functional' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
]

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

export default function NewComplaintPage() {
  const router = useRouter()
  const [offerId, setOfferId] = useState('')
  const [complaintType, setComplaintType] = useState('MISLEADING')
  const [priority, setPriority] = useState('MEDIUM')
  const [description, setDescription] = useState('')
  const [evidenceUrls, setEvidenceUrls] = useState('')

  useEffect(() => {
    setPriority(getPriorityForType(complaintType))
  }, [complaintType])

  const isAutoSet = priority === getPriorityForType(complaintType)

  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ['employee-offers-list'],
    queryFn: async () => {
      const res = await fetch('/api/employee/offers?pageSize=200')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return json as { data: Offer[] }
    },
  })

  const createComplaint = useMutation({
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!offerId) {
      showToast({ type: 'error', title: 'Required', description: 'Please select an offer.' })
      return
    }
    if (!description.trim()) {
      showToast({ type: 'error', title: 'Required', description: 'Please provide a description.' })
      return
    }
    const urls = evidenceUrls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
    createComplaint.mutate({
      offerId,
      complaintType,
      priority,
      description: description.trim(),
      ...(urls.length > 0 ? { evidenceUrls: urls } : {}),
    })
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Offer *</label>
              {offersLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={offerId}
                  onChange={(e) => setOfferId(e.target.value)}
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
            </div>

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
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority *</label>
                <div className="relative">
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {isAutoSet && (
                    <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2" title="Auto-set based on type">
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </span>
                  )}
                </div>
                {isAutoSet && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> Auto-set based on complaint type
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Description *</label>
              <textarea
                rows={5}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Evidence URLs (optional)</label>
              <Input
                value={evidenceUrls}
                onChange={(e) => setEvidenceUrls(e.target.value)}
                placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
              />
              <p className="mt-1 text-xs text-muted-foreground">Comma-separated URLs to supporting evidence (screenshots, documents, etc.)</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/employee/complaints')}>
                Cancel
              </Button>
              <Button type="submit" disabled={createComplaint.isPending}>
                {createComplaint.isPending ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Submitting…</>
                ) : (
                  'Submit Complaint'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { showToast } from '@/hooks/use-toast'
import { Plus, X, AlertCircle, CheckCircle, Clock, Search, Wrench } from 'lucide-react'

interface Issue {
  id: string
  title: string
  description: string
  category: string
  priority: string
  status: string
  adminNotes: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

interface ApiResponse {
  data: Issue[]
  metrics: { open: number }
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}

async function fetchIssues(params: URLSearchParams): Promise<ApiResponse> {
  const res = await fetch(`/api/merchant/issues?${params.toString()}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Failed to load')
  return json
}

const CATEGORIES = [
  { value: 'technical', label: 'Technical' },
  { value: 'offer_problem', label: 'Offer Problem' },
  { value: 'employee_complaint', label: 'Employee Complaint' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Other' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function statusBadge(s: string) {
  const cls =
    s === 'OPEN'
      ? 'bg-blue-100 text-blue-800'
      : s === 'UNDER_REVIEW'
      ? 'bg-yellow-100 text-yellow-800'
      : s === 'RESOLVED'
      ? 'bg-green-100 text-green-800'
      : s === 'REJECTED'
      ? 'bg-red-100 text-red-800'
      : 'bg-gray-100 text-gray-800'
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{s.replace('_', ' ')}</span>
}

function priorityBadge(p: string) {
  const cls =
    p === 'urgent'
      ? 'bg-red-100 text-red-800'
      : p === 'high'
      ? 'bg-orange-100 text-orange-800'
      : p === 'normal'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-100 text-gray-800'
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{p.toUpperCase()}</span>
}

export default function MerchantIssuesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'other', priority: 'normal' })
  const [selected, setSelected] = useState<Issue | null>(null)

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', '20')
  if (search) params.set('q', search)
  if (status) params.set('status', status)

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-issues', params.toString()],
    queryFn: () => fetchIssues(params),
  })

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/merchant/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to create')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-issues'] })
      setShowCreate(false)
      setForm({ title: '', description: '', category: 'other', priority: 'normal' })
      showToast({ type: 'success', title: 'Issue submitted', description: 'Our team will review it shortly.' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    create.mutate(form)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issues"
        description="Report problems, request support, and track issue resolution"
        actions={
          <Button onClick={() => setShowCreate((s) => !s)}>
            <Plus className="mr-1 h-4 w-4" />
            {showCreate ? 'Cancel' : 'New Issue'}
          </Button>
        }
      />

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit a new issue</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Title *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Brief description of the issue"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Description *</label>
                <textarea
                  rows={4}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Submitting…' : 'Submit Issue'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>My Issues</span>
            <span className="text-sm text-muted-foreground">
              {data?.metrics.open ?? 0} open
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search issues…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-7"
              />
            </div>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Status</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !data?.data || data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues. Click "New Issue" to create one.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {data.data.map((i) => (
                  <li
                    key={i.id}
                    className="cursor-pointer rounded-md border p-3 text-sm hover:bg-muted/30"
                    onClick={() => setSelected(i)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{i.title}</p>
                      <div className="flex items-center gap-2">
                        {priorityBadge(i.priority)}
                        {statusBadge(i.status)}
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {CATEGORIES.find((c) => c.value === i.category)?.label ?? i.category} ·{' '}
                      {new Date(i.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {data.meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                    disabled={page >= data.meta.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{selected.title}</span>
              <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                <X className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(selected.status)}
              {priorityBadge(selected.priority)}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {CATEGORIES.find((c) => c.value === selected.category)?.label ?? selected.category}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap">{selected.description}</p>
            </div>
            {selected.adminNotes && (
              <div className="rounded-md bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Admin Notes</p>
                <p className="whitespace-pre-wrap">{selected.adminNotes}</p>
              </div>
            )}
            {selected.resolvedAt && (
              <p className="text-xs text-green-700">
                <CheckCircle className="mr-1 inline h-3 w-3" /> Resolved at {new Date(selected.resolvedAt).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Created {new Date(selected.createdAt).toLocaleString()} · Updated {new Date(selected.updatedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

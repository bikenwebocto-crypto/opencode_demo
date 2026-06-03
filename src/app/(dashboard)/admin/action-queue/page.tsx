'use client'
import { useState, useMemo, useCallback } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { showToast } from '@/hooks/use-toast'
import { useActionQueue, useUpdateActionQueueItem, useDeleteActionQueueItem } from '@/hooks/queries/use-action-queue'
import { CheckCircle2, XCircle, Eye,  } from 'lucide-react'

type TabKey = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'FAILED', label: 'Failed' },
]

function TaskProgress({ status }: { status: string }) {
  const pct = status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 60 : status === 'FAILED' ? 100 : 25
  const r = 10
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = status === 'COMPLETED' ? 'stroke-green-500' : status === 'FAILED' ? 'stroke-red-500' : status === 'IN_PROGRESS' ? 'stroke-blue-500' : 'stroke-yellow-500'
  return (
    <svg width="28" height="28" className="shrink-0">
      <circle cx="14" cy="14" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
      <circle cx="14" cy="14" r={r} fill="none" className={color} strokeWidth="3" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 14 14)" />
    </svg>
  )
}

export default function ActionQueuePage() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('ALL')
  const [selectedItem, setSelectedItem] = useState<any>(null)

  const { data, isLoading } = useActionQueue({
    status: activeTab !== 'ALL' ? activeTab : undefined,
    q: search || undefined,
  })

  const updateItem = useUpdateActionQueueItem()
  const deleteItem = useDeleteActionQueueItem()

  const items = data?.data ?? []

  const itemCounts = useMemo(() => {
    return {
      PENDING: data?.meta?.counts?.PENDING ?? 0,
      IN_PROGRESS: data?.meta?.counts?.IN_PROGRESS ?? 0,
      COMPLETED: data?.meta?.counts?.COMPLETED ?? 0,
      FAILED: data?.meta?.counts?.FAILED ?? 0,
    }
  }, [data])

  const pendingItems = useMemo(() => items.filter((i: any) => i.status === 'PENDING'), [items])

  const handleStatusUpdate = useCallback((id: string, status: string) => {
    updateItem.mutate(
      { id, status },
      {
        onSuccess: (res: any) => {
          showToast({ type: 'success', title: res.message ?? `Item ${status.toLowerCase()}` })
          setSelectedItem(null)
        },
        onError: (err: Error) => showToast({ type: 'error', title: 'Update failed', description: err.message }),
      },
    )
  }, [updateItem])

  const handleSkip = useCallback((id: string) => {
    deleteItem.mutate(id, {
      onSuccess: (res: any) => {
        showToast({ type: 'success', title: res.message ?? 'Item skipped' })
        setSelectedItem(null)
      },
      onError: (err: Error) => showToast({ type: 'error', title: 'Failed to skip', description: err.message }),
    })
  }, [deleteItem])

  return (
    <div className="space-y-6">
      <PageHeader title="Action Queue" description="Review and process pending actions from merchants, companies, and employees" />

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 text-sm font-medium ${activeTab === tab.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          >
            {tab.label}
            {tab.key !== 'ALL' && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px]">{itemCounts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search actions..."
        className="w-full rounded-lg border px-4 py-2 text-sm"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-muted-foreground">
              <th className="w-10 px-4 py-3 font-medium"></th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="mb-2 h-8 w-full" />)}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No action queue items found</td></tr>
            ) : (
              items.map((item: any) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><TaskProgress status={item.status} /></td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.title}</p>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs">{item.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.priority >= 4 ? 'bg-red-100 text-red-700' : item.priority >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {item.priority >= 4 ? 'High' : item.priority >= 3 ? 'Medium' : 'Low'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString('en-US')}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.status === 'PENDING' && (
                        <>
                          <Button size="sm" variant="success" className="h-7 px-2 text-xs" onClick={() => handleStatusUpdate(item.id, 'IN_PROGRESS')}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />Claim
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleSkip(item.id)}>
                            <XCircle className="mr-1 h-3 w-3" />Skip
                          </Button>
                        </>
                      )}
                      {item.status === 'IN_PROGRESS' && (
                        <Button size="sm" variant="success" className="h-7 px-2 text-xs" onClick={() => handleStatusUpdate(item.id, 'COMPLETED')}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />Complete
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setSelectedItem(item)}>
                        <Eye className="mr-1 h-3 w-3" />View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

     

      {/* Detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedItem(null)}>
          <div className="mx-4 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{selectedItem.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{selectedItem.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <StatusBadge status={selectedItem.status} />
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{selectedItem.type.replace(/_/g, ' ')}</span>
              <span className="text-muted-foreground">Ref: {selectedItem.referenceId}</span>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedItem(null)}>Cancel</Button>
              {selectedItem.status === 'PENDING' && (
                <>
                  <Button variant="success" onClick={() => handleStatusUpdate(selectedItem.id, 'IN_PROGRESS')}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />Claim
                  </Button>
                  <Button variant="destructive" onClick={() => handleSkip(selectedItem.id)}>
                    <XCircle className="mr-1 h-4 w-4" />Skip
                  </Button>
                </>
              )}
              {selectedItem.status === 'IN_PROGRESS' && (
                <Button variant="success" onClick={() => handleStatusUpdate(selectedItem.id, 'COMPLETED')}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />Complete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

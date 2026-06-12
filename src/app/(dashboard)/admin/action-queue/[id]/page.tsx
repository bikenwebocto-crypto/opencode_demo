'use client'

import { use, useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, Edit3, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { showToast } from '@/hooks/use-toast'
import { ReviewHeader } from '@/components/admin/action-queue/ReviewHeader'
import {
  REVIEW_COMPONENT_MAP,
  EDITABLE_FIELDS_MAP,
  EntityNotFound,
  EditFieldsForm,
  RemarksPanel,
  AuditTimeline,
  RejectDialog,
  type ReviewComponentKey,
} from '@/components/admin/action-queue/reviews'
import {
  QUEUE_TYPE_MAP,
  getEntityKindFromReferenceType,
  getQueueTypeFromEntityKind,
  getQueueTypeMapping,
} from '@/lib/action-queue-types'

function resolveReviewComponentKey(queueItem: any): ReviewComponentKey {
  const meta = (queueItem?.metadata as any) ?? {}
  const queueType = meta.queueType as string | undefined

  if (queueType && QUEUE_TYPE_MAP[queueType]) {
    return QUEUE_TYPE_MAP[queueType].reviewComponent as ReviewComponentKey
  }

  const kind = getEntityKindFromReferenceType(queueItem?.referenceType)
  const fallbackType = getQueueTypeFromEntityKind(kind)
  if (fallbackType && QUEUE_TYPE_MAP[fallbackType]) {
    return QUEUE_TYPE_MAP[fallbackType].reviewComponent as ReviewComponentKey
  }

  if (queueItem?.type === 'OFFER_REPLACEMENT') return 'OfferReplacementReview'
  if (queueItem?.type === 'PROFILE_EDIT_REQUEST') return 'ProfileReview'
  if (queueItem?.type === 'OFFER_APPROVAL') return 'OfferReview'
  if (queueItem?.type === 'MERCHANT_APPROVAL') return 'MerchantApplicationReview'
  if (queueItem?.type === 'COMPANY_APPROVAL') return 'CompanyActivationReview'
  if (queueItem?.type === 'ISSUE_REVIEW') return 'IssueReview'

  return 'MerchantApplicationReview'
}

function resolveDisplayType(queueItem: any): string {
  const meta = (queueItem?.metadata as any) ?? {}
  const queueType = meta.queueType as string | undefined
  const mapping = getQueueTypeMapping(queueType)
  if (mapping) return mapping.displayType

  const kind = getEntityKindFromReferenceType(queueItem?.referenceType)
  const kindMapping = QUEUE_TYPE_MAP[getQueueTypeFromEntityKind(kind) ?? '']
  if (kindMapping) return kindMapping.displayType

  return (queueItem?.type ?? 'Action Item').replace(/_/g, ' ')
}

function hasEntityContent(entity: any, kind: string): boolean {
  if (!entity) return false
  if (typeof entity !== 'object') return false
  return Object.keys(entity).length > 0
}

export default function UnifiedReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [queueItem, setQueueItem] = useState<any>(null)
  const [entity, setEntity] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [edits, setEdits] = useState<Record<string, unknown>>({})
  const [editMode, setEditMode] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/action-queue/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json?.data) {
        showToast({ type: 'error', title: json?.error?.message ?? 'Failed to load review data' })
        setQueueItem(null)
        return
      }
      setQueueItem(json.data.queueItem)
      setEntity(json.data.entity ?? null)
      setAuditLogs(json.data.auditLogs ?? [])
    } catch (err: any) {
      showToast({ type: 'error', title: 'Failed to load review data', description: err?.message })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const reviewComponentKey = useMemo(() => resolveReviewComponentKey(queueItem), [queueItem])
  const displayType = useMemo(() => resolveDisplayType(queueItem), [queueItem])
  const ReviewComponent = REVIEW_COMPONENT_MAP[reviewComponentKey]
  const editableFields = EDITABLE_FIELDS_MAP[reviewComponentKey] ?? []
  const entityKind = useMemo(() => getEntityKindFromReferenceType(queueItem?.referenceType), [queueItem])

  const isFinalized = queueItem?.status === 'COMPLETED' || queueItem?.status === 'FAILED'
  const canEdit = !isFinalized && (editableFields.length > 0)

  const performAction = useCallback(
    async (actionType: string, extra: Record<string, any> = {}) => {
      setProcessing(true)
      try {
        const res = await fetch(`/api/admin/action-queue/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: actionType, ...extra }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error?.message ?? 'Action failed')
        showToast({ type: 'success', title: json?.message ?? 'Action completed' })
        setEditMode(false)
        setEdits({})
        setShowRejectDialog(false)
        await loadData()
      } catch (err: any) {
        showToast({ type: 'error', title: 'Action failed', description: err?.message })
      } finally {
        setProcessing(false)
      }
    },
    [id, loadData],
  )

  const handleAddRemark = useCallback(
    async (text: string) => {
      await performAction('REMARK', { remark: text })
    },
    [performAction],
  )

  const handleApprove = useCallback(() => {
    performAction('APPROVE')
  }, [performAction])

  const handleEditAndApprove = useCallback(() => {
    const editPayload: Record<string, unknown> = {}
    for (const f of editableFields) {
      if (edits[f.key] !== undefined) {
        editPayload[f.key] = edits[f.key]
      }
    }
    if (Object.keys(editPayload).length === 0) {
      showToast({ type: 'info', title: 'No edits to apply, approving as-is' })
      performAction('APPROVE')
      return
    }
    performAction('EDIT_AND_APPROVE', { edits: editPayload })
  }, [edits, editableFields, performAction])

  const handleReject = useCallback(
    (reason: string) => {
      performAction('REJECT', { rejectionReason: reason })
    },
    [performAction],
  )

  if (loading) {
    return (
      <div className="space-y-6 py-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!queueItem) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium">Action queue item not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The item may have been removed or you may not have access to it.
        </p>
        <Link href="/admin/action-queue">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Operations Center
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-6">
      <ReviewHeader queueItem={queueItem} displayType={displayType} />

      {hasEntityContent(entity, entityKind) ? (
        <ReviewComponent
          entity={entity}
          queueItem={queueItem}
          edits={edits}
          setEdits={setEdits}
          editMode={editMode}
        />
      ) : (
        <EntityNotFound
          referenceId={queueItem.referenceId}
          referenceType={queueItem.referenceType}
          context={`Could not load ${entityKind.toLowerCase()} record for queue item`}
        />
      )}

      {editMode && canEdit && (
        <EditFieldsForm
          fields={editableFields}
          entity={entity}
          edits={edits}
          setEdits={setEdits}
        />
      )}

      <RemarksPanel
        queueItem={queueItem}
        onAddRemark={handleAddRemark}
        onRefresh={loadData}
      />

      <AuditTimeline logs={auditLogs} />

      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!isFinalized && canEdit && !editMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(true)}
              disabled={processing}
            >
              <Edit3 className="mr-1 h-4 w-4" />Edit &amp; Approve
            </Button>
          )}
          {!isFinalized && editMode && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditMode(false); setEdits({}) }}
                disabled={processing}
              >
                Cancel Edit
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleEditAndApprove}
                disabled={processing}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {processing ? 'Processing…' : 'Save & Approve'}
              </Button>
            </>
          )}
          {!isFinalized && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRejectDialog(true)}
                disabled={processing}
              >
                <XCircle className="mr-1 h-4 w-4" />Reject
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={handleApprove}
                disabled={processing}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {processing ? 'Processing…' : 'Approve'}
              </Button>
            </>
          )}
          {isFinalized && (
            <span className="text-xs text-muted-foreground">
              This item is {queueItem.status === 'COMPLETED' ? 'approved' : 'rejected'} and read-only.
            </span>
          )}
        </div>
      </div>

      <RejectDialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleReject}
        processing={processing}
      />
    </div>
  )
}

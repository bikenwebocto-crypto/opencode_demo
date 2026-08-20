'use client'

import { use, useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Edit3,
  ExternalLink,
  Sparkles,
  Shield,
  Info,
  History,
  Loader2,
  Check,
  X as XIcon,
  FileText,
  AlertCircle,
  Clock,
  Smartphone,
  RefreshCw,
  ImageIcon,
  Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { showToast } from '@/hooks/use-toast'
import { ReviewHeader } from '@/components/admin/action-queue/ReviewHeader'
import { OfferMobilePreview } from '@/components/merchant/offers/OfferMobilePreview'
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
  if (queueItem?.type === 'FIRST_OFFER_APPROVAL') return 'OfferReview'
  if (queueItem?.type === 'NEW_MERCHANT_APPLICATION') return 'MerchantApplicationReview'
  if (queueItem?.type === 'COMPANY_ACTIVATION') return 'CompanyActivationReview'
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

function statusGradient(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'from-amber-500 to-orange-600'
    case 'IN_PROGRESS':
      return 'from-blue-500 to-indigo-600'
    case 'COMPLETED':
      return 'from-emerald-500 to-teal-600'
    case 'FAILED':
      return 'from-rose-500 to-red-600'
    case 'SKIPPED':
      return 'from-gray-400 to-gray-600'
    default:
      return 'from-violet-500 to-purple-600'
  }
}

function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'PENDING':
      return { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' }
    case 'IN_PROGRESS':
      return { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' }
    case 'COMPLETED':
      return { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' }
    case 'FAILED':
      return { bg: 'bg-rose-100 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400' }
    case 'SKIPPED':
      return { bg: 'bg-gray-100 dark:bg-gray-900/40', text: 'text-gray-700 dark:text-gray-400' }
    default:
      return { bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400' }
  }
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
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (!queueItem) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-950/40 dark:to-red-950/40">
          <AlertCircle className="h-8 w-8 text-rose-600" />
        </div>
        <p className="mt-4 text-lg font-semibold">Action queue item not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The item may have been removed or you may not have access to it.
        </p>
        <Link href="/admin/action-queue" className="mt-5">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Operations Center
          </Button>
        </Link>
      </div>
    )
  }

  const status = queueItem.status ?? 'PENDING'
  const colors = statusColor(status)
  const gradient = statusGradient(status)

  return (
    <div className="space-y-6 pb-32">
      {/* Back link */}
      <Link
        href="/admin/action-queue"
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to Operations Center
      </Link>

      {/* Status header banner */}
      <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/30 to-muted/50 p-5`}>
        <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-3xl`} />
        <div className={`absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl`} />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}>
              {status === 'PENDING' ? <Clock className="h-5 w-5" /> :
                status === 'COMPLETED' ? <CheckCircle2 className="h-5 w-5" /> :
                  status === 'FAILED' ? <XCircle className="h-5 w-5" /> :
                    <FileText className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Queue Status</p>
                <Badge className={`gap-1 ${colors.bg} ${colors.text} border-0`}>
                  <span className={`relative flex h-1.5 w-1.5`}>
                    {status === 'PENDING' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />}
                    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${status === 'PENDING' ? 'bg-amber-500' : status === 'COMPLETED' ? 'bg-emerald-500' : status === 'FAILED' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                  </span>
                  {status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="mt-1 text-sm font-medium">
                {status === 'PENDING' && 'Awaiting your decision'}
                {status === 'IN_PROGRESS' && 'Currently being processed'}
                {status === 'COMPLETED' && 'This item has been approved and closed'}
                {status === 'FAILED' && 'This item was rejected and closed'}
                {status === 'SKIPPED' && 'This item was skipped'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <Shield className="h-3 w-3" />
              {displayType}
            </Badge>
          </div>
        </div>
      </div>

      <ReviewHeader queueItem={queueItem} displayType={displayType} />

      {entityKind === 'MERCHANT_OFFER' && hasEntityContent(entity, entityKind) && (
        <OfferPreviewSection entity={entity} />
      )}

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

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 shadow-2xl backdrop-blur-md supports-[backdrop-filter]:bg-background/80 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Left: status info */}
          <div className="flex items-center gap-2 text-sm">
            {isFinalized ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium">
                  Item is {queueItem.status === 'COMPLETED' ? 'approved' : 'rejected'} — read only
                </span>
              </div>
            ) : editMode ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Edit3 className="h-4 w-4" />
                <span className="text-xs font-medium">Editing mode — changes will be saved on approval</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-medium">Review the details above and choose an action</span>
              </div>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!isFinalized && canEdit && !editMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(true)}
                disabled={processing}
                className="gap-1.5"
              >
                <Edit3 className="h-4 w-4" />Edit &amp; Approve
              </Button>
            )}
            {!isFinalized && editMode && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditMode(false); setEdits({}) }}
                  disabled={processing}
                  className="gap-1.5"
                >
                  <XIcon className="h-4 w-4" />Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleEditAndApprove}
                  disabled={processing}
                  className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {processing ? 'Processing…' : 'Save & Approve'}
                </Button>
              </>
            )}
            {!isFinalized && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={processing}
                  className="gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <XCircle className="h-4 w-4" />
                  {queueItem.type === 'ISSUE_REVIEW' ? 'Revise' : 'Reject'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={processing}
                  className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {processing ? 'Processing…' : (queueItem.type === 'ISSUE_REVIEW' ? 'Complete' : 'Approve')}
                </Button>
              </>
            )}
          </div>
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

function OfferPreviewSection({ entity }: { entity: any }) {
  const pricingConfig = (entity?.pricing?.configuration as Record<string, unknown>) ?? {}
  const redemptionConfig = (entity?.redemption?.configuration as Record<string, unknown>) ?? {}
  const amount = pricingConfig.amount as number | string | undefined
  const percent = pricingConfig.percent as number | string | undefined
  const minimumSpend = pricingConfig.minimumSpend as number | string | undefined
  const discountValue =
    amount != null
      ? String(amount)
      : percent != null
        ? String(percent)
        : ''

  const imageUrls: string[] = Array.isArray(entity?.content?.imageUrls) ? entity.content.imageUrls : []
  const isReplacement = !!entity?.replacesOfferId || !!entity?.replacesOffer
  const titlePrefix = isReplacement ? 'Replacement: ' : ''
  const bannerImage = imageUrls[0] ?? ''

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Mobile preview — takes 2 columns */}
      <Card className="overflow-hidden border-0 shadow-sm lg:col-span-2">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <Smartphone className="h-4 w-4" />
              </div>
              Mobile Preview
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              How employees will see this offer
            </p>
          </div>
          {isReplacement && (
            <Badge variant="pending" className="gap-1">
              <RefreshCw className="h-3 w-3" />
              Replacement
            </Badge>
          )}
        </CardHeader>
        <CardContent className="bg-gradient-to-br from-background via-muted/20 to-muted/40 p-6">
          <div className="flex justify-center">
            <OfferMobilePreview
              title={`${titlePrefix}${entity?.title ?? ''}`}
              shortDescription={entity?.content?.shortDescription ?? ''}
              description={entity?.content?.description ?? ''}
              discountValue={discountValue}
              offerType={entity?.offerType ?? ''}
              startDate={entity?.startDate ?? ''}
              endDate={entity?.endDate ?? ''}
              imageUrls={imageUrls}
              isFeatured={!!entity?.isFeatured}
              isExclusive={!!entity?.isExclusive}
              merchantName={entity?.merchant?.businessName ?? 'Merchant'}
              categoryName={undefined}
              redemptionType={entity?.redemption?.redemptionType ?? undefined}
              minSpend={minimumSpend != null ? String(minimumSpend) : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* Banner review — takes 3 columns */}
      <Card className="overflow-hidden border-0 shadow-sm lg:col-span-3">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                <ImageIcon className="h-4 w-4" />
              </div>
              Banner & Design Review
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Inspect the banner image, copy, and visual presentation
            </p>
          </div>
          {imageUrls.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <ImageIcon className="h-3 w-3" />
              {imageUrls.length} {imageUrls.length === 1 ? 'image' : 'images'}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {/* Main banner display */}
          {bannerImage ? (
            <div className="space-y-3">
              <div className="group relative overflow-hidden rounded-xl border-2 bg-muted shadow-sm">
                <div className="aspect-[16/9] w-full">
                  <img
                    src={bannerImage}
                    alt="Offer banner"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                {/* Discount overlay mimicking the actual offer presentation */}
                {(() => {
                  const ot = entity?.offerType
                  const cfg = (entity?.pricing?.configuration as Record<string, unknown>) ?? {}
                  const pct = cfg.percent as number | undefined
                  const amt = cfg.amount as number | undefined
                  let displayText = ''
                  let displaySuffix = 'OFF'
                  if (ot === 'PERCENTAGE' || ot === 'percentage') {
                    displayText = `${pct ?? amt ?? 0}%`
                  } else if (ot === 'BUY_X_GET_Y' || ot === 'buy_x_get_y') {
                    displayText = 'BOGO'
                    displaySuffix = 'FREE'
                  } else {
                    displayText = `£${Number(amt ?? 0).toFixed(0)}`
                  }
                  return displayText ? (
                    <div className="absolute right-3 top-3 flex flex-col items-center justify-center rounded-2xl bg-white px-4 py-2 shadow-xl">
                      <span className="text-2xl font-black leading-none tracking-tight text-foreground">
                        {displayText}
                      </span>
                      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {displaySuffix}
                      </span>
                    </div>
                  ) : null
                })()}
                {/* Featured/Exclusive overlay */}
                {(entity?.isFeatured || entity?.isExclusive) && (
                  <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                    {entity.isFeatured && (
                      <div className="flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-sm">
                        <Star className="h-2.5 w-2.5 fill-white" />
                        Featured
                      </div>
                    )}
                    {entity.isExclusive && (
                      <div className="flex items-center gap-1 rounded-full bg-violet-500/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-sm">
                        <Sparkles className="h-2.5 w-2.5" />
                        Exclusive
                      </div>
                    )}
                  </div>
                )}
                <div className="absolute bottom-3 right-3">
                  <a
                    href={bannerImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-black/80"
                  >
                    View full size
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No banner image uploaded</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The merchant has not provided a banner image for this offer
              </p>
            </div>
          )}

          {/* Additional gallery images */}
          {imageUrls.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Additional Images
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {imageUrls.slice(1).map((url: string, i: number) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-lg border bg-muted transition-transform hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <img
                      src={url}
                      alt={`Offer image ${i + 2}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                      {i + 2}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Copy review */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3 w-3" />
              Copy Review
            </p>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">Title</p>
              <p className="text-sm font-semibold">{entity?.title ?? '—'}</p>
            </div>
            {entity?.content?.shortDescription && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">Short Description</p>
                <p className="text-sm">{entity.content.shortDescription}</p>
              </div>
            )}
            {entity?.content?.description && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">Description</p>
                <p className="text-sm leading-relaxed">{entity.content.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

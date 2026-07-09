'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMerchantOfferById, useDeleteMerchantOffer, useRevokeMerchantOffer } from '@/hooks/queries/use-merchant-offers'
import { StatusBadge } from '@/components/shared/status-badge'
import { OfferStatusTimeline } from '@/components/shared/offer-status-timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { showToast } from '@/hooks/use-toast'
import { ArrowLeft, Pencil, RefreshCw, Trash2, Download, Printer, QrCode, Ban } from 'lucide-react'

const DELETABLE_STATUSES = ['DRAFT', 'VALIDATION_FAILED', 'REJECTED', 'EXPIRED', 'REPLACED', 'AWAITING_APPROVAL', 'CHANGES_REQUESTED', 'ARCHIVED']
const EDITABLE_STATUSES = ['DRAFT', 'VALIDATION_FAILED', 'CHANGES_REQUESTED', 'AWAITING_APPROVAL']

const statusLabels: Record<string, string> = {
  LIVE: 'Live',
  DRAFT: 'Draft',
  VALIDATION_IN_PROGRESS: 'Validation In Progress',
  AWAITING_APPROVAL: 'Awaiting Approval',
  VALIDATION_FAILED: 'Validation Failed',
  CHANGES_REQUESTED: 'Changes Requested',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  REPLACED: 'Replaced',
  ARCHIVED: 'Archived',
}

const offerTypeLabels: Record<string, string> = {
  FLAT: 'Flat Discount',
  PERCENTAGE: 'Percentage Off',
  BUY_X_GET_Y: 'Buy X Get Y',
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDate(date: string | Date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatDateTime(date: string | Date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, error } = useMerchantOfferById(id)
  const deleteOffer = useDeleteMerchantOffer()
  const revokeOffer = useRevokeMerchantOffer()
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [revokeReason, setRevokeReason] = useState('')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    )
  }

  if (error || !data?.data) {
    return <p className="py-12 text-center text-muted-foreground">Offer not found</p>
  }

  const offer = data.data

  return (
    <div className="space-y-6">
      <Link href="/merchant/offers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Offers
      </Link>

      {/* 1. Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{offer.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <StatusBadge
              status={offer.status}
              label={
                offer.status === 'ARCHIVED' && offer.reviewNotes
                  ? 'Revoked'
                  : statusLabels[offer.status]
              }
            />
            <span>Created {formatDateTime(offer.createdAt)}</span>
            <span>Updated {formatDateTime(offer.updatedAt)}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 sm:mt-0">
          {EDITABLE_STATUSES.includes(offer.status) && (
            <Link href={`/merchant/offers/${offer.id}/edit`}>
              <Button size="sm"><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
            </Link>
          )}
          {offer.status === 'LIVE' && (
            <>
              <Link href={`/merchant/offers/${offer.id}/replace`}>
                <Button size="sm"><RefreshCw className="mr-1 h-4 w-4" /> Replace</Button>
              </Link>
              <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setRevokeOpen(true)}>
                <Ban className="mr-1 h-4 w-4" /> Revoke
              </Button>
            </>
          )}
          {DELETABLE_STATUSES.includes(offer.status) && (
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 2. Offer Status Timeline */}
        <Card>
          <CardHeader><CardTitle>Offer Status</CardTitle></CardHeader>
          <CardContent>
            <OfferStatusTimeline
              currentStatus={offer.status}
              createdAt={offer.createdAt}
              submittedAt={offer.submittedAt}
              reviewedAt={offer.reviewedAt}
              liveAt={offer.liveAt}
              adminNote={offer.adminNote}
            />
          </CardContent>
        </Card>

        {/* 3. Approval Information */}
        <Card>
          <CardHeader><CardTitle>Approval Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span>{offer.submittedAt ? formatDateTime(offer.submittedAt) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reviewed</span>
              <span>{offer.reviewedAt ? formatDateTime(offer.reviewedAt) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Published</span>
              <span>{offer.liveAt ? formatDateTime(offer.liveAt) : '-'}</span>
            </div>
            {offer.rejectionReason && (
              <div>
                <span className="text-muted-foreground">Rejection Reason</span>
                <p className="mt-0.5 text-destructive">{offer.rejectionReason}</p>
              </div>
            )}
            {offer.adminNote && (
              <div>
                <span className="text-muted-foreground">Admin Note</span>
                <p className="mt-0.5">{offer.adminNote}</p>
              </div>
            )}
            {offer.status === 'ARCHIVED' && offer.reviewNotes && (
              <div>
                <span className="text-muted-foreground">Revocation Reason</span>
                <p className="mt-0.5 text-destructive">{offer.reviewNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 11. Analytics */}
        <Card>
          <CardHeader><CardTitle>Analytics</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Redemptions</span>
              <span className="font-medium">{offer.currentRedemptions}/{offer.maxRedemptions ?? '∞'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Views</span>
              <span className="font-medium">{offer.viewCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saves</span>
              <span className="font-medium">{offer.saveCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Offer Information + 5. Discount Details + 6. Validity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Offer Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {offer.shortDescription && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Short Description</p>
                <p className="mt-0.5 text-sm">{offer.shortDescription}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{offer.description}</p>
            </div>
            {offer.termsAndConditions && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Terms & Conditions</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{offer.termsAndConditions}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Discount Details */}
          <Card>
            <CardHeader><CardTitle>Discount Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Offer Type</span>
                <span className="font-medium">{offerTypeLabels[offer.offerType] ?? offer.offerType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount Value</span>
                <span className="font-medium">${Number(offer.discountValue).toFixed(2)}</span>
              </div>
              {offer.offerType === 'PERCENTAGE' && offer.discountPercent != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount Percent</span>
                  <span className="font-medium">{offer.discountPercent}%</span>
                </div>
              )}
              {offer.minimumSpend != null && Number(offer.minimumSpend) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Minimum Spend</span>
                  <span className="font-medium">${Number(offer.minimumSpend).toFixed(2)}</span>
                </div>
              )}
              {offer.discountMax != null && Number(offer.discountMax) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Maximum Discount</span>
                  <span className="font-medium">${Number(offer.discountMax).toFixed(2)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validity */}
          <Card>
            <CardHeader><CardTitle>Validity</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-medium">{formatDate(offer.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">End Date</span>
                <span className="font-medium">{formatDate(offer.endDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days Available</span>
                <span className="font-medium">
                  {Array.isArray(offer.daysOfWeek) && offer.daysOfWeek.length > 0
                    ? offer.daysOfWeek.map((d: number) => dayLabels[d]).join(', ')
                    : 'All days'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Featured</span>
                <span className="font-medium">{offer.isFeatured ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exclusive</span>
                <span className="font-medium">{offer.isExclusive ? 'Yes' : 'No'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 7. Redemption Settings */}
      {(offer.redemptionCode || offer.redemptionInstructions) && (
        <Card>
          <CardHeader><CardTitle>Redemption Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {offer.redemptionCode && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Redemption Code</p>
                <p className="mt-0.5 font-mono text-sm">{offer.redemptionCode}</p>
              </div>
            )}
            {offer.redemptionInstructions && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Instructions</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{offer.redemptionInstructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 7b. In-Store QR Code */}
      {offer.redemptionType === 'IN_STORE_QR' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" /> In-Store QR Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            {offer.qrCodeUrl ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={offer.qrCodeUrl}
                    alt="Offer QR Code"
                    className="h-48 w-48 rounded-md border object-contain"
                  />
                </div>
                <div className="flex justify-center gap-3">
                  <a
                    href={offer.qrCodeUrl}
                    download={`qr-${offer.title?.replace(/\s+/g, '-').toLowerCase()}.png`}
                  >
                    <Button size="sm" variant="outline">
                      <Download className="mr-1 h-4 w-4" /> Download PNG
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const w = window.open('', '_blank')
                      if (!w) return
                      w.document.write(`
                        <html>
                          <head><title>Print QR - ${offer.title}</title></head>
                          <body style="text-align:center;padding:40px;font-family:sans-serif;">
                            <h2>${offer.title}</h2>
                            <img src="${offer.qrCodeUrl}" style="width:300px;height:300px;object-contain;" />
                            <p style="margin-top:24px;color:#666;">Scan this QR code to redeem your offer.</p>
                            <script>
                              window.onload = function() { window.print(); window.close(); }
                            <\/script>
                          </body>
                        </html>
                      `)
                      w.document.close()
                    }}
                  >
                    <Printer className="mr-1 h-4 w-4" /> Print QR
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Employees scan this QR to access the offer and redeem it in-store.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <QrCode className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  QR code will be generated once the offer is submitted or approved.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 8. Images */}
      {Array.isArray(offer.imageUrls) && offer.imageUrls.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Images</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offer.imageUrls.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Offer image ${i + 1}`} className="rounded-md border object-cover" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 9. Validation Results */}
      {offer.validationErrors && typeof offer.validationErrors === 'object' && Object.keys(offer.validationErrors as object).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Validation Results</CardTitle></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded bg-destructive/10 p-3 text-xs text-destructive">
              {JSON.stringify(offer.validationErrors, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* 10. Replacement Information */}
      {offer.replacesOfferId && (
        <Card>
          <CardHeader><CardTitle>Replacement Information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              This offer was created as a replacement for a previous offer.
            </p>
            <Link
              href={`/merchant/offers/${offer.replacesOfferId}`}
              className="text-primary hover:underline"
            >
              View original offer
            </Link>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Offer"
        message={`Are you sure you want to delete "${offer.title}"? This will permanently remove the offer.`}
        confirmLabel="Delete"
        loading={deleteOffer.isPending}
        onConfirm={async () => {
          try {
            await deleteOffer.mutateAsync(offer.id)
            showToast({ type: 'success', title: 'Offer deleted' })
            router.push('/merchant/offers')
          } catch (err: any) {
            showToast({ type: 'error', title: 'Failed', description: err.message })
          } finally {
            setDeleteOpen(false)
          }
        }}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={revokeOpen}
        title="Revoke Offer"
        message={`Are you sure you want to revoke "${offer.title}"? This will deactivate the offer and it will no longer be visible to employees. You can delete it afterwards.`}
        confirmLabel="Revoke"
        loading={revokeOffer.isPending}
        onConfirm={async () => {
          if (!revokeReason.trim()) {
            showToast({ type: 'error', title: 'Required', description: 'Please provide a reason for revocation' })
            return
          }
          try {
            await revokeOffer.mutateAsync({ id: offer.id, reason: revokeReason.trim() })
            showToast({ type: 'success', title: 'Offer revoked' })
            setRevokeOpen(false)
            setRevokeReason('')
          } catch (err: any) {
            showToast({ type: 'error', title: 'Failed', description: err.message })
          }
        }}
        onCancel={() => { setRevokeOpen(false); setRevokeReason('') }}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Reason for revocation</label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Explain why you are revoking this offer..."
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}

'use client'

import { cn } from '@/utils/cn'

interface TimelineStep {
  status: string
  label: string
  timestamp: string | Date | null | undefined
  completed: boolean
  active: boolean
}

const statusFlow: Record<string, { label: string; completedIf: string[] }> = {
  DRAFT: { label: 'Draft', completedIf: ['DRAFT', 'VALIDATION_IN_PROGRESS', 'AWAITING_APPROVAL', 'CHANGES_REQUESTED', 'LIVE', 'REJECTED', 'VALIDATION_FAILED', 'ARCHIVED', 'EXPIRED', 'REPLACED'] },
  VALIDATION_IN_PROGRESS: { label: 'Validation', completedIf: ['VALIDATION_IN_PROGRESS', 'AWAITING_APPROVAL', 'CHANGES_REQUESTED', 'LIVE', 'REJECTED'] },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', completedIf: ['AWAITING_APPROVAL', 'CHANGES_REQUESTED', 'LIVE', 'REJECTED'] },
  LIVE: { label: 'Approved', completedIf: ['LIVE'] },
  REJECTED: { label: 'Rejected', completedIf: ['REJECTED'] },
  CHANGES_REQUESTED: { label: 'Changes Requested', completedIf: ['CHANGES_REQUESTED', 'AWAITING_APPROVAL', 'LIVE'] },
}

interface OfferStatusTimelineProps {
  currentStatus: string
  createdAt?: string | Date | null
  submittedAt?: string | Date | null
  reviewedAt?: string | Date | null
  liveAt?: string | Date | null
  adminNote?: string | null
}

export function OfferStatusTimeline({
  currentStatus,
  createdAt,
  submittedAt,
  reviewedAt,
  liveAt,
  adminNote,
}: OfferStatusTimelineProps) {
  const isRejected = currentStatus === 'REJECTED'
  const isLive = currentStatus === 'LIVE'
  const isChangesRequested = currentStatus === 'CHANGES_REQUESTED'

  const steps: TimelineStep[] = [
    {
      status: 'DRAFT',
      label: 'Draft',
      timestamp: createdAt,
      completed: true,
      active: currentStatus === 'DRAFT',
    },
    {
      status: 'VALIDATION_IN_PROGRESS',
      label: 'Validation',
      timestamp: submittedAt,
      completed: submittedAt != null,
      active: currentStatus === 'VALIDATION_IN_PROGRESS',
    },
    {
      status: 'AWAITING_APPROVAL',
      label: 'Awaiting Approval',
      timestamp: submittedAt,
      completed: reviewedAt != null || isLive || isRejected,
      active: currentStatus === 'AWAITING_APPROVAL' || currentStatus === 'CHANGES_REQUESTED',
    },
    ...(isLive || isRejected || isChangesRequested
      ? [
          {
            status: isLive ? 'LIVE' : isRejected ? 'REJECTED' : 'CHANGES_REQUESTED',
            label: isLive ? 'Approved' : isRejected ? 'Rejected' : 'Changes Requested',
            timestamp: reviewedAt || liveAt,
            completed: true,
            active: true,
          },
        ]
      : []),
  ]

  if (isLive) {
    steps.push({
      status: 'LIVE',
      label: 'Live',
      timestamp: liveAt,
      completed: true,
      active: true,
    })
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={step.status} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                step.active
                  ? 'bg-primary text-primary-foreground'
                  : step.completed
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {step.completed ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="h-full w-px bg-border" />
            )}
          </div>
          <div className="pb-4">
            <p className={cn('text-sm font-medium', step.active && 'text-primary')}>
              {step.label}
              {step.status === 'CHANGES_REQUESTED' && adminNote && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">— {adminNote}</span>
              )}
            </p>
            {step.timestamp && (
              <p className="text-xs text-muted-foreground">
                {new Date(step.timestamp).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

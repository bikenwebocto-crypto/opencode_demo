'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

type AlertVariant = 'info' | 'warning' | 'error' | 'success'

const variantStyles: Record<AlertVariant, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-700/50 dark:bg-blue-950/20 dark:text-blue-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-200',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-700/50 dark:bg-red-950/20 dark:text-red-200',
  success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-700/50 dark:bg-green-950/20 dark:text-green-200',
}

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  variant?: AlertVariant
  icon?: React.ElementType
  onClose?: () => void
}

export function Alert({
  title,
  description,
  variant = 'info',
  icon: Icon,
  onClose,
  className,
  children,
  ...props
}: AlertProps) {
  const [visible, setVisible] = React.useState(true)

  if (!visible) return null

  const handleClose = () => {
    setVisible(false)
    onClose?.()
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'group relative flex items-start gap-3 rounded-md border p-4',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {Icon ? (
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      ) : null}

      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-sm font-semibold">{title}</p>
        ) : null}

        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}

        {children}
      </div>

      <button
        type="button"
        onClick={handleClose}
        aria-label="Close alert"
        className="ml-auto rounded-md p-1 text-muted-foreground transition hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
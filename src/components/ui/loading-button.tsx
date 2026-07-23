'use client'

import { Button, type ButtonProps } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
  loadingText?: string
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading, loadingText, children, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        className={cn('relative', className)}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading && loadingText ? loadingText : children}
      </Button>
    )
  },
)
LoadingButton.displayName = 'LoadingButton'

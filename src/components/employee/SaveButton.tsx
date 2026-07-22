'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { showToast } from '@/hooks/use-toast'

interface Props {
  offerId: string
  initialSaved: boolean
  onToggle?: (saved: boolean) => void
  size?: 'sm' | 'md' | 'lg'
}

export function SaveButton({ offerId, initialSaved, onToggle, size = 'md' }: Props) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(initialSaved)

  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
  const buttonSize = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/employee/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to save')
      return json
    },
    onSuccess: () => {
      setSaved(true)
      // Always invalidate the saved list — that's a different query.
      queryClient.invalidateQueries({ queryKey: ['employee-saved'] })
      // Invalidate the dashboard stats counter (savedOffers count).
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard-stats'] })
      // If the host didn't pass `onToggle`, fall back to invalidating
      // the offers list (forces a refetch — slow).
      if (!onToggle) {
        queryClient.invalidateQueries({ queryKey: ['employee-offers'] })
      }
      onToggle?.(true)
      showToast({ type: 'success', title: 'Offer saved' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  const unsaveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employee/saved/${offerId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to unsave')
      return json
    },
    onSuccess: () => {
      setSaved(false)
      queryClient.invalidateQueries({ queryKey: ['employee-saved'] })
      queryClient.invalidateQueries({ queryKey: ['employee-dashboard-stats'] })
      if (!onToggle) {
        queryClient.invalidateQueries({ queryKey: ['employee-offers'] })
      }
      onToggle?.(false)
      showToast({ type: 'info', title: 'Removed from saved' })
    },
    onError: (e: any) => showToast({ type: 'error', title: 'Failed', description: e?.message }),
  })

  const loading = saveMutation.isPending || unsaveMutation.isPending

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (loading) return
        if (saved) unsaveMutation.mutate()
        else saveMutation.mutate()
      }}
      disabled={loading}
      aria-label={saved ? 'Unsave offer' : 'Save offer'}
      className={`inline-flex ${buttonSize} items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted disabled:opacity-50`}
    >
      <Heart
        className={`${iconSize} transition-colors ${
          saved ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
        }`}
      />
    </button>
  )
}

'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { showToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  APPLICATION_SUPPORT_CATEGORIES,
  getPriorityForCategory,
  PRIORITY_STYLES,
} from '@/features/complaints/constants'

export default function NewMerchantComplaintPage() {
  const router = useRouter()

  const [category, setCategory] = useState('TECHNICAL')
  const [description, setDescription] = useState('')

  // Priority is automatically determined by the selected category.
  const priority = getPriorityForCategory(category)

  const createAppSupport = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/complaints/application-support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(
          json.error?.message ?? 'Failed to submit'
        )
      }

      return json
    },

    onSuccess: () => {
      showToast({
        type: 'success',
        title: 'Ticket submitted',
        description: 'Your support ticket has been created.',
      })

      router.push('/merchant/complaints')
    },

    onError: (e: Error) => {
      showToast({
        type: 'error',
        title: 'Failed',
        description: e.message,
      })
    },
  })

  function handleSubmit() {
    if (!description.trim()) {
      showToast({
        type: 'error',
        title: 'Required',
        description: 'Please describe your issue.',
      })
      return
    }

    createAppSupport.mutate({
      category,
      description: description.trim(),
    })
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      router.push('/merchant/complaints')
    }
  }

  return (
    <div className="space-y-6">
      <Dialog open onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Application Support
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* Category */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Category
              </label>

              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={createAppSupport.isPending}
              >
                {APPLICATION_SUPPORT_CATEGORIES.map((c) => (
                  <option
                    key={c.value}
                    value={c.value}
                  >
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Priority
              </label>

              <div className="flex h-10 w-full items-center gap-2 rounded-md border bg-muted/30 px-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]}`}>
                  {priority}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Automatically determined by category
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Description *
              </label>

              <textarea
                rows={4}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue..."
                disabled={createAppSupport.isPending}
                required
              />
            </div>

          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push('/merchant/complaints')
              }
              disabled={createAppSupport.isPending}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                createAppSupport.isPending ||
                !description.trim()
              }
            >
              {createAppSupport.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit Ticket'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
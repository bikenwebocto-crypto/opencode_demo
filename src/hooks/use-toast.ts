'use client'
import { useEffect, useState, useCallback } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
}

let toastId = 0
const listeners: Set<(toasts: Toast[]) => void> = new Set()
let toasts: Toast[] = []

function notify() {
  const snapshot = [...toasts]
  listeners.forEach((fn) => fn(snapshot))
}

export function showToast(t: Omit<Toast, 'id'>) {
  const id = String(++toastId)
  toasts = [...toasts, { ...t, id }]
  notify()
  setTimeout(() => {
    toasts = toasts.filter((s) => s.id !== id)
    notify()
  }, 5000)
}

export function useToast() {
  const [state, setState] = useState<Toast[]>([])

  useEffect(() => {
    setState([...toasts])
    listeners.add(setState)
    return () => { listeners.delete(setState) }
  }, [])

  const dismiss = useCallback((id: string) => {
    toasts = toasts.filter((s) => s.id !== id)
    notify()
  }, [])

  return { toasts: state, dismiss }
}

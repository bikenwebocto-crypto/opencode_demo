'use client'

import { Edit3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EditableField } from './types'

interface EditFieldsFormProps {
  fields: EditableField[]
  entity: any
  edits: Record<string, unknown>
  setEdits: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void
}

function getCurrentValue(entity: any, key: string): string {
  const value = entity?.[key]
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  if (value instanceof Date) return new Date(value).toISOString().slice(0, 10)
  return String(value)
}

function isLongField(key: string) {
  return ['description', 'shortDescription', 'termsAndConditions', 'notes'].includes(key)
}

export function EditFieldsForm({ fields, entity, edits, setEdits }: EditFieldsFormProps) {
  if (fields.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Edit3 className="h-5 w-5" /> Edit Fields
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            const currentValue = edits[field.key] !== undefined
              ? edits[field.key]
              : getCurrentValue(entity, field.key)
            return (
              <div key={field.key} className={isLongField(field.key) ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {field.label}
                </label>
                {isLongField(field.key) ? (
                  <textarea
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={String(currentValue)}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={String(currentValue)}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Changes are applied when you click <strong>Edit &amp; Approve</strong> at the bottom of the page.
        </p>
      </CardContent>
    </Card>
  )
}

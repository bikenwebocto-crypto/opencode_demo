'use client'

import { useState } from 'react'

interface ColorPickerProps {
  label: string
  value: string
  onChange: (value: string) => void
}

const PRESET_COLORS = [
  '#4F46E5', '#7C3AED', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#6366F1',
  '#8B5CF6', '#F97316', '#14B8A6', '#3B82F6',
  '#1E293B', '#475569', '#94A3B8', '#000000',
]

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="h-9 w-9 shrink-0 rounded-md border shadow-sm"
            style={{ backgroundColor: value || '#ffffff' }}
            title="Pick a color"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        {isOpen && (
          <div className="absolute left-0 top-12 z-50 rounded-lg border bg-card p-3 shadow-lg">
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onChange(color)
                    setIsOpen(false)
                  }}
                  className="h-7 w-7 rounded-md border shadow-sm transition-transform hover:scale-110"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={value || '#000000'}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border"
              />
              <span className="text-xs text-muted-foreground">Custom</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

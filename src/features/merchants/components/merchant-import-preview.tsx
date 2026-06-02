'use client'
import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Upload, X, FileSpreadsheet } from 'lucide-react'

interface PreviewRow {
  row: number
  businessName: string
  email: string
  contactName: string
  hasPassword: boolean
  action: 'create' | 'skip'
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const header = lines[0]?.split(',').map((h) => h.trim().toLowerCase()) ?? []
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { values.push(current); current = ''; continue }
      current += ch
    }
    values.push(current)
    const row: Record<string, string> = {}
    header.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

interface MerchantImportPreviewProps {
  onImport: (file: File) => Promise<void>
  importing: boolean
}

export function MerchantImportPreview({ onImport, importing }: MerchantImportPreviewProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const summary = useMemo(() => {
    const create = previewRows.filter((r) => r.action === 'create').length
    const skip = previewRows.filter((r) => r.action === 'skip').length
    return { total: previewRows.length, create, skip }
  }, [previewRows])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const parsed = parseCSV(text)
      const preview: PreviewRow[] = parsed.map((row, idx) => {
        const email = (row.email ?? '').toLowerCase().trim()
        const hasPassword = (row.password ?? '').trim().length > 0
        const businessName = (row.businessname ?? row.businessName ?? '').trim()
        const contactName = (row.contactname ?? row.contactName ?? '').trim()
        const valid = businessName.length > 0 && email.length > 0 && contactName.length > 0
        return {
          row: idx + 1,
          businessName: businessName || email || '---',
          email: email || '---',
          contactName: contactName || '---',
          hasPassword,
          action: valid && hasPassword ? 'create' : 'skip',
        }
      })
      setFile(f)
      setPreviewRows(preview)
      setShowPreview(true)
    }
    reader.readAsText(f)
  }, [])

  const handleConfirm = async () => {
    if (!file) return
    setShowPreview(false)
    await onImport(file)
    setFile(null)
    setPreviewRows([])
  }

  const handleCancel = () => {
    setShowPreview(false)
    setFile(null)
    setPreviewRows([])
  }

  return (
    <>
      <input
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
        id="csv-import-input"
      />
      <Button variant="outline" onClick={() => document.getElementById('csv-import-input')?.click()} disabled={importing}>
        {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
        Import CSV
      </Button>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCancel}>
          <div className="mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Review Import — {file?.name}</h3>
              </div>
              <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex gap-3 px-6 py-3">
              <Card className="flex-1">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold">{summary.total}</p>
                  <p className="text-xs text-muted-foreground">Total rows</p>
                </CardContent>
              </Card>
              <Card className="flex-1 border-green-200">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{summary.create}</p>
                  <p className="text-xs text-muted-foreground">Ready to import</p>
                </CardContent>
              </Card>
              <Card className="flex-1 border-gray-200">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-gray-500">{summary.skip}</p>
                  <p className="text-xs text-muted-foreground">Will be skipped</p>
                </CardContent>
              </Card>
            </div>

            <p className="px-6 text-xs text-muted-foreground">
              Rows without a password or missing required fields (businessName, email, contactName) will be skipped.
              Existing records matched by email will be auto-detected during import.
            </p>

            <div className="flex-1 overflow-auto px-6 pt-3" style={{ maxHeight: '40vh' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">#</th>
                    <th className="pb-2 pr-2 font-medium">Business Name</th>
                    <th className="pb-2 pr-2 font-medium">Email</th>
                    <th className="pb-2 pr-2 font-medium">Contact</th>
                    <th className="pb-2 pr-2 font-medium">Password</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.row} className={`border-b last:border-0 hover:bg-muted/50 ${r.action === 'skip' ? 'text-muted-foreground' : ''}`}>
                      <td className="py-2 pr-2">{r.row}</td>
                      <td className="py-2 pr-2 font-medium">{r.businessName}</td>
                      <td className="py-2 pr-2">{r.email}</td>
                      <td className="py-2 pr-2">{r.contactName}</td>
                      <td className="py-2 pr-2">{r.hasPassword ? '✓' : '—'}</td>
                      <td className="py-2">
                        <Badge variant={r.action === 'create' ? 'success' : 'secondary'}>
                          {r.action === 'create' ? 'ready' : 'skipped'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button onClick={handleConfirm} disabled={summary.create === 0}>
                Import {summary.create} merchant{summary.create !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

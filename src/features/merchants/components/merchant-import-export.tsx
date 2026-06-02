'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { showToast } from '@/hooks/use-toast'
import { MerchantImportPreview } from './merchant-import-preview'

export function MerchantImportExport() {
  const [importing, setImporting] = useState(false)

  const handleExport = () => {
    window.open('/api/admin/merchants/export', '_blank')
  }

  const handleImport = async (file: File) => {
    setImporting(true)
    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/admin/merchants/import', { method: 'POST', body: form })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        showToast({
          type: d.imported > 0 ? 'success' : 'info',
          title: `Import: ${d.imported} imported, ${d.skipped} skipped, ${d.failed} failed`,
        })
        window.location.reload()
      } else {
        showToast({ type: 'error', title: 'Import failed', description: json.error?.message })
      }
    } catch {
      showToast({ type: 'error', title: 'Import failed', description: 'Network error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleExport}>
        <Download className="mr-1 h-4 w-4" /> Export CSV
      </Button>
      <MerchantImportPreview onImport={handleImport} importing={importing} />
    </div>
  )
}

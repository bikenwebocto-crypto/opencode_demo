'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { CSVUploadDropzone } from '@/features/csv-uploads/components/csv-upload-dropzone'
import { CSVUploadTable } from '@/features/csv-uploads/components/csv-upload-table'

const initialUploads = [
  { id: 'up-001', filename: 'employees_techcorp.csv', status: 'COMPLETED', totalRows: 245, successCount: 243, errorCount: 2, uploadedAt: '2026-05-27T10:30:00' },
  { id: 'up-002', filename: 'merchants_batch_1.csv', status: 'COMPLETED', totalRows: 50, successCount: 48, errorCount: 2, uploadedAt: '2026-05-26T14:15:00' },
  { id: 'up-003', filename: 'employees_globalsolutions.csv', status: 'PROCESSING', totalRows: 89, successCount: 0, errorCount: 0, uploadedAt: '2026-05-28T09:00:00' },
  { id: 'up-004', filename: 'merchants_batch_2.csv', status: 'FAILED', totalRows: 30, successCount: 0, errorCount: 30, uploadedAt: '2026-05-25T11:45:00' },
  { id: 'up-005', filename: 'offers_spring_campaign.csv', status: 'COMPLETED', totalRows: 15, successCount: 15, errorCount: 0, uploadedAt: '2026-05-24T08:00:00' },
]

export default function CSVUploadsPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploads, setUploads] = useState(initialUploads)

  const handleUpload = (_file: File) => {
    setIsUploading(true)
    setTimeout(() => {
      const newUpload = {
        id: `up-${Date.now()}`,
        filename: _file.name,
        status: 'COMPLETED',
        totalRows: 0,
        successCount: 0,
        errorCount: 0,
        uploadedAt: new Date().toISOString(),
      }
      setUploads((prev) => [newUpload, ...prev])
      setIsUploading(false)
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="CSV Uploads" description="Import employees and merchants via CSV files" />
      <CSVUploadDropzone onUpload={handleUpload} isUploading={isUploading} />
      <div>
        <h2 className="mb-3 text-lg font-semibold">Upload History</h2>
        <CSVUploadTable uploads={uploads} />
      </div>
    </div>
  )
}

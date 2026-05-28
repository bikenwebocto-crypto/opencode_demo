'use client'
import { useRef, useCallback } from 'react'
import { Upload } from 'lucide-react'

interface CSVUploadDropzoneProps {
  onUpload: (file: File) => void
  isUploading?: boolean
  acceptedFormats?: string
}

export function CSVUploadDropzone({ onUpload, isUploading, acceptedFormats = '.csv' }: CSVUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
      e.target.value = ''
    }
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      onUpload(file)
    }
  }, [onUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-muted-foreground/50"
    >
      <input ref={inputRef} type="file" accept={acceptedFormats} className="hidden" onChange={handleChange} disabled={isUploading} />
      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{isUploading ? 'Uploading...' : 'Drag and drop or click to browse'}</p>
      <p className="mt-1 text-xs text-muted-foreground">Accepted format: {acceptedFormats}</p>
    </div>
  )
}

import type { UploadConfig, UploadResult } from '@/types'

export class UploadService {
  async upload(
    file: File,
    config: UploadConfig,
    pathParams: Record<string, string>
  ): Promise<UploadResult> {
    this.validateFile(file, config)

    const path = this.resolvePath(config.path, pathParams)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', path)
    formData.append('bucket', config.bucket)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error?.message ?? 'Upload failed')
    }
    const json = await res.json()
    return {
      url: json.url ?? '',
      path,
      size: file.size,
      mimeType: file.type,
    }
  }

  async getPublicUrl(bucket: string, path: string): Promise<string> {
    return `/api/upload/public?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`
  }

  async delete(bucket: string, path: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`/api/upload?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { success: false, error: body.error?.message ?? 'Delete failed' }
    }
    return { success: true }
  }

  private validateFile(file: File, config: UploadConfig): void {
    if (config.maxSizeBytes && file.size > config.maxSizeBytes) {
      throw new Error(`File too large. Max ${config.maxSizeBytes} bytes`)
    }
    if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} not allowed`)
    }
  }

  private resolvePath(template: string, params: Record<string, string>): string {
    return Object.entries(params).reduce(
      (p, [k, v]) => p.replace(`{${k}}`, v),
      template
    )
  }
}
export const uploadService = new UploadService()

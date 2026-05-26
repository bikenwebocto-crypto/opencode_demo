import { createClient } from '@/lib/supabase/client'
import type { UploadConfig, UploadResult } from '@/types'

export class UploadService {
  async upload(
    file: File,
    config: UploadConfig,
    pathParams: Record<string, string>
  ): Promise<UploadResult> {
    this.validateFile(file, config)

    const path = this.resolvePath(config.path, pathParams)
    const supabase = createClient()

    const { data, error } = await supabase.storage
      .from(config.bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      })

    if (error) throw new Error(`Upload failed: ${error.message}`)

    const { data: urlData } = supabase.storage
      .from(config.bucket)
      .getPublicUrl(data.path)

    return {
      url: urlData.publicUrl,
      path: data.path,
      size: file.size,
      mimeType: file.type,
    }
  }

  async getSignedUploadUrl(
    config: UploadConfig,
    pathParams: Record<string, string>,
    expiresIn = 60
  ): Promise<string> {
    const path = this.resolvePath(config.path, pathParams)
    const supabase = createClient()

    const { data, error } = await supabase.storage
      .from(config.bucket)
      .createSignedUploadUrl(path, { upsert: true })

    if (error) throw new Error(`Signed URL generation failed: ${error.message}`)
    return data.signedUrl
  }

  async delete(path: string, bucket: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) throw new Error(`Delete failed: ${error.message}`)
  }

  private validateFile(file: File, config: UploadConfig): void {
    if (file.size > config.maxSizeBytes) {
      const maxMB = config.maxSizeBytes / (1024 * 1024)
      throw new Error(`File too large. Maximum size is ${maxMB}MB`)
    }
    if (!config.allowedMimeTypes.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed: ${config.allowedMimeTypes.join(', ')}`)
    }
  }

  private resolvePath(template: string, params: Record<string, string>): string {
    let resolved = template
    for (const [key, value] of Object.entries(params)) {
      resolved = resolved.replace(`{${key}}`, value)
    }
    return `${resolved}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  }
}

export const uploadService = new UploadService()

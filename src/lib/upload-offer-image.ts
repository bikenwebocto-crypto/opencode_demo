import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'

export async function uploadOfferImage(file: File): Promise<string> {
  const supabase = createClient()
  console.log('storeage ** :',supabase);
  const ext = file.name.split('.').pop() || 'jpg'
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const path = `offer-images/${timestamp}-${random}.${ext}`
  const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession();

console.log("Session:", session);
console.log("Session Error:", sessionError);

const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

console.log("User:", user);
console.log("User Error:", userError);   
  const { error } = await supabase.storage
    .from('offer-images')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
    console.log('upload failed :', error);
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: urlData } = supabase.storage
    .from('offer-images')
    .getPublicUrl(path)

    console.log('abv #',urlData);
  return urlData.publicUrl

}

export async function deleteOfferImage(url: string): Promise<void> {
  try {
    const supabase = createClient()
    const urlObj = new URL(url)
    const segments = urlObj.pathname.split('/')
    const bucketIndex = segments.findIndex((s) => s === 'offer-images')
    if (bucketIndex === -1) return
    const path = segments.slice(bucketIndex).join('/')
    await supabase.storage.from('offer-images').remove([path])
  } catch {
    // Silently fail — stale references are harmless
  }
}

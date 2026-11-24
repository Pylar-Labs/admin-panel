'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload, X } from 'lucide-react'
import { cn, saveErrorMessage } from '@/lib/utils'
import Image from 'next/image'

interface ImageUploadProps {
  bucket: string
  path: string
  currentUrl: string | null
  label: string
  onUpload: (url: string) => void
}

export function ImageUpload({ bucket, path, currentUrl, label, onUpload }: ImageUploadProps) {
  // Muestra siempre lo que le pasa el padre: una imagen guardada que llega después de montarse también se ve.
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo tiene que ser una imagen.')
      return
    }
    setUploading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (error) throw error

      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      onUpload(`${data.publicUrl}?t=${Date.now()}`)
    } catch (e) {
      toast.error(saveErrorMessage((e as { message?: string }).message))
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  function handleClear() {
    onUpload('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-700">{label}</p>

      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors cursor-pointer',
          'min-h-[140px]',
          isDragging ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400',
          uploading && 'pointer-events-none opacity-60'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {uploading && (
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-xs">Subiendo...</span>
          </div>
        )}

        {!uploading && currentUrl && (
          <>
            <div className="relative w-full h-36 overflow-hidden rounded-lg">
              <Image src={currentUrl} alt={label} fill className="object-contain p-2" unoptimized />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear() }}
              className="absolute top-2 right-2 rounded-full bg-white p-1 shadow hover:bg-red-50"
              aria-label="Eliminar imagen"
            >
              <X size={14} className="text-zinc-500" />
            </button>
          </>
        )}

        {!uploading && !currentUrl && (
          <div className="flex flex-col items-center gap-2 text-zinc-400 px-4 py-6">
            <Upload size={22} />
            <span className="text-xs text-center">Hacé clic o arrastrá una imagen aquí</span>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  )
}

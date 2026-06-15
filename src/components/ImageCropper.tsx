"use client"

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'

type Area = { x: number; y: number; width: number; height: number }

// Crops `file` to the given pixel area, scaling down so the longest edge is at
// most 1600px, and returns a JPEG File ready to upload.
async function cropToFile(src: string, area: Area, name: string): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

  const MAX = 1600
  const scale = Math.min(1, MAX / Math.max(area.width, area.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width * scale)
  canvas.height = Math.round(area.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.9)
  )
  const base = name.replace(/\.[^.]+$/, '')
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
}

export default function ImageCropper({
  file,
  index,
  total,
  aspect = 4 / 3,
  onDone,
  onCancel,
}: {
  file: File
  index: number
  total: number
  aspect?: number
  onDone: (cropped: File) => void
  onCancel: () => void
}) {
  const [src] = useState(() => URL.createObjectURL(file))
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setAreaPixels(pixels), [])

  const handleDone = async () => {
    if (!areaPixels) return
    setSaving(true)
    try {
      const cropped = await cropToFile(src, areaPixels, file.name)
      URL.revokeObjectURL(src)
      onDone(cropped)
    } catch {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    URL.revokeObjectURL(src)
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <div>
            <h3 className="text-[15px] font-semibold text-[#111111]">Frame your photo</h3>
            <p className="text-[12px] text-[#6B6B6B]">Photo {index + 1} of {total} · drag to reposition, slider to zoom</p>
          </div>
          <button onClick={handleCancel} aria-label="Skip photo" className="w-8 h-8 rounded-full hover:bg-[#F5F5F3] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="relative bg-[#0E0E0E]" style={{ aspectRatio: String(aspect) }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <input
              type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#111111] cursor-pointer"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleCancel} className="flex-1 py-3 rounded-xl border border-[#E5E5E5] text-[14px] font-medium text-[#6B6B6B] hover:border-[#111111] transition-colors">Skip</button>
            <button onClick={handleDone} disabled={saving || !areaPixels} className="flex-1 py-3 rounded-xl bg-[#111111] text-white text-[14px] font-semibold hover:bg-[#333] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Use photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

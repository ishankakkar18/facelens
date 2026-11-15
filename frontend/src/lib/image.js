function loadImage(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file)
  }
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    image.src = url
  })
}

export async function compressImage(file, { maxSize = 1400, quality = 0.85 } = {}) {
  if (!file || !file.type.startsWith('image/') || file.type === 'image/gif') {
    return file
  }

  try {
    const bitmap = await loadImage(file)
    const width = bitmap.width || bitmap.naturalWidth
    const height = bitmap.height || bitmap.naturalHeight
    const scale = Math.min(1, maxSize / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, targetWidth, targetHeight)
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return file

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

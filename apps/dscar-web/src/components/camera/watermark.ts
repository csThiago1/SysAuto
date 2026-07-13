/**
 * Marca d'água de evidência (data/hora + linhas extras) — desenhada no
 * device ANTES do upload; fotos de OS são imutáveis (seguradoras).
 */

export function drawWatermark(canvas: HTMLCanvasElement, lines: string[]): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const fontSize = Math.max(14, Math.round(canvas.width / 45))
  const pad = fontSize
  const lineHeight = fontSize * 1.4
  const all = [new Date().toLocaleString("pt-BR"), ...lines]

  ctx.font = `${fontSize}px sans-serif`
  const boxWidth = Math.max(...all.map((l) => ctx.measureText(l).width)) + pad * 2
  const boxHeight = all.length * lineHeight + pad

  ctx.fillStyle = "rgba(0,0,0,0.55)"
  ctx.fillRect(0, canvas.height - boxHeight, boxWidth, boxHeight)
  ctx.fillStyle = "#fff"
  all.forEach((line, i) => {
    ctx.fillText(line, pad, canvas.height - boxHeight + pad * 0.5 + (i + 0.8) * lineHeight - lineHeight * 0.4)
  })
}

/**
 * Aplica a marca d'água em um File de imagem (ex: foto da câmera nativa
 * via input capture) e devolve um JPEG novo. EXIF de orientação é
 * respeitado via createImageBitmap.
 */
export async function watermarkFile(file: File, lines: string[] = []): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    drawWatermark(canvas, lines)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    )
    if (!blob) return file
    return new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" })
  } catch {
    return file // ponytail: foto sem marca é melhor que foto nenhuma (fallback igual ao app RN)
  }
}

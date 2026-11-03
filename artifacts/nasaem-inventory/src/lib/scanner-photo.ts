import type { BrowserMultiFormatReader } from '@zxing/browser';
import { ChecksumException, FormatException, NotFoundException } from '@zxing/library';

function canvasWithContext(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Unable to process barcode image');
  return { canvas, context };
}

export function captureBarcodeFrame(video: HTMLVideoElement): HTMLCanvasElement {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error('Camera frame is not ready');
  }
  const { canvas, context } = canvasWithContext(video.videoWidth, video.videoHeight);
  // Native camera pixels, never digital zoom or CSS screenshot scaling.
  context.drawImage(video, 0, 0);
  return canvas;
}

export async function decodeLiveBarcodeFrame(video: HTMLVideoElement): Promise<string | null> {
  const source = captureBarcodeFrame(video);
  const scale = Math.min(1, 1920 / Math.max(source.width, source.height));
  const { canvas, context } = canvasWithContext(source.width * scale, source.height * scale);
  // Scan the complete natural frame, independently of the guide and CSS backdrop.
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const { decodeDetailedImage } = await import('./scanner-decoder');
  return decodeDetailedImage(context.getImageData(0, 0, canvas.width, canvas.height));
}

export function clarifyBarcodeImage(source: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, context } = canvasWithContext(source.width, source.height);
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = image;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) / 256;
  }
  // Mild unsharp masking and contrast, not generative reconstruction of bars.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const center = gray[i];
      const sharpened = x && y && x < width - 1 && y < height - 1
        ? center * 3 - (gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width]) * 0.5
        : center;
      const value = (sharpened - 128) * 1.2 + 128;
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function centerStrip(source: HTMLCanvasElement) {
  const { canvas, context } = canvasWithContext(source.width * 0.84, source.height * 0.6);
  context.drawImage(source, (source.width - canvas.width) / 2, (source.height - canvas.height) / 2,
    canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function rotated(source: HTMLCanvasElement) {
  const { canvas, context } = canvasWithContext(source.height, source.width);
  context.translate(canvas.width, 0);
  context.rotate(Math.PI / 2);
  context.drawImage(source, 0, 0);
  return canvas;
}

export async function decodeBarcodeCanvas(reader: BrowserMultiFormatReader, source: HTMLCanvasElement): Promise<string> {
  const scale = Math.min(1, 2560 / Math.max(source.width, source.height));
  const { canvas, context } = canvasWithContext(source.width * scale, source.height * scale);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const strip = centerStrip(canvas);
  const { decodeDetailedImage } = await import('./scanner-decoder');
  // Full original remains a candidate: the guide is not an exclusion zone.
  const candidates = [
    () => canvas, () => strip, () => clarifyBarcodeImage(strip),
    () => clarifyBarcodeImage(canvas), () => rotated(canvas), () => rotated(strip),
  ];
  for (const candidate of candidates) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const image = candidate();
    const imageContext = image.getContext('2d', { willReadFrequently: true });
    if (!imageContext) throw new Error('Unable to process barcode image');
    const detailedCode = await decodeDetailedImage(imageContext.getImageData(0, 0, image.width, image.height));
    if (detailedCode) return detailedCode;
    try {
      const code = reader.decodeFromCanvas(image).getText().trim();
      if (code) return code;
    } catch (error) {
      if (!(error instanceof NotFoundException) && !(error instanceof ChecksumException) && !(error instanceof FormatException)) throw error;
    }
  }
  throw new NotFoundException('No readable barcode in this image');
}

export async function decodeBarcodePhoto(reader: BrowserMultiFormatReader, imageUrl: string): Promise<string> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to load barcode photo'));
    image.src = imageUrl;
  });
  const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
  const { canvas, context } = canvasWithContext(image.naturalWidth * scale, image.naturalHeight * scale);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return decodeBarcodeCanvas(reader, canvas);
}

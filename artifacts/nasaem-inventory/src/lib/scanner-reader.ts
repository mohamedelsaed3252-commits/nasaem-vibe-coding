import { BrowserMultiFormatReader } from '@zxing/browser';
import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource } from '@zxing/library';

// Avoid the browser wrapper's broken temporary-canvas rotation path.
// Still-photo rotation is handled explicitly by scanner-photo.
export class CameraBarcodeReader extends BrowserMultiFormatReader {
  override decodeFromCanvas(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Unable to read camera frame');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const gray = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let i = 0; i < gray.length; i++) {
      const offset = i * 4;
      gray[i] = data[offset + 3] === 0 ? 255
        : (data[offset] * 306 + data[offset + 1] * 601 + data[offset + 2] * 117 + 512) >> 10;
    }
    return this.decodeBitmap(new BinaryBitmap(new HybridBinarizer(
      new RGBLuminanceSource(gray, canvas.width, canvas.height),
    )));
  }
}

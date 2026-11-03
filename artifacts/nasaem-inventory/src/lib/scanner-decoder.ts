import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

// Serve the decoder from the app, never a CDN: the shop must work locally.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => path.endsWith('.wasm') ? wasmUrl : prefix + path,
  },
});

export async function decodeDetailedImage(image: ImageData): Promise<string | null> {
  const results = await readBarcodes(image, { tryHarder: true, maxNumberOfSymbols: 1 });
  return results.find(result => result.isValid && result.text.trim())?.text.trim() ?? null;
}

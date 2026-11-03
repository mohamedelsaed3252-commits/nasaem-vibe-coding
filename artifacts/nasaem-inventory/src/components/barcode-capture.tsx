import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { DecodeHintType, NotFoundException } from '@zxing/library';
import { Barcode, Camera, Flashlight, FlashlightOff, Focus, RotateCcw, X } from 'lucide-react';
import { improveCameraFocus } from '@/lib/scanner-camera';
import { captureBarcodeFrame, decodeBarcodeCanvas, decodeBarcodePhoto, decodeLiveBarcodeFrame } from '@/lib/scanner-photo';
import { CameraBarcodeReader } from '@/lib/scanner-reader';

function createReader() {
  return new CameraBarcodeReader(new Map([[DecodeHintType.TRY_HARDER, true]]), {
    delayBetweenScanAttempts: 180,
    delayBetweenScanSuccess: 500,
  });
}

export type BarcodeCaptureProps = {
  disabled?: boolean;
  /** Return a user-facing error when a readable code cannot be accepted. */
  onDecoded: (code: string) => void | string;
  onError: (message: string) => void;
};

export function BarcodeCapture({ disabled = false, onDecoded, onError }: BarcodeCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoBackdropRef = useRef<HTMLVideoElement>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const hintTimeoutRef = useRef<number | undefined>(undefined);
  const resultTimeoutRef = useRef<number | undefined>(undefined);
  const scanSessionRef = useRef(0);
  const didDecodeRef = useRef(false);
  const onDecodedRef = useRef(onDecoded);
  const onErrorRef = useRef(onError);
  const [scanning, setScanning] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [status, setStatus] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const [hasCapture, setHasCapture] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [deviceMode, setDeviceMode] = useState(false);
  const [feedback, setFeedback] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    onDecodedRef.current = onDecoded;
    onErrorRef.current = onError;
  }, [onDecoded, onError]);

  useEffect(() => {
    if (disabled && scanning) setScanning(false);
  }, [disabled, scanning]);

  useEffect(() => {
    if (deviceMode && !scanning && !disabled) deviceInputRef.current?.focus();
  }, [deviceMode, scanning, disabled]);

  useEffect(() => {
    if (statusIsError) setFeedback('error');
  }, [statusIsError, status]);

  function acceptCode(code: string) {
    try {
      const message = onDecodedRef.current(code);
      if (message) {
        setStatus(message);
        setStatusIsError(true);
        setFeedback('error');
        return false;
      }
      setStatus(`تم قبول الباركود: ${code}`);
      setStatusIsError(false);
      setFeedback('success');
      return true;
    } catch {
      const message = 'تعذر استخدام الباركود. أعد المحاولة وتحقق من بيانات الصنف.';
      setStatus(message);
      setStatusIsError(true);
      setFeedback('error');
      onErrorRef.current(message);
      return false;
    }
  }

  function finishLiveRead(code: string) {
    if (didDecodeRef.current) return;
    didDecodeRef.current = true;
    window.clearTimeout(hintTimeoutRef.current);
    window.clearTimeout(resultTimeoutRef.current);
    const accepted = acceptCode(code);
    // Keep the live preview visible long enough to see the result colour.
    resultTimeoutRef.current = window.setTimeout(() => {
      if (accepted) stopLiveScan();
      else {
        didDecodeRef.current = false;
        setFeedback('idle');
      }
    }, accepted ? 1000 : 1800);
  }

  useEffect(() => {
    if (!scanning) return;
    const session = ++scanSessionRef.current;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      const message = 'المسح المباشر يحتاج فتح الموقع عبر اتصال آمن (HTTPS). استخدم التقاط صورة أو افتح رابط HTTPS.';
      setScanning(false);
      setStatus(message);
      setStatusIsError(true);
      onErrorRef.current(message);
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setScanning(false);
      return;
    }

    let cancelled = false;
    let scannerControls: IScannerControls | null = null;
    let detailedScanTimer: number | undefined;
    let detailedScanFailed = false;
    const reader = createReader();
    didDecodeRef.current = false;
    setTorchAvailable(false);
    setTorchOn(false);
    setCameraReady(false);
    setCameraBusy(false);
    setFeedback('idle');
    setStatus('جارٍ تشغيل الكاميرا. اسمح للمتصفح باستخدامها إذا طلب ذلك.');
    setStatusIsError(false);

    const timeoutId = window.setTimeout(() => {
      setStatus('ضع الباركود كاملًا أمام الشريط وثبّت الهاتف. لو الصورة ضبابية اضغط «توضيح وقراءة الباركود»، أو ابعد الهاتف قليلًا.');
    }, 12000);
    hintTimeoutRef.current = timeoutId;

    async function scanDetailedFrame() {
      if (cancelled || scanSessionRef.current !== session) return;
      if (!didDecodeRef.current && video && video.readyState >= 2 && video.videoWidth) {
        try {
          const code = await decodeLiveBarcodeFrame(video);
          if (!cancelled && scanSessionRef.current === session && !didDecodeRef.current && code) finishLiveRead(code);
        } catch (error) {
          // No readable symbol is a normal null result, not an exception.
          if (!cancelled && scanSessionRef.current === session && !didDecodeRef.current && !detailedScanFailed) {
            detailedScanFailed = true;
            console.warn('High-accuracy live barcode reader unavailable', error);
            setStatus('تعذرت القراءة المحسنة. الماسح الأساسي ما زال يعمل؛ جرّب «توضيح وقراءة الباركود» أو أعد تشغيل الكاميرا.');
            setStatusIsError(true);
          }
        }
      }
      // Schedule after completion, never overlap expensive high-resolution reads.
      if (!cancelled && scanSessionRef.current === session) detailedScanTimer = window.setTimeout(scanDetailedFrame, 1100);
    }

    reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      },
      video,
      (result) => {
        if (cancelled || scanSessionRef.current !== session || !result || didDecodeRef.current) return;
        const code = result.getText().trim();
        if (!code) return;

        finishLiveRead(code);
      },
    ).then((controls) => {
      scannerControls = controls;
      if (cancelled || scanSessionRef.current !== session) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      detailedScanTimer = window.setTimeout(scanDetailedFrame, 350);
      const stream = video.srcObject as MediaStream | null;
      const backdrop = videoBackdropRef.current;
      if (stream && backdrop) {
        backdrop.srcObject = stream;
      }
      const track = stream?.getVideoTracks()[0];
      if (track) {
        cameraTrackRef.current = track;
        setCameraReady(true);
        setCameraBusy(true);
        void improveCameraFocus(track).finally(() => {
          if (!cancelled && cameraTrackRef.current === track) setCameraBusy(false);
        });
      }
      const hasTorch = typeof controls.switchTorch === 'function';
      setTorchAvailable(hasTorch);
      if (!didDecodeRef.current) setStatus(hasTorch
        ? 'ضع الباركود أمام الشريط. التركيز تلقائي عند دعم الكاميرا، ويمكنك تشغيل الفلاش أو توضيح لقطة ثابتة.'
        : 'ضع الباركود أمام الشريط، واضغط «توضيح وقراءة الباركود» لو تأخرت القراءة. الفلاش غير متاح من هذه الكاميرا أو المتصفح.');
    }).catch((error: unknown) => {
      window.clearTimeout(timeoutId);
      if (cancelled || scanSessionRef.current !== session) return;
      const name = error instanceof DOMException ? error.name : '';
      let message = 'تعذر تشغيل الكاميرا. تحقق من أذونات المتصفح ثم أعد المحاولة.';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        message = 'لم تسمح للمتصفح باستخدام الكاميرا. فعّل إذن الكاميرا من إعدادات الموقع ثم أعد المحاولة.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        message = 'لم يتم العثور على كاميرا في هذا الجهاز.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        message = 'الكاميرا مستخدمة من تطبيق آخر. أغلقه ثم أعد المحاولة.';
      } else if (name === 'SecurityError') {
        message = 'المسح المباشر يحتاج فتح الموقع عبر اتصال آمن (HTTPS). استخدم التقاط صورة أو افتح رابط HTTPS.';
      }
      setScanning(false);
      setStatus(message);
      setStatusIsError(true);
      onErrorRef.current(message);
    });

    return () => {
      cancelled = true;
      if (scanSessionRef.current === session) scanSessionRef.current++;
      window.clearTimeout(timeoutId);
      window.clearTimeout(resultTimeoutRef.current);
      window.clearTimeout(detailedScanTimer);
      scannerControls?.stop();
      controlsRef.current?.stop();
      controlsRef.current = null;
      cameraTrackRef.current = null;
      if (videoBackdropRef.current) videoBackdropRef.current.srcObject = null;
    };
  }, [scanning]);

  function startLiveScan() {
    if (disabled || decoding || scanning) return;
    setStatus('');
    setStatusIsError(false);
    setFeedback('idle');
    setDeviceMode(false);
    setScanning(true);
  }

  function stopLiveScan() {
    // Invalidate in-flight asynchronous reads before React runs effect cleanup.
    scanSessionRef.current++;
    window.clearTimeout(hintTimeoutRef.current);
    window.clearTimeout(resultTimeoutRef.current);
    controlsRef.current?.stop();
    controlsRef.current = null;
    cameraTrackRef.current = null;
    setScanning(false);
    setTorchAvailable(false);
    setTorchOn(false);
  }

  async function toggleTorch() {
    const controls = controlsRef.current;
    if (!controls?.switchTorch || torchBusy || cameraBusy || disabled) return;

    setTorchBusy(true);
    try {
      await controls.switchTorch(!torchOn);
      if (controlsRef.current === controls) {
        setTorchOn(!torchOn);
        setStatus(!torchOn ? 'الفلاش يعمل الآن.' : 'تم إيقاف الفلاش.');
        setStatusIsError(false);
      }
    } catch {
      if (controlsRef.current === controls) {
        setStatus('تعذر تغيير الفلاش. جرّب إعادة تشغيل المسح أو استخدم إضاءة خارجية.');
        setStatusIsError(true);
      }
    } finally {
      setTorchBusy(false);
    }
  }

  async function clarifyAndRead() {
    const track = cameraTrackRef.current;
    const video = videoRef.current;
    if (!track || !video || cameraBusy || torchBusy || disabled) return;
    window.clearTimeout(hintTimeoutRef.current);
    setCameraBusy(true);
    setStatus('ثبّت الهاتف لحظة؛ جارٍ ضبط التركيز وتحسين تباين لقطة ثابتة وقراءتها…');
    setStatusIsError(false);
    try {
      await improveCameraFocus(track, true);
      await new Promise(resolve => window.setTimeout(resolve, 650));
      if (cameraTrackRef.current !== track || didDecodeRef.current) return;
      const code = await decodeBarcodeCanvas(createReader(), captureBarcodeFrame(video));
      if (cameraTrackRef.current !== track || didDecodeRef.current) return;
      finishLiveRead(code);
    } catch {
      if (cameraTrackRef.current === track) {
        setStatus('اللقطة ما زالت غير مقروءة. ثبّت الهاتف وابعده قليلًا، أو أوقف المسح واختر «التقاط صورة» لاستخدام كاميرا الهاتف الأصلية.');
        setStatusIsError(true);
      }
    } finally {
      if (cameraTrackRef.current === track) {
        await improveCameraFocus(track);
        if (cameraTrackRef.current === track) setCameraBusy(false);
      }
    }
  }

  function submitManualCode() {
    if (disabled || scanning || decoding) return;
    const code = manualCode.trim();
    if (!code) {
      const message = 'امسح الرمز باستخدام قارئ USB أو أدخله في الخانة أولًا.';
      setStatus(message);
      setStatusIsError(true);
      return;
    }
    if (acceptCode(code)) setManualCode('');
    else deviceInputRef.current?.select();
    deviceInputRef.current?.focus();
  }

  function cancelCapture() {
    if (decoding || disabled) return;
    setHasCapture(false);
    setStatus('');
    setStatusIsError(false);
    setFeedback('idle');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleCapture(event: ChangeEvent<HTMLInputElement>) {
    const image = event.currentTarget.files?.[0];
    if (!image || disabled) return;

    setHasCapture(true);
    setDecoding(true);
    setFeedback('idle');
    setStatus('جارٍ قراءة الرمز من الصورة…');
    setStatusIsError(false);

    let decodedCode: string | null = null;
    try {
      const reader = createReader();
      const imageUrl = URL.createObjectURL(image);
      try {
        decodedCode = await decodeBarcodePhoto(reader, imageUrl);
        if (!decodedCode) throw new NotFoundException();
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (error) {
      const message = error instanceof NotFoundException
        ? 'لم يظهر رمز شريطي واضح في الصورة. جرّب تصوير الرمز عن قرب وبإضاءة جيدة.'
        : 'تعذرت قراءة الصورة. أعد المحاولة أو أدخل رمز المنتج يدويًا.';
      setStatus(message);
      setStatusIsError(true);
      onError(message);
    } finally {
      setDecoding(false);
    }
    if (decodedCode) {
      acceptCode(decodedCode);
    }
  }

  function openImageCapture() {
    if (disabled || decoding || scanning) return;
    setStatus('');
    setStatusIsError(false);
    if (inputRef.current) inputRef.current.value = '';
    inputRef.current?.click();
  }

  return (
    <div className="nasaem-barcode" dir="rtl" data-result={feedback}>
      <style>{`
        .nasaem-barcode { display:grid; gap:10px; min-width:0; }
        .nasaem-barcode__input { position:absolute; width:1px; height:1px; padding:0; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; clip-path:inset(50%); }
        .nasaem-barcode__actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
        .nasaem-barcode__capture { min-height:42px; }
        .nasaem-barcode__capture svg { width:17px; height:17px; }
        .nasaem-barcode__cancel { min-height:40px; }
        .nasaem-barcode__torch-actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-start; margin:0 0 8px; }
        .nasaem-barcode__torch { min-height:44px; }
        .nasaem-barcode__video-wrap { position:relative; isolation:isolate; width:calc(100% + 32px); max-width:calc(100vw - 26px); margin-inline:-16px; overflow:hidden; border-radius:12px; background:#14231b; aspect-ratio:5 / 4; }
        .nasaem-barcode__video-backdrop { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:blur(18px); opacity:.72; transform:scale(1.08); }
        .nasaem-barcode__video { position:relative; z-index:1; display:block; width:100%; height:100%; max-height:600px; object-fit:contain; }
        .nasaem-barcode__scan-frame { position:absolute; z-index:2; inset:34% 7.5%; border:2px solid #f0c84e; border-radius:12px; box-shadow:0 0 0 999px rgb(0 0 0 / 16%); pointer-events:none; transition:border-color .15s, box-shadow .15s; }
        .nasaem-barcode[data-result="success"] .nasaem-barcode__scan-frame { border-color:#22c55e; box-shadow:0 0 18px #22c55e,0 0 0 999px rgb(0 0 0 / 16%); }
        .nasaem-barcode[data-result="error"] .nasaem-barcode__scan-frame { border-color:#ef4444; box-shadow:0 0 18px #ef4444,0 0 0 999px rgb(0 0 0 / 16%); }
        .nasaem-barcode__hint { margin-top:8px; color:#526357; font-size:12px; line-height:1.7; }
        .nasaem-barcode__manual { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:8px; border:1px solid #dedfd4; border-radius:12px; padding:12px; background:#faf9f3; }
        .nasaem-barcode[data-result="success"] .nasaem-barcode__manual { border-color:#22c55e; }
        .nasaem-barcode[data-result="error"] .nasaem-barcode__manual { border-color:#ef4444; }
        @media(max-width:420px) { .nasaem-barcode__manual { grid-template-columns:minmax(0,1fr); } }
        .nasaem-barcode__manual input { min-height:42px; direction:ltr; text-align:left; }
        .nasaem-barcode__manual-hint { grid-column:1 / -1; margin:0; color:#68786b; font-size:12px; line-height:1.6; }
        .nasaem-barcode__status { display:flex; align-items:flex-start; gap:8px; padding:10px 12px; border:1px solid #e7e4d8; border-radius:10px; background:#f7f5ed; color:#526357; font-size:12px; line-height:1.7; }
        .nasaem-barcode__status svg { flex:none; width:16px; height:16px; margin-top:2px; color:#357456; }
        .nasaem-barcode__status[data-error="true"] { border-color:#eed2cd; background:#fff3ef; color:#9c3f35; }
        .nasaem-barcode__status[data-error="true"] svg { color:#a9433a; }
        .nasaem-barcode button:focus-visible { outline:3px solid #f0c84e; outline-offset:2px; }
      `}</style>
      <input
        ref={inputRef}
        className="nasaem-barcode__input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        disabled={disabled || decoding}
        aria-label="التقاط صورة للرمز الشريطي"
        data-testid="input-barcode-image"
      />
      <div className="nasaem-barcode__actions">
        <button
          className={`button nasaem-barcode__capture${deviceMode ? '' : ' ghost'}`}
          type="button"
          disabled={disabled || decoding}
          aria-pressed={deviceMode}
          onClick={() => { stopLiveScan(); setDeviceMode(true); setFeedback('idle'); setStatus('ضع المؤشر في خانة ماسح الجهاز وامسح الباركود.'); setStatusIsError(false); deviceInputRef.current?.focus(); }}
          data-testid="button-device-barcode-scan"
        >
          <Barcode aria-hidden="true" /> ماسح الجهاز USB / بلوتوث
        </button>
        {!scanning ? (
          <button className="button nasaem-barcode__capture" type="button" onClick={startLiveScan} disabled={disabled || decoding} data-testid="button-start-barcode-scan">
            <Camera aria-hidden="true" />
            مسح مباشر بالكاميرا
          </button>
        ) : (
          <button className="button ghost nasaem-barcode__cancel" type="button" onClick={stopLiveScan} disabled={disabled} data-testid="button-stop-barcode-scan">
            <X aria-hidden="true" /> إيقاف المسح
          </button>
        )}
        <button className="button ghost nasaem-barcode__cancel" type="button" onClick={openImageCapture} disabled={disabled || decoding || scanning} data-testid="button-capture-barcode">
          <Camera aria-hidden="true" />
          {decoding ? 'جارٍ قراءة الصورة…' : hasCapture ? 'التقاط صورة أخرى' : 'التقاط صورة بدلًا من المسح'}
        </button>
        {hasCapture && !decoding && (
          <button className="button ghost nasaem-barcode__cancel" type="button" onClick={cancelCapture} disabled={disabled} data-testid="button-cancel-barcode">
            <X aria-hidden="true" /> إلغاء
          </button>
        )}
        {hasCapture && !decoding && status && (
          <button className="button ghost nasaem-barcode__cancel" type="button" onClick={openImageCapture} disabled={disabled} data-testid="button-retry-barcode">
            <RotateCcw aria-hidden="true" /> إعادة المحاولة
          </button>
        )}
      </div>
      {!scanning && <div className="nasaem-barcode__manual">
        <label className="form-field">
          خانة ماسح الجهاز / إدخال الباركود
          <input
            ref={deviceInputRef}
            type="text"
            value={manualCode}
            onChange={(event) => { setManualCode(event.target.value); setFeedback('idle'); }}
            onKeyDown={(event) => {
              if (!event.nativeEvent.isComposing && (event.key === 'Enter' || (event.key === 'Tab' && manualCode.trim()))) {
                event.preventDefault();
                if (!event.repeat) submitManualCode();
              }
            }}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={disabled || decoding || scanning}
            aria-label="رمز المنتج أو إدخال قارئ USB"
            placeholder="اضغط هنا وامسح بالجهاز أو اكتب الباركود"
            data-testid="input-barcode-keyboard"
          />
        </label>
        <button
          className="button ghost nasaem-barcode__cancel"
          type="button"
          onClick={submitManualCode}
          disabled={disabled || decoding || scanning}
          data-testid="button-submit-barcode-keyboard"
        >
          <Barcode aria-hidden="true" /> إضافة الرمز
        </button>
        <p className="nasaem-barcode__manual-hint">
          لقارئ USB أو بلوتوث المتصل كلوحة مفاتيح. يتم الإدخال عند إرسال Enter أو Tab؛ أو اضغط «إضافة الرمز». بعد النجاح تبقى الخانة جاهزة للصنف التالي.
        </p>
      </div>}
      {scanning && (
        <div>
            <div className="nasaem-barcode__torch-actions">
              <button
                className="button ghost"
                type="button"
                onClick={clarifyAndRead}
                disabled={disabled || cameraBusy || torchBusy || !cameraReady || feedback === 'success'}
                data-testid="button-clarify-barcode"
              >
                <Focus aria-hidden="true" /> {cameraBusy ? 'جارٍ ضبط الصورة…' : 'توضيح وقراءة الباركود'}
              </button>
              {torchAvailable && (
              <button
                className={`button nasaem-barcode__torch${torchOn ? ' yellow' : ' ghost'}`}
                type="button"
                onClick={toggleTorch}
                disabled={disabled || torchBusy || cameraBusy}
                aria-pressed={torchOn}
                data-testid="button-toggle-barcode-torch"
              >
                {torchOn ? <FlashlightOff aria-hidden="true" /> : <Flashlight aria-hidden="true" />}
                {torchBusy ? 'جارٍ تغيير الفلاش…' : torchOn ? 'إيقاف الفلاش' : 'تشغيل الفلاش'}
              </button>
              )}
            </div>
          <div className="nasaem-barcode__video-wrap">
            <video
              ref={videoBackdropRef}
              className="nasaem-barcode__video-backdrop"
              autoPlay
              muted
              playsInline
              aria-hidden="true"
              tabIndex={-1}
            />
            <video
              ref={videoRef}
              className="nasaem-barcode__video"
              autoPlay
              muted
              playsInline
              aria-label="معاينة الكاميرا لمسح الباركود"
              data-testid="video-barcode-preview"
            />
            <div className="nasaem-barcode__scan-frame" aria-hidden="true" />
          </div>
          <div className="nasaem-barcode__hint">ضع الباركود أمام الشريط، مع ظهور الخطوط كاملة والحافتين البيضاوين. لا يوجد زوم. لو الصورة ضبابية ابعد الهاتف قليلًا وثبّته، ثم اضغط «توضيح وقراءة الباركود». الشريط للإرشاد والقراءة تشمل الصورة كلها.</div>
        </div>
      )}
      {status && (
        <div className="nasaem-barcode__status" role={statusIsError ? 'alert' : 'status'} data-error={statusIsError ? 'true' : 'false'} data-testid="status-barcode">
          <Barcode aria-hidden="true" />
          <span>{status}</span>
        </div>
      )}
    </div>
  );
}

export default BarcodeCapture;

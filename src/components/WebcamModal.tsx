import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, FlipHorizontal, Upload, AlertCircle, HelpCircle } from 'lucide-react';

interface WebcamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  mode: 'passport' | 'idcard_front' | 'idcard_back';
}

export const WebcamModal: React.FC<WebcamModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  mode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const stopActiveStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const initCamera = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Camera API is not supported in this browser environment. You can upload a photo directly instead.');
      return;
    }

    setIsLoading(true);
    setError(null);
    stopActiveStream();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, max: 2560 },
          height: { ideal: 1080, max: 1440 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        try {
          await videoRef.current.play();
        } catch {
          // Auto-play might need user interaction or is muted
        }
      }
    } catch (err: any) {
      const errName = err?.name || '';
      const errMsg = err?.message || String(err);

      if (errName === 'NotAllowedError' || errMsg.includes('Permission dismissed') || errMsg.includes('Permission denied')) {
        setError('Camera permission was dismissed or blocked. Click "Retry Camera" to prompt again, or upload a photo directly.');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setError('No camera device was found on your system. You can upload a photo file instead.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setError('Camera is currently in use by another application or browser tab. Please close other camera apps and retry.');
      } else {
        setError('Camera could not be started. You can upload a photo from your device instead.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, stopActiveStream]);

  useEffect(() => {
    if (!isOpen) {
      stopActiveStream();
      setCapturedPhoto(null);
      setError(null);
      setCountdown(null);
      return;
    }

    initCamera();

    return () => {
      stopActiveStream();
    };
  }, [isOpen, initCamera, stopActiveStream]);

  const handleTakePhoto = () => {
    if (!videoRef.current) return;

    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          snapImage();
          return null;
        }
        return prev - 1;
      });
    }, 700);
  };

  const snapImage = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front user camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedPhoto(dataUrl);
    stopActiveStream();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    initCamera();
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  const handleFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        onCapture(dataUrl);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="glass-card text-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-white/15 flex flex-col bg-slate-900/95">
        {/* Hidden fallback file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFallbackFileSelect}
        />

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            {mode === 'passport' && 'Capture Passport Portrait Photo'}
            {mode === 'idcard_front' && 'Capture ID Card (Front Side)'}
            {mode === 'idcard_back' && 'Capture ID Card (Back Side)'}
          </h3>
          <button
            onClick={() => {
              stopActiveStream();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Photo Preview Area */}
        <div className="relative bg-black min-h-[380px] max-h-[480px] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-8 text-center max-w-md space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Camera Permission Required</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{error}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  onClick={() => initCamera()}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Retry Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Photo File Instead
                </button>
              </div>

              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-400" />
                <span>Tip: You can also open the app in a new browser tab for full native webcam access.</span>
              </div>
            </div>
          ) : capturedPhoto ? (
            <img src={capturedPhoto} alt="Captured" className="max-h-[480px] w-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`max-h-[480px] w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {/* Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {mode === 'passport' ? (
                  <div className="w-[260px] h-[340px] border-2 border-dashed border-amber-400/80 rounded-[50%] flex flex-col items-center justify-center relative shadow-2xl">
                    <div className="absolute top-6 w-full border-b border-amber-400/40" />
                    <div className="absolute top-[45%] w-full border-b border-amber-400/60" />
                    <span className="text-[11px] bg-black/70 text-amber-300 px-2.5 py-0.5 rounded font-mono border border-amber-400/30">
                      Align Face in Oval
                    </span>
                  </div>
                ) : (
                  <div className="w-[360px] h-[225px] border-2 border-dashed border-emerald-400/80 rounded-xl flex items-center justify-center relative shadow-2xl">
                    <span className="text-[11px] bg-black/70 text-emerald-300 px-2.5 py-0.5 rounded font-mono border border-emerald-400/30">
                      {mode === 'idcard_front' ? 'Align ID Card Front' : 'Align ID Card Back'}
                    </span>
                  </div>
                )}
              </div>

              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs">
                  <span className="text-7xl font-extrabold text-white animate-ping">{countdown}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-4 bg-black/40 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {!capturedPhoto && !error && (
              <button
                onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}
                className="px-3 py-1.5 rounded-xl glass-card hover:bg-white/10 text-xs font-medium text-slate-300 border border-white/10 flex items-center gap-1.5 transition-colors"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Flip Camera
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl glass-card hover:bg-white/10 text-xs font-medium text-slate-300 border border-white/10 flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              Upload Image
            </button>
          </div>

          <div className="flex items-center gap-3">
            {capturedPhoto ? (
              <>
                <button
                  onClick={handleRetake}
                  className="px-4 py-2 rounded-xl glass-card hover:bg-white/10 text-xs font-medium text-slate-200 border border-white/10 flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retake Photo
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 accent-glow-emerald transition-all shadow-md"
                >
                  <Check className="w-4 h-4" />
                  Use This Photo
                </button>
              </>
            ) : (
              <button
                onClick={handleTakePhoto}
                disabled={!!error || isLoading}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 accent-glow transition-all active:scale-95 disabled:opacity-50 shadow-md"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

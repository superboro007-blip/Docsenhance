import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, X, Check, FlipHorizontal } from 'lucide-react';

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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setCapturedPhoto(null);
      setError(null);
      return;
    }

    let activeStream: MediaStream | null = null;

    async function initCamera() {
      try {
        setError(null);
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        activeStream = newStream;
        setStream(newStream);
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        setError('Camera access denied or device unavailable. Please ensure permissions are granted.');
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode]);

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
    }, 800);
  };

  const snapImage = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if user camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedPhoto(dataUrl);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="glass-card text-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-white/15 flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/30">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            {mode === 'passport' && 'Capture Passport Portrait Photo'}
            {mode === 'idcard_front' && 'Capture ID Card (Front Side)'}
            {mode === 'idcard_back' && 'Capture ID Card (Back Side)'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Photo Preview Area */}
        <div className="relative bg-black min-h-[380px] max-h-[480px] flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-8 text-center max-w-md">
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <p className="text-xs text-slate-400">You can also upload photos from your files instead.</p>
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
        <div className="px-5 py-4 bg-black/30 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!capturedPhoto && (
              <button
                onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}
                className="px-3 py-1.5 rounded-xl glass-card hover:bg-white/10 text-xs font-medium text-slate-300 border border-white/10 flex items-center gap-1.5 transition-colors"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Flip Camera
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {capturedPhoto ? (
              <>
                <button
                  onClick={handleRetake}
                  className="px-4 py-2 rounded-xl glass-card hover:bg-white/10 text-sm font-medium text-slate-200 border border-white/10 flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Photo
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white flex items-center gap-2 accent-glow-emerald transition-all"
                >
                  <Check className="w-4 h-4" />
                  Use This Photo
                </button>
              </>
            ) : (
              <button
                onClick={handleTakePhoto}
                disabled={!!error}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 accent-glow transition-all active:scale-95 disabled:opacity-50"
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

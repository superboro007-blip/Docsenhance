import React, { useState } from 'react';
import { Check, X, CreditCard, Shield, QrCode, Sparkles } from 'lucide-react';

export interface IDCardOrientationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrientation: 'landscape' | 'portrait';
  onSelectOrientation: (orientation: 'landscape' | 'portrait') => void;
}

export const IDCardOrientationModal: React.FC<IDCardOrientationModalProps> = ({
  isOpen,
  onClose,
  currentOrientation,
  onSelectOrientation,
}) => {
  const [selected, setSelected] = useState<'landscape' | 'portrait'>(currentOrientation);

  // Sync with prop when opened
  React.useEffect(() => {
    if (isOpen) {
      setSelected(currentOrientation);
    }
  }, [isOpen, currentOrientation]);

  if (!isOpen) return null;

  const handleApply = () => {
    onSelectOrientation(selected);
    onClose();
  };

  return (
    <div
      id="id-card-orientation-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="id-card-orientation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        className="relative w-full max-w-3xl bg-white text-slate-800 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                <CreditCard className="w-4 h-4" />
              </span>
              <h2 id="modal-heading" className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                Choose Your ID Card Orientation
              </h2>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-xl">
              Select the primary orientation for your ID card badge. Dimensions, print layouts, and crop boxes will adapt to your chosen ratio.
            </p>
          </div>
          <button
            id="close-orientation-modal-btn"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0 -mt-1 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two Selectable Format Options */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[calc(85vh-160px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Option 1: Horizontal (Landscape) */}
            <div
              id="option-landscape"
              role="radio"
              aria-checked={selected === 'landscape'}
              tabIndex={0}
              onClick={() => setSelected('landscape')}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setSelected('landscape');
                }
              }}
              className={`group relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                selected === 'landscape'
                  ? 'border-blue-600 bg-blue-50/40 shadow-md shadow-blue-500/10 ring-4 ring-blue-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-sm'
              }`}
            >
              {/* Radio Indicator & Title Top */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      Horizontal (Landscape)
                    </h3>
                    {selected === 'landscape' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Standard credit-card/driver's license ratio (85.6mm x 53.98mm).
                  </p>
                </div>

                {/* Custom Styled Radio Button */}
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    selected === 'landscape'
                      ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                      : 'border-slate-300 bg-white group-hover:border-slate-400'
                  }`}
                >
                  {selected === 'landscape' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              {/* Wireframe Mockup: Horizontal Lanyard / Card Holder */}
              <div className="relative w-full py-4 flex flex-col items-center justify-center bg-slate-50/80 rounded-xl border border-slate-100 overflow-hidden">
                {/* Lanyard Strap & Clip */}
                <div className="relative flex flex-col items-center -mt-1 mb-1">
                  {/* Lanyard Ribbon */}
                  <div className="w-5 h-6 bg-gradient-to-b from-blue-700 to-blue-600 rounded-t-sm shadow-inner flex items-center justify-center">
                    <div className="w-0.5 h-full bg-blue-400/40" />
                  </div>
                  {/* Metal Badge Clip & Ring */}
                  <div className="w-3.5 h-2 bg-slate-400 rounded-xs -mt-0.5 shadow-xs border border-slate-500" />
                  <div className="w-2 h-2.5 rounded-full border-2 border-slate-400 -mt-0.5" />
                </div>

                {/* Badge Holder Pouch Outer Frame */}
                <div className="relative w-[238px] p-2 bg-white/90 backdrop-blur-xs rounded-xl border border-slate-300 shadow-sm">
                  {/* Lanyard Slot Cutout in Sleeve */}
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto -mt-0.5 mb-2 border border-slate-300/60" />

                  {/* ID Card Body (85.6mm × 53.98mm ratio = 1.586) */}
                  <div className="w-[220px] h-[138px] bg-gradient-to-br from-white via-slate-50 to-blue-50/30 rounded-lg border border-slate-200/90 shadow-xs relative p-3 flex flex-col justify-between overflow-hidden">
                    {/* Top Security Banner */}
                    <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-600 flex items-center justify-center text-[7px] text-white font-bold">
                          ★
                        </div>
                        <div className="h-2 w-16 bg-slate-300 rounded-full" />
                      </div>
                      <span className="text-[8px] font-mono font-bold text-slate-400">
                        CR80 ID
                      </span>
                    </div>

                    {/* Middle Card Area: Photo (Left) + Details (Center) + QR (Right) */}
                    <div className="grid grid-cols-12 gap-2 items-center py-1">
                      {/* Photo Placeholder (Left 4 cols) */}
                      <div className="col-span-4 flex flex-col items-center">
                        <div className="w-14 h-16 bg-blue-100/70 border border-blue-200 rounded-md flex flex-col items-center justify-center relative overflow-hidden shadow-2xs">
                          {/* Silhouette */}
                          <div className="w-5 h-5 rounded-full bg-blue-400/80 mb-0.5" />
                          <div className="w-9 h-5 rounded-t-full bg-blue-500/70" />
                          <span className="absolute bottom-0.5 text-[6px] font-bold text-blue-800/80 tracking-tight">
                            PHOTO
                          </span>
                        </div>
                      </div>

                      {/* Name & Details (Center 5 cols) */}
                      <div className="col-span-5 space-y-1.5 pl-0.5">
                        <div>
                          <div className="text-[9px] font-bold text-slate-800 leading-tight">
                            NAME SURNAME
                          </div>
                          <div className="text-[7px] font-medium text-blue-600 leading-tight">
                            OFFICIAL CARD
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="h-1.5 w-14 bg-slate-200 rounded-full" />
                          <div className="h-1.5 w-11 bg-slate-200 rounded-full" />
                        </div>
                        <div className="flex items-center gap-1 pt-0.5">
                          {/* Simulated Chip */}
                          <div className="w-3.5 h-2.5 bg-amber-200 border border-amber-400 rounded-xs flex items-center justify-center">
                            <div className="w-1.5 h-1 border border-amber-600" />
                          </div>
                          <span className="text-[6px] font-mono text-slate-400">ID-9842</span>
                        </div>
                      </div>

                      {/* QR Code (Right 3 cols) */}
                      <div className="col-span-3 flex flex-col items-center justify-center">
                        <div className="w-11 h-11 bg-white p-1 rounded border border-slate-200 shadow-2xs flex flex-col items-center justify-center">
                          <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 bg-slate-900 rounded-xs">
                            <div className="bg-white rounded-2xs" />
                            <div className="bg-slate-900" />
                            <div className="bg-white rounded-2xs" />
                            <div className="bg-slate-900" />
                            <div className="bg-white" />
                            <div className="bg-slate-900" />
                            <div className="bg-white rounded-2xs" />
                            <div className="bg-slate-900" />
                            <div className="bg-white" />
                          </div>
                        </div>
                        <span className="text-[6px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                          QR CODE
                        </span>
                      </div>
                    </div>

                    {/* Bottom Security Barcode Line */}
                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                      <div className="h-1 w-20 bg-slate-200 rounded-full" />
                      <div className="text-[7px] font-mono text-slate-400">85.60 × 53.98 mm</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Specifications List */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                  85.6 × 54 mm
                </span>
                <span className="text-[11px] text-slate-500">
                  Credit Card • Driver License • Aadhaar
                </span>
              </div>
            </div>

            {/* Option 2: Vertical (Portrait) */}
            <div
              id="option-portrait"
              role="radio"
              aria-checked={selected === 'portrait'}
              tabIndex={0}
              onClick={() => setSelected('portrait')}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setSelected('portrait');
                }
              }}
              className={`group relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                selected === 'portrait'
                  ? 'border-blue-600 bg-blue-50/40 shadow-md shadow-blue-500/10 ring-4 ring-blue-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-sm'
              }`}
            >
              {/* Radio Indicator & Title Top */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      Vertical (Portrait)
                    </h3>
                    {selected === 'portrait' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Standard badge/lanyard ratio (53.98mm x 85.6mm).
                  </p>
                </div>

                {/* Custom Styled Radio Button */}
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    selected === 'portrait'
                      ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                      : 'border-slate-300 bg-white group-hover:border-slate-400'
                  }`}
                >
                  {selected === 'portrait' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              {/* Wireframe Mockup: Vertical Lanyard / Card Holder */}
              <div className="relative w-full py-4 flex flex-col items-center justify-center bg-slate-50/80 rounded-xl border border-slate-100 overflow-hidden">
                {/* Lanyard Strap & Clip */}
                <div className="relative flex flex-col items-center -mt-1 mb-1">
                  {/* Lanyard Ribbon */}
                  <div className="w-5 h-6 bg-gradient-to-b from-indigo-700 to-indigo-600 rounded-t-sm shadow-inner flex items-center justify-center">
                    <div className="w-0.5 h-full bg-indigo-300/40" />
                  </div>
                  {/* Metal Swivel Snap Hook */}
                  <div className="w-3.5 h-2 bg-slate-400 rounded-xs -mt-0.5 shadow-xs border border-slate-500" />
                  <div className="w-2 h-2.5 rounded-full border-2 border-slate-400 -mt-0.5" />
                </div>

                {/* Badge Holder Pouch Outer Frame */}
                <div className="relative w-[156px] p-2 bg-white/90 backdrop-blur-xs rounded-xl border border-slate-300 shadow-sm">
                  {/* Lanyard Slot Cutout in Sleeve */}
                  <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto -mt-0.5 mb-2 border border-slate-300/60" />

                  {/* ID Card Body (53.98mm × 85.6mm ratio = 0.63) */}
                  <div className="w-[138px] h-[190px] bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 rounded-lg border border-slate-200/90 shadow-xs relative p-2.5 flex flex-col items-center justify-between overflow-hidden text-center">
                    {/* Top Header & Organization Bar */}
                    <div className="w-full pb-1 border-b border-slate-200/70 flex flex-col items-center">
                      <div className="w-12 h-1.5 bg-indigo-600 rounded-full mb-0.5" />
                      <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                        ORGANIZATION
                      </span>
                    </div>

                    {/* Centered Photo Placeholder */}
                    <div className="flex flex-col items-center my-1">
                      <div className="w-13 h-15 bg-indigo-100/70 border border-indigo-200 rounded-md flex flex-col items-center justify-center relative overflow-hidden shadow-2xs">
                        <div className="w-4.5 h-4.5 rounded-full bg-indigo-400/80 mb-0.5" />
                        <div className="w-8 h-4 rounded-t-full bg-indigo-500/70" />
                        <span className="absolute bottom-0.5 text-[6px] font-bold text-indigo-800/80 tracking-tight">
                          PHOTO
                        </span>
                      </div>
                    </div>

                    {/* Name & Role Designation */}
                    <div className="space-y-0.5 w-full">
                      <div className="text-[9px] font-bold text-slate-800 truncate">
                        NAME SURNAME
                      </div>
                      <div className="text-[7px] font-semibold text-indigo-600 uppercase tracking-wider">
                        STAFF / VISITOR
                      </div>
                      <div className="flex justify-center gap-1 pt-0.5">
                        <div className="h-1 w-10 bg-slate-200 rounded-full" />
                      </div>
                    </div>

                    {/* Centered QR Code at bottom */}
                    <div className="flex flex-col items-center pt-1 border-t border-slate-100 w-full">
                      <div className="w-10 h-10 bg-white p-0.5 rounded border border-slate-200 shadow-2xs flex items-center justify-center">
                        <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 bg-slate-900 rounded-2xs">
                          <div className="bg-white rounded-2xs" />
                          <div className="bg-slate-900" />
                          <div className="bg-white rounded-2xs" />
                          <div className="bg-slate-900" />
                          <div className="bg-white" />
                          <div className="bg-slate-900" />
                          <div className="bg-white rounded-2xs" />
                          <div className="bg-slate-900" />
                          <div className="bg-white" />
                        </div>
                      </div>
                      <span className="text-[6px] font-mono text-slate-400 mt-0.5">
                        53.98 × 85.60 mm
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Specifications List */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                  54 × 85.6 mm
                </span>
                <span className="text-[11px] text-slate-500">
                  Lanyard Badge • Event Pass • Conference
                </span>
              </div>
            </div>
          </div>

          {/* Clean SaaS informational tip */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-3">
            <div className="p-1 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Automatic Ratio Sync:</span> Switching between Horizontal and Vertical automatically reconfigures your manual crop guides, perspective warp bounds, and arranges the print preview for optimal paper utilization.
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl md:rounded-b-3xl">
          <div className="text-xs text-slate-500 hidden sm:block">
            Current choice:{' '}
            <span className="font-semibold text-slate-800 capitalize">
              {selected === 'landscape' ? 'Horizontal (Landscape)' : 'Vertical (Portrait)'}
            </span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              id="cancel-orientation-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="apply-orientation-btn"
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              Apply Format
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

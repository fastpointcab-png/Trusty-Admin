import React, { useState, useEffect } from 'react';
import {
  ClipboardPaste,
  X,
  Sparkles,
  Car,
  Phone,
  MapPin,
  Clock,
  IndianRupee,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { parseBookingText, ParsedBookingData } from '../../services/bookingParser';
import { FirestoreTrip, FirestoreDriver } from '../../types';

interface PasteBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToNewTrip: (data: ParsedBookingData) => void;
  onDirectPostTrip?: (trip: Partial<FirestoreTrip>) => Promise<FirestoreTrip>;
  drivers?: FirestoreDriver[];
}

export const PasteBookingModal: React.FC<PasteBookingModalProps> = ({
  isOpen,
  onClose,
  onApplyToNewTrip,
}) => {
  const [pastedText, setPastedText] = useState('');
  const [parsed, setParsed] = useState<ParsedBookingData | null>(null);
  const [clipboardSupported, setClipboardSupported] = useState(true);

  // Always reset pasted text and parsed state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setPastedText('');
      setParsed(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    setPastedText('');
    setParsed(null);
    onClose();
  };

  // Handle ESC key to reset and close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Auto-detect and parse whenever text changes
  useEffect(() => {
    if (pastedText.trim()) {
      const result = parseBookingText(pastedText);
      setParsed(result);
    } else {
      setParsed(null);
    }
  }, [pastedText]);

  // Attempt auto-read from clipboard when requested
  const handleReadClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setPastedText(text);
        }
      } else {
        setClipboardSupported(false);
      }
    } catch {
      // Browser permission prompt denied or unsupported
      setClipboardSupported(false);
    }
  };

  if (!isOpen) return null;

  const handleApply = () => {
    if (!parsed) return;
    const parsedData = parsed;
    setPastedText('');
    setParsed(null);
    onApplyToNewTrip(parsedData);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh]">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm shadow-amber-500/20">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Paste Booking Details
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Auto-Detect Any Format
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste any booking message (WhatsApp, email, SMS, or plain text) to auto-extract details.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Action Ribbon: Paste from Clipboard & Clear */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Paste Booking Message / Text:</span>
            </label>

            <div className="flex items-center gap-2">
              {clipboardSupported && (
                <button
                  type="button"
                  onClick={handleReadClipboard}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-lg border border-amber-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-amber-600" />
                  <span>Paste from Clipboard</span>
                </button>
              )}
              {pastedText && (
                <button
                  type="button"
                  onClick={() => setPastedText('')}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 flex items-center gap-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Textarea Input without sample button */}
          <div className="relative">
            <textarea
              autoFocus
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste any booking format here (e.g. WhatsApp message, email, SMS, travel portal, or raw text like 'Gandhipuram to Airport 9876543210 Sedan 1200')..."
              className="w-full border-2 border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 rounded-2xl p-4 text-xs font-mono text-slate-900 bg-slate-50/50 outline-none transition resize-none leading-relaxed shadow-inner"
            />
          </div>

          {/* Extracted Details Live Card */}
          {parsed && (
            <div className="bg-gradient-to-br from-slate-50 to-amber-50/30 rounded-2xl p-4 border border-amber-200/80 shadow-2xs space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-extrabold text-slate-900">
                    Detected Trip Details
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {parsed.tripType === 'PACKAGE' ? 'Rental Package' : 'Regular Ride'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Customer Phone */}
                <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                  <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Phone</span>
                    <span className="font-extrabold text-slate-900">
                      {parsed.customerPhone ? (
                        `+91 ${parsed.customerPhone}`
                      ) : (
                        <span className="text-rose-500 font-medium">Not detected</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Vehicle Category */}
                <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                  <Car className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Vehicle</span>
                    <span className="font-extrabold text-slate-900">
                      {parsed.vehicleCategory}
                    </span>
                  </div>
                </div>

                {/* Pickup */}
                <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/60 sm:col-span-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Pickup</span>
                    <span className="font-bold text-slate-900 break-words">
                      {parsed.pickupLocation || <span className="text-slate-400 italic">Not detected</span>}
                    </span>
                  </div>
                </div>

                {/* Drop / Package */}
                <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/60 sm:col-span-2">
                  <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                      {parsed.isPackage ? 'Package Details' : 'Destination'}
                    </span>
                    <span className="font-bold text-slate-900 break-words">
                      {parsed.isPackage ? (
                        parsed.packageHours || parsed.packageKms ? (
                          `Package (${parsed.packageHours || '0'}h / ${parsed.packageKms || '0'}km)`
                        ) : (
                          'Rental Package'
                        )
                      ) : (
                        parsed.dropLocation || <span className="text-slate-400 italic">Not detected</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Fare */}
                {parsed.estimatedFare && (
                  <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                    <IndianRupee className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Estimated Fare</span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        ₹{parsed.estimatedFare}
                      </span>
                    </div>
                  </div>
                )}

                {/* Schedule if any */}
                {(parsed.date || parsed.time) && (
                  <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Schedule</span>
                      <span className="font-bold text-slate-800">
                        {parsed.date} {parsed.time}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions: ONLY Review in Form */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
          >
            Cancel
          </button>

          {/* Standout Primary Action: Review in Form */}
          <button
            type="button"
            disabled={!parsed}
            onClick={handleApply}
            className={`px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition cursor-pointer ${
              parsed
                ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/25'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Review in Form</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};

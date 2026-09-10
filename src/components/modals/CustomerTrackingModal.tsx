import React, { useState } from 'react';
import { FirestoreTrip, FirestoreDriver } from '../../types';
import {
  X,
  Navigation,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
  Clock,
  Car,
  User,
  Phone,
  MapPin,
  AlertCircle,
  MessageSquare,
  Mail,
  Send,
  Ban,
  CheckCircle2,
  Zap,
} from 'lucide-react';

interface CustomerTrackingModalProps {
  isOpen: boolean;
  trip: FirestoreTrip | null;
  assignedDriver?: FirestoreDriver | null;
  onClose: () => void;
  onGenerateLink: (tripDocId: string) => Promise<{ token: string; link: string }>;
  onDisableLink: (tripDocId: string) => Promise<void>;
  onPreviewCustomerView?: (token: string, selectedTrip?: FirestoreTrip) => void;
}

export const CustomerTrackingModal: React.FC<CustomerTrackingModalProps> = ({
  isOpen,
  trip,
  assignedDriver,
  onClose,
  onGenerateLink,
  onDisableLink,
  onPreviewCustomerView,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCustomDomain, setCopiedCustomDomain] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [localToken, setLocalToken] = useState<string>(trip?.tracking_token || (trip ? `TRK-${trip.trip_id}` : ''));
  const [localEnabled, setLocalEnabled] = useState<boolean>(Boolean(trip?.tracking_enabled ?? true));

  React.useEffect(() => {
    if (trip) {
      setLocalToken(trip.tracking_token || `TRK-${trip.trip_id}`);
      setLocalEnabled(Boolean(trip.tracking_enabled ?? true));
      setShowRevokeConfirm(false);
    }
  }, [trip?.tracking_token, trip?.tracking_enabled, trip?.trip_id]);

  if (!isOpen || !trip) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://track.trustyyellowcab.com';
  const token = localToken || trip.tracking_token || `TRK-${trip.trip_id}`;
  const isTripFinished = trip.status === 'COMPLETED' || trip.status === 'CANCELLED';
  const isTrackingActive = Boolean((localEnabled ?? trip.tracking_enabled ?? true) && token && !isTripFinished);

  const liveLink = token ? `${origin}/?track=${token}` : '';
  const brandedExampleLink = token ? `https://track.trustyyellowcab.com/${token}` : '';

  const driverName = trip.driver_name || assignedDriver?.driver_name || 'Driver Allocation Pending';
  const vehicleNumber = trip.vehicle_number || assignedDriver?.vehicle_number || 'Assigning Vehicle';
  const driverPhone = trip.driver_phone || assignedDriver?.mobile_number;

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const res = await onGenerateLink(trip.doc_id || trip.trip_id);
      if (res && res.token) {
        setLocalToken(res.token);
        setLocalEnabled(true);
      }
    } catch (err) {
      console.error('Failed to generate tracking link:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDisable = async () => {
    try {
      setIsDisabling(true);
      await onDisableLink(trip.doc_id || trip.trip_id);
      setLocalEnabled(false);
      setShowRevokeConfirm(false);
    } catch (err) {
      console.error('Failed to disable tracking link:', err);
    } finally {
      setIsDisabling(false);
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'token' | 'domain') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else if (type === 'token') {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedCustomDomain(true);
        setTimeout(() => setCopiedCustomDomain(false), 2000);
      }
    }
  };

  // Pre-formatted customer message for WhatsApp / SMS / Email
  const shareMessage = `Hello Customer,\n\nYour cab has been booked.\n\nTrip ID: ${trip.trip_id}\n\nTrack Your Cab:\n${liveLink}\n\nThank you for choosing our taxi service.`;

  const cleanPhone = (trip.customer_phone || '').replace(/[^0-9+]/g, '');

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(shareMessage);
    const targetPhone = cleanPhone.startsWith('+')
      ? cleanPhone.replace('+', '')
      : cleanPhone.length === 10
      ? `91${cleanPhone}`
      : cleanPhone;
    const url = targetPhone
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const openSms = () => {
    const encoded = encodeURIComponent(shareMessage);
    window.open(`sms:${cleanPhone}?body=${encoded}`, '_self');
  };

  const openEmail = () => {
    const subject = encodeURIComponent(`Live Tracking Link for Trip #${trip.trip_id} - Trusty Yellow Cabs`);
    const body = encodeURIComponent(shareMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-slate-900">
                  Customer Live Tracking
                </h3>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  Live Link
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Trip #{trip.trip_id} • {trip.customer_name || 'Customer'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Trip Summary Card */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="font-bold text-slate-700">Trip Overview</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  trip.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : trip.status === 'IN_PROGRESS'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : trip.status === 'ACCEPTED'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : trip.status === 'CANCELLED'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {trip.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">Driver: <strong className="text-slate-900">{driverName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Car className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">Plate: <strong className="text-slate-900 font-mono">{vehicleNumber}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Pickup: <span className="text-slate-800">{trip.pickup_location}</span></span>
              </div>
            </div>
          </div>

          {/* Core Feature Status */}
          {!isTrackingActive ? (
            /* STATE 1: Link Not Generated Yet */
            <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4.5 space-y-3.5">
              <div className="hidden flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-amber-950 text-sm">
                    No Tracking Link Generated Yet
                  </h4>
                  <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                    By default, tracking links are <strong>not generated</strong> for every trip to optimize Firestore usage and preserve privacy. Create a link only when the customer explicitly requests live tracking.
                  </p>
                </div>
              </div>

              {isTripFinished ? (
                <div className="bg-white/80 rounded-xl p-3 border border-amber-200 text-xs text-amber-800 font-medium">
                  This trip is already {trip.status.toLowerCase()}. Tracking links cannot be generated for completed or cancelled trips.
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{isGenerating ? 'Generating Secure Token...' : 'Generate Customer Tracking Link'}</span>
                  </button>
                  <p className="text-[11px] text-amber-800/80 text-center mt-2 font-medium">
                    Creates a single-trip token (TRKXXXXXXXX) that auto-expires when the trip completes.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* STATE 2: Link is Active */
            <div className="space-y-4">
              {/* Active Status Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      Tracking Link Active
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-white text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                    Token: {token}
                  </span>
                </div>
                <p className="text-xs text-emerald-900">
                  The customer can now view live driver location, vehicle specs, and trip status in their browser.
                </p>
              </div>

              {/* Secure Token & URL Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Customer Live Tracking URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={liveLink}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 font-bold focus:outline-hidden select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(liveLink, 'link')}
                    className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-900" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>

                {/* Branded Domain Format Reference */}
                <div className="hidden bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">
                    Production Domain: <strong className="font-mono text-slate-900">{brandedExampleLink}</strong>
                  </span>
                  <button
                    onClick={() => copyToClipboard(brandedExampleLink, 'domain')}
                    className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCustomDomain ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCustomDomain ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Share Buttons */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Quick Share to Customer
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* WhatsApp */}
                  <button
                    onClick={openWhatsApp}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  {/* SMS */}
                  <button
                    onClick={openSms}
                    className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>SMS Text</span>
                  </button>

                  {/* Email */}
                  <button
                    onClick={openEmail}
                    className="py-2.5 px-3 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email</span>
                  </button>
                </div>
              </div>

              {/* Preview Customer View */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onPreviewCustomerView) {
                      onPreviewCustomerView(token, {
                        ...trip,
                        tracking_token: token,
                        tracking_enabled: true,
                      });
                      onClose();
                    } else {
                      window.open(liveLink, '_blank');
                    }
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-300"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                  <span>Preview Customer View</span>
                </button>

                {/* Revoke / Disable Button */}
                {!showRevokeConfirm ? (
                  <button
                    onClick={() => setShowRevokeConfirm(true)}
                    className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-rose-200"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Disable Link</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleDisable}
                      disabled={isDisabling}
                      className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                    >
                      {isDisabling ? 'Disabling...' : 'Confirm Revoke'}
                    </button>
                    <button
                      onClick={() => setShowRevokeConfirm(false)}
                      className="py-2 px-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Security & Firestore Architecture Guarantee */}
          <div className="hidden bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] space-y-1.5 text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zero-Overhead Security & Auto-Expiry</span>
            </div>
            <ul className="space-y-1 text-slate-500 pl-4 list-disc">
              <li>
                <strong>No Admin Exposure:</strong> Customers cannot modify trip data, access driver records, or view other fleet rides.
              </li>
              <li>
                <strong>Auto-Expiry:</strong> This tracking session deactivates immediately when the trip is marked <strong>COMPLETED</strong> or <strong>CANCELLED</strong>.
              </li>
              <li>
                <strong>Minimal Firestore Reads:</strong> No background tracking documents exist for unrequested trips.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

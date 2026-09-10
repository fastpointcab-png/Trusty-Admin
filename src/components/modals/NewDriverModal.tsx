import React, { useState } from 'react';
import { FirestoreDriver, VehicleCategory } from '../../types';
import { Users, Car, Phone, Calendar, Image, X, Sparkles, Key, RefreshCw, AlertTriangle } from 'lucide-react';
import { DriverPhotoUploader } from './DriverPhotoUploader';

interface NewDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (driver: Partial<FirestoreDriver>) => Promise<FirestoreDriver>;
}

const VEHICLE_CATEGORIES = [
  'MINI',
  'SEDAN',
  'SUV',
  'SUV+',
  'INNOVA',
  'INNOVA CRYSTA',
  'CUSTOM',
] as const;

/**
 * Calculates date string for exactly 1 year from today (YYYY-MM-DD)
 */
function getOneYearFromToday(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Generates a realistic auto FCM token string for driver push dispatch
 */
function generateAutoFcmToken(prefixId?: string): string {
  const pfx = (prefixId || 'drv').toLowerCase().replace(/[^a-z0-9]/g, '');
  const timestamp = Date.now().toString(36);
  const part1 = Math.random().toString(36).substring(2, 12);
  const part2 = Math.random().toString(36).substring(2, 12);
  return `fcm_${pfx}_${timestamp}_${part1}${part2}`;
}

export const NewDriverModal: React.FC<NewDriverModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  // All fields initialize cleanly
  const [driverId, setDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [categorySelection, setCategorySelection] = useState<string>('MINI');
  const [customCategory, setCustomCategory] = useState('');
  
  // 1-Year Auto default Expiry Date
  const [expiryDate, setExpiryDate] = useState<string>(() => getOneYearFromToday());

  // Auto FCM Token
  const [fcmToken, setFcmToken] = useState<string>(() => generateAutoFcmToken());

  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegenerateFcmToken = () => {
    setFcmToken(generateAutoFcmToken(driverId || 'drv'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (categorySelection === 'CUSTOM' && !customCategory.trim()) {
      setErrorMessage('Please enter a custom vehicle category name.');
      return;
    }

    const finalCategory = (
      categorySelection === 'CUSTOM'
        ? customCategory.trim().toUpperCase()
        : categorySelection
    ) as VehicleCategory;

    setIsSubmitting(true);
    try {
      await onSubmit({
        driver_id: driverId.trim(), // If blank, hook generates a unique ID
        driver_name: driverName.trim(),
        mobile_number: mobileNumber.trim(),
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        vehicle_category: finalCategory,
        expiry_date: expiryDate.trim() || getOneYearFromToday(),
        photo_url: photoUrl.trim(),
        status: 'ACTIVE',
        is_online: false, // Offline until driver logs in from their mobile device
        device_id: '',    // Device ID strictly blank empty until mobile device app binds
        fcm_token: fcmToken.trim() || generateAutoFcmToken(driverId), // Auto FCM token
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error registering driver');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" /> Register Driver in Fleet
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          {/* Driver Photo */}
          <DriverPhotoUploader
            photoUrl={photoUrl}
            onChange={setPhotoUrl}
            driverName={driverName || 'New Driver'}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Driver ID <span className="text-slate-400 font-normal">(Leave blank to auto-create)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 001 or DRV-101"
                value={driverId}
                onChange={(e) => {
                  setDriverId(e.target.value);
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold bg-white focus:bg-slate-50 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Vehicle Category</label>
              <select
                value={categorySelection}
                onChange={(e) => setCategorySelection(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="MINI">MINI</option>
                <option value="SEDAN">SEDAN</option>
                <option value="SUV">SUV</option>
                <option value="SUV+">SUV+</option>
                <option value="INNOVA">INNOVA</option>
                <option value="INNOVA CRYSTA">INNOVA CRYSTA</option>
                <option value="CUSTOM">Custom Type (Type your own)</option>
              </select>
            </div>
          </div>

          {/* Custom Category Input if CUSTOM selected */}
          {categorySelection === 'CUSTOM' && (
            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 animate-in fade-in duration-150">
              <label className="block text-amber-950 font-bold mb-1">
                Custom Vehicle Category Name
              </label>
              <input
                type="text"
                placeholder="e.g. TEMPO TRAVELLER, AUTO, EV SEDAN"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-slate-900 bg-white font-bold uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
              <p className="text-[10px] text-amber-700 mt-1">
                This custom category will be assigned to this driver and available across dispatch.
              </p>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Full Legal Name</label>
            <input
              type="text"
              placeholder="e.g. MYILSAMY"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Mobile Phone (For Driver App Login)</label>
            <input
              type="text"
              placeholder="e.g. 8667726577"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Vehicle Plate Number</label>
              <input
                type="text"
                placeholder="e.g. TN 66 AV 6589"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            {/* License Expiry Date (defaults to 1 year from today, editable) */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">License Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Auto FCM Token Field */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-800 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Auto FCM Token</span>
              </label>
              <button
                type="button"
                onClick={handleRegenerateFcmToken}
                className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-2 py-1 rounded-md border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                title="Generate a new FCM token"
              >
                <RefreshCw className="w-2.5 h-2.5 text-slate-500" />
                <span>Regenerate</span>
              </button>
            </div>
            <input
              type="text"
              value={fcmToken}
              onChange={(e) => setFcmToken(e.target.value)}
              placeholder="Auto-generated FCM token"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono bg-white text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Auto-generated FCM push token. Driver mobile app will automatically refresh this on connect.
            </p>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-600 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Driver in Fleet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { FirestoreTrip } from '../../types';
import { CheckCircle2, IndianRupee, Gauge, Clock, X, AlertTriangle } from 'lucide-react';

interface CompleteTripModalProps {
  trip: FirestoreTrip | null;
  onClose: () => void;
  onComplete: (
    tripDocId: string,
    finalFare: number,
    distanceKm: number,
    durationSec: number,
    waitingSec: number
  ) => Promise<void>;
}

export const CompleteTripModal: React.FC<CompleteTripModalProps> = ({
  trip,
  onClose,
  onComplete,
}) => {
  if (!trip) return null;

  const [distanceKm, setDistanceKm] = useState<number>(trip.distance_km || 14.2);
  const [durationMins, setDurationMins] = useState<number>(32);
  const [waitingMins, setWaitingMins] = useState<number>(5);
  const [fareAdjustment, setFareAdjustment] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Meter calculation
  const baseFare = trip.base_fare || 60;
  const kmRate = trip.kms_fare || 14;
  const waitingRate = (trip.hour_fare || 120) / 60;

  const calculatedMeterFare = Math.round(
    baseFare + Math.max(0, distanceKm - 2) * kmRate + waitingMins * waitingRate + fareAdjustment
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onComplete(
        trip.doc_id || trip.trip_id,
        calculatedMeterFare,
        distanceKm,
        durationMins * 60,
        waitingMins * 60
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error completing trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Complete & Settle Ride ({trip.trip_id})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Driver: <strong>{trip.driver_name || 'Driver'}</strong> ({trip.vehicle_number})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-slate-400" /> Total Metered Distance (KM)
              </label>
              <input
                type="number"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Total Trip Duration (Mins)
              </label>
              <input
                type="number"
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Waiting Time (Mins)</label>
              <input
                type="number"
                value={waitingMins}
                onChange={(e) => setWaitingMins(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Toll / Extras / Discount (₹)</label>
              <input
                type="number"
                value={fareAdjustment}
                onChange={(e) => setFareAdjustment(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
              />
            </div>
          </div>

          {/* Meter Calculated Total Result */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">Final Settled Meter Fare</span>
            <h4 className="text-3xl font-black text-emerald-900 mt-1">₹{calculatedMeterFare}</h4>
            <span className="text-[10px] text-emerald-700">
              Estimated was ₹{trip.estimated_fare} • Base ₹{baseFare} + {distanceKm}km @ ₹{kmRate}/km
            </span>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Finalizing...' : 'Complete & Close Ride'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

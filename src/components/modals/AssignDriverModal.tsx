import React, { useState, useMemo } from 'react';
import { FirestoreTrip, FirestoreDriver } from '../../types';
import { Car, Phone, Check, X, Search, Ban, Clock, AlertTriangle } from 'lucide-react';
import { DriverAvatar } from '../DriverAvatar';

interface AssignDriverModalProps {
  trip: FirestoreTrip | null;
  drivers: FirestoreDriver[];
  trips?: FirestoreTrip[];
  onClose: () => void;
  onAssign: (tripDocId: string, driver: FirestoreDriver) => Promise<void>;
}

export const AssignDriverModal: React.FC<AssignDriverModalProps> = ({
  trip,
  drivers,
  trips = [],
  onClose,
  onAssign,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false);
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);

  // Map of driver_id -> ongoing / in-process trip (IN_PROGRESS or ACCEPTED)
  const busyDriversMap = useMemo(() => {
    const map = new Map<string, FirestoreTrip>();
    if (!trips || !Array.isArray(trips)) return map;
    for (const t of trips) {
      if (
        t.driver_id &&
        (t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED') &&
        t.trip_id !== trip?.trip_id &&
        t.doc_id !== trip?.doc_id
      ) {
        map.set(t.driver_id, t);
      }
    }
    return map;
  }, [trips, trip]);

  const getOngoingTripForDriver = (driverId: string, currentTripId?: string | null) => {
    if (busyDriversMap.has(driverId)) {
      return busyDriversMap.get(driverId)!;
    }
    if (currentTripId && trips) {
      const match = trips.find(
        (t) =>
          (t.trip_id === currentTripId || t.doc_id === currentTripId) &&
          t.trip_id !== trip?.trip_id &&
          t.doc_id !== trip?.doc_id &&
          (t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED')
      );
      if (match) return match;
    }
    return null;
  };

  const filteredDrivers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = drivers.filter((d) => {
      if (d.status !== 'ACTIVE') return false;
      if (filterOnlineOnly && !d.is_online) return false;

      const ongoingTrip = getOngoingTripForDriver(d.driver_id, d.current_trip_id);
      if (filterAvailableOnly && ongoingTrip) return false;

      if (!q) return true;

      const idMatch = (d.driver_id || '').toLowerCase().includes(q);
      const nameMatch = (d.driver_name || '').toLowerCase().includes(q);
      const vehicleMatch = (d.vehicle_number || '').toLowerCase().includes(q);
      const categoryMatch = (d.vehicle_category || '').toLowerCase().includes(q);
      const phoneMatch = (d.mobile_number || '').toLowerCase().includes(q);

      return idMatch || nameMatch || vehicleMatch || categoryMatch || phoneMatch;
    });

    // Sort available drivers to the top, drivers on ongoing trips below
    return result.sort((a, b) => {
      const aBusy = Boolean(getOngoingTripForDriver(a.driver_id, a.current_trip_id));
      const bBusy = Boolean(getOngoingTripForDriver(b.driver_id, b.current_trip_id));
      if (aBusy && !bBusy) return 1;
      if (!aBusy && bBusy) return -1;
      return (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0);
    });
  }, [drivers, searchQuery, filterOnlineOnly, filterAvailableOnly, busyDriversMap, trips, trip]);

  // Counts
  const availableCount = useMemo(() => {
    return drivers.filter(
      (d) => d.status === 'ACTIVE' && !getOngoingTripForDriver(d.driver_id, d.current_trip_id)
    ).length;
  }, [drivers, busyDriversMap, trips, trip]);

  const ongoingCount = useMemo(() => {
    return drivers.filter(
      (d) => d.status === 'ACTIVE' && Boolean(getOngoingTripForDriver(d.driver_id, d.current_trip_id))
    ).length;
  }, [drivers, busyDriversMap, trips, trip]);

  if (!trip) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-h-[92vh] sm:max-h-[88vh] sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Sticky Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 flex items-start justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Car className="w-4 h-4 text-amber-500" /> Assign Driver to Trip {trip.trip_id}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pickup: <strong className="text-slate-700">{trip.pickup_location}</strong> &rarr;{' '}
              <strong className="text-slate-700">{trip.drop_location}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification if assignment blocked */}
        {assignError && (
          <div className="mx-4 sm:mx-6 mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-center justify-between gap-2 animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{assignError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAssignError(null)}
              className="text-rose-400 hover:text-rose-700 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Driver ID (e.g. DRV-101), Name, or Vehicle No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
            <span className="text-slate-500">
              <strong className="text-emerald-700">{availableCount} available</strong>
              {ongoingCount > 0 && (
                <> &bull; <span className="text-rose-600 font-semibold">{ongoingCount} on ongoing trip</span></>
              )}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterAvailableOnly(!filterAvailableOnly)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                  filterAvailableOnly
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {filterAvailableOnly ? '✓ Available Only' : 'Filter Available'}
              </button>
              <button
                type="button"
                onClick={() => setFilterOnlineOnly(!filterOnlineOnly)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                  filterOnlineOnly
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {filterOnlineOnly ? '● Online Only' : 'Show All'}
              </button>
            </div>
          </div>
        </div>

        {/* Driver List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 space-y-2">
          {filteredDrivers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              No active drivers matching &quot;{searchQuery}&quot;.
            </p>
          ) : (
            filteredDrivers.map((drv) => {
              const ongoingTrip = getOngoingTripForDriver(drv.driver_id, drv.current_trip_id);
              const isBusy = Boolean(ongoingTrip);

              return (
                <div
                  key={drv.driver_id}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 text-xs shadow-2xs ${
                    isBusy
                      ? 'border-slate-200 bg-slate-50/80 opacity-85'
                      : 'border-slate-200 bg-white hover:bg-amber-50/50 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DriverAvatar
                      photoUrl={drv.photo_url}
                      name={drv.driver_name}
                      size="md"
                      isOnline={drv.is_online}
                      showStatusBadge={true}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="font-bold text-slate-900 truncate">{drv.driver_name}</h5>
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">
                          {drv.driver_id}
                        </span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-slate-200">
                          {drv.vehicle_category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-mono font-bold mt-0.5 uppercase">
                        {drv.vehicle_number}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-2.5 h-2.5" /> {drv.mobile_number}
                      </p>

                      {/* Prominent Ongoing Trip Status Indicator */}
                      {isBusy && ongoingTrip && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-rose-600 animate-pulse" />
                            On Ongoing Trip #{ongoingTrip.trip_id} ({ongoingTrip.status === 'IN_PROGRESS' ? 'In Process' : 'Accepted'})
                          </span>
                          {ongoingTrip.drop_location && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[170px]" title={ongoingTrip.drop_location}>
                              &rarr; {ongoingTrip.drop_location}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button: Disabled if already on ongoing/in-process trip */}
                  {isBusy && ongoingTrip ? (
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled
                        title={`Driver ${drv.driver_name} is currently on ongoing trip #${ongoingTrip.trip_id} (${ongoingTrip.status}). Trips cannot be assigned to an ongoing driver.`}
                        className="bg-slate-100 text-slate-400 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-200 cursor-not-allowed flex items-center gap-1.5 opacity-80"
                      >
                        <Ban className="w-3.5 h-3.5 text-rose-500" />
                        <span>On Trip</span>
                      </button>
                      <span className="text-[9px] text-rose-600 font-semibold">Already on trip</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(assigningDriverId)}
                      onClick={async () => {
                        if (isBusy) {
                          setAssignError(`Driver ${drv.driver_name} is already on an ongoing trip. Cannot assign.`);
                          return;
                        }
                        try {
                          setAssigningDriverId(drv.driver_id);
                          setAssignError(null);
                          await onAssign(trip.doc_id || trip.trip_id, drv);
                          onClose();
                        } catch (err: any) {
                          setAssignError(err?.message || 'Failed to assign driver.');
                        } finally {
                          setAssigningDriverId(null);
                        }
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {assigningDriverId === drv.driver_id ? (
                        <span>Assigning...</span>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Assign</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>
            {availableCount} driver{availableCount !== 1 ? 's' : ''} ready to assign
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

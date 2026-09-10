import React, { useState, useMemo, useEffect } from 'react';
import { FirestoreTrip, FirestoreDriver, TripStatus } from '../types';
import {
  History,
  Search,
  Download,
  Filter,
  MapPin,
  Calendar,
  IndianRupee,
  User,
  Car,
  Clock,
  CheckCircle2,
  XCircle,
  KeyRound,
  Trash2,
  Zap,
  Radio,
  Eye,
  TrendingUp,
  Printer,
  ChevronRight,
  ChevronLeft,
  Database,
  LayoutGrid,
  Table as TableIcon,
  RotateCcw,
  CalendarRange,
  Phone,
  ArrowRight,
  Check,
  FileSpreadsheet,
  BadgePercent,
  Receipt,
  X,
  Send,
  AlertCircle,
  Loader2,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';

interface TripHistoryProps {
  trips: FirestoreTrip[];
  drivers?: FirestoreDriver[];
  onDeleteTrip: (tripDocId: string) => Promise<void>;
  globalSearchQuery: string;
  onOpenTrackingModal?: (trip: FirestoreTrip) => void;
  onSetDriverOfficeDue?: (
    driverId: string,
    amount: number,
    note?: string,
    officeUpiId?: string
  ) => Promise<void>;
  onClearDriverOfficeDue?: (driverId: string) => Promise<void>;
  onClearLocalTripStorage?: (clearLocalViewOnly?: boolean) => void;
  isFirebaseConnected?: boolean;
}

type DateFilterPreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

const TRIPS_PER_PAGE = 25;
const LOCAL_STORAGE_KEY = 'trusty_cab_trips_local_v1';

const PAYMENT_NOTE_PRESETS = [
  'Trip CC (Convenience Charge)',
  'Driver Registration Fee',
  'Driver Renewal Fee',
  'Office Weekly Dispatch Fee',
  'CUSTOM',
];

export const TripHistory: React.FC<TripHistoryProps> = ({
  trips,
  drivers = [],
  onDeleteTrip,
  globalSearchQuery,
  onOpenTrackingModal,
  onSetDriverOfficeDue,
  onClearDriverOfficeDue,
  onClearLocalTripStorage,
  isFirebaseConnected = false,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [tripToDelete, setTripToDelete] = useState<FirestoreTrip | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Clear Local Storage states (Only removes browser cache - ZERO backend deletions)
  const [isClearStorageModalOpen, setIsClearStorageModalOpen] = useState<boolean>(false);
  const [isLocalStorageManuallyCleared, setIsLocalStorageManuallyCleared] = useState<boolean>(false);
  const [storageCleanNotification, setStorageCleanNotification] = useState<string | null>(null);

  // Driver Office Due Management state (links trip to its assigned driver only)
  const [feeTrip, setFeeTrip] = useState<FirestoreTrip | null>(null);
  const [feeStep, setFeeStep] = useState<1 | 2 | 3>(1);
  const [feeAmount, setFeeAmount] = useState<string>('50');
  const [feeNotePreset, setFeeNotePreset] = useState<string>('Trip CC (Convenience Charge)');
  const [customFeeNote, setCustomFeeNote] = useState<string>('');
  // Office UPI ID is blank always by default; populated only if user chooses default ID
  const [feeOfficeUpi, setFeeOfficeUpi] = useState<string>('');
  const [isSavingFee, setIsSavingFee] = useState<boolean>(false);
  const [feeFeedback, setFeeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Date Filtering State: Day, Week, Month, Custom Date Range
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  // View mode and pagination
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [localStorageCount, setLocalStorageCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved).length : trips.length;
    } catch {
      return trips.length;
    }
  });

  // Ensure trips are kept updated in LocalStorage (unless manually cleared by user)
  useEffect(() => {
    if (trips.length > 0 && !isLocalStorageManuallyCleared) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trips));
        setLocalStorageCount(trips.length);
      } catch (err) {
        console.warn('Trip localStorage sync warning:', err);
      }
    }
  }, [trips, isLocalStorageManuallyCleared]);

  const handleConfirmClearLocalStorage = (clearViewToo: boolean) => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem('trusty_cab_trips_local_v1');
    } catch (err) {
      console.warn('Could not remove trips from localStorage', err);
    }
    setIsLocalStorageManuallyCleared(true);
    setLocalStorageCount(0);
    onClearLocalTripStorage?.(clearViewToo);
    setIsClearStorageModalOpen(false);

    if (clearViewToo) {
      setStorageCleanNotification(
        'Local storage cache cleared & ledger screen reset! (Backend Firestore database records remain 100% untouched)'
      );
    } else {
      setStorageCleanNotification(
        'Trip history successfully removed from browser local storage! (Backend Firestore database records remain 100% untouched)'
      );
    }
    setTimeout(() => {
      setStorageCleanNotification(null);
    }, 6000);
  };

  // Quick stats across full ledger
  const completedTrips = useMemo(() => trips.filter((t) => t.status === 'COMPLETED'), [trips]);
  const inProgressTrips = useMemo(
    () => trips.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED'),
    [trips]
  );
  const cancelledTrips = useMemo(() => trips.filter((t) => t.status === 'CANCELLED'), [trips]);
  
  const totalRevenue = useMemo(() => {
    return completedTrips.reduce(
      (sum, t) => sum + (t.final_fare || t.estimated_fare || 0),
      0
    );
  }, [completedTrips]);

  const avgFare = completedTrips.length > 0 ? Math.round(totalRevenue / completedTrips.length) : 0;

  // Date Filter Predicate
  const matchesDateFilter = (trip: FirestoreTrip): boolean => {
    if (dateFilter === 'ALL') return true;

    const tripTime = trip.completed_at || trip.created_at || 0;
    if (!tripTime) return true;

    const tripDate = new Date(tripTime);
    const now = new Date();

    if (dateFilter === 'TODAY') {
      return (
        tripDate.getDate() === now.getDate() &&
        tripDate.getMonth() === now.getMonth() &&
        tripDate.getFullYear() === now.getFullYear()
      );
    }

    if (dateFilter === 'WEEK') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setHours(0, 0, 0, 0);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      return tripTime >= sevenDaysAgo.getTime();
    }

    if (dateFilter === 'MONTH') {
      return (
        tripDate.getMonth() === now.getMonth() &&
        tripDate.getFullYear() === now.getFullYear()
      );
    }

    if (dateFilter === 'CUSTOM') {
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        if (tripTime < start.getTime()) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        if (tripTime > end.getTime()) return false;
      }
      return true;
    }

    return true;
  };

  // Filtered trips memoized
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      // 1. Status Filter
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;

      // 2. Date Filter
      if (!matchesDateFilter(t)) return false;

      // 3. Search Query
      const q = (searchQuery || globalSearchQuery).trim().toLowerCase();
      if (q) {
        const matchId = t.trip_id.toLowerCase().includes(q);
        const matchCustomer =
          t.customer_name.toLowerCase().includes(q) || t.customer_phone.includes(q);
        const matchDriver =
          (t.driver_name || '').toLowerCase().includes(q) ||
          (t.driver_id || '').toLowerCase().includes(q);
        const matchVehicle = (t.vehicle_number || '').toLowerCase().includes(q);
        const matchPickup =
          t.pickup_location.toLowerCase().includes(q) || t.drop_location.toLowerCase().includes(q);
        if (!matchId && !matchCustomer && !matchDriver && !matchVehicle && !matchPickup) {
          return false;
        }
      }
      return true;
    });
  }, [trips, selectedStatus, dateFilter, customStartDate, customEndDate, searchQuery, globalSearchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredTrips.length / TRIPS_PER_PAGE) || 1;
  const paginatedTrips = useMemo(() => {
    const page = Math.min(currentPage, totalPages);
    return filteredTrips.slice((page - 1) * TRIPS_PER_PAGE, page * TRIPS_PER_PAGE);
  }, [filteredTrips, currentPage, totalPages]);

  // Reset page on filters change
  const handleDatePresetChange = (preset: DateFilterPreset) => {
    setDateFilter(preset);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (st: string) => {
    setSelectedStatus(st);
    setCurrentPage(1);
  };

  // Find driver associated with this specific trip record
  const getDriverForTrip = (t: FirestoreTrip): FirestoreDriver | null => {
    if (!drivers || drivers.length === 0) return null;
    const cleanDriverId = (t.driver_id || '').trim().toUpperCase();
    const cleanVeh = (t.vehicle_number || '').trim().toUpperCase().replace(/\s+/g, '');
    return (
      drivers.find(
        (d) =>
          (cleanDriverId && (d.driver_id.trim().toUpperCase() === cleanDriverId || d.doc_id === t.driver_id)) ||
          (cleanVeh && d.vehicle_number.trim().toUpperCase().replace(/\s+/g, '') === cleanVeh)
      ) || null
    );
  };

  const handleOpenDriverFeeModal = (t: FirestoreTrip) => {
    setFeeTrip(t);
    setFeeStep(1);
    setFeeFeedback(null);
    const drv = getDriverForTrip(t);
    if (drv) {
      setFeeAmount(drv.payment_amount && drv.payment_amount > 0 ? String(drv.payment_amount) : '50');
      // Office UPI ID is set blank always by default; user can choose default ID if desired
      setFeeOfficeUpi('');
      if (drv.payment_note) {
        if (PAYMENT_NOTE_PRESETS.includes(drv.payment_note)) {
          setFeeNotePreset(drv.payment_note);
          setCustomFeeNote('');
        } else {
          setFeeNotePreset('CUSTOM');
          setCustomFeeNote(drv.payment_note);
        }
      } else {
        setFeeNotePreset('Trip CC (Convenience Charge)');
        setCustomFeeNote('');
      }
    } else {
      setFeeAmount('50');
      setFeeOfficeUpi('');
      setFeeNotePreset('Trip CC (Convenience Charge)');
      setCustomFeeNote('');
    }
  };

  const handleSaveDriverFee = async () => {
    if (!feeTrip || !onSetDriverOfficeDue) return;
    const drv = getDriverForTrip(feeTrip);
    const targetDriverId = drv?.driver_id || feeTrip.driver_id;
    if (!targetDriverId) {
      setFeeFeedback({ type: 'error', message: 'No driver ID found for this trip record.' });
      return;
    }

    const numAmount = Math.max(0, Number(feeAmount) || 0);
    const note = feeNotePreset === 'CUSTOM' ? (customFeeNote.trim() || 'Trip CC (Convenience Charge)') : feeNotePreset;

    setIsSavingFee(true);
    setFeeFeedback(null);
    try {
      await onSetDriverOfficeDue(targetDriverId, numAmount, note, feeOfficeUpi);
      setFeeFeedback({
        type: 'success',
        message: numAmount > 0 
          ? `Updated driver ${drv?.driver_name || targetDriverId}: ₹${numAmount} due ("${note}")`
          : `Driver dues cleared to ₹0 (Verified)`,
      });
      setTimeout(() => {
        setFeeTrip(null);
        setFeeFeedback(null);
        setFeeStep(1);
      }, 1300);
    } catch (err: any) {
      setFeeFeedback({ type: 'error', message: err?.message || 'Failed to update office fee.' });
    } finally {
      setIsSavingFee(false);
    }
  };

  const handleClearDriverFee = async () => {
    if (!feeTrip || !onClearDriverOfficeDue) return;
    const drv = getDriverForTrip(feeTrip);
    const targetDriverId = drv?.driver_id || feeTrip.driver_id;
    if (!targetDriverId) {
      setFeeFeedback({ type: 'error', message: 'No driver ID found for this trip record.' });
      return;
    }

    setIsSavingFee(true);
    setFeeFeedback(null);
    try {
      await onClearDriverOfficeDue(targetDriverId);
      setFeeFeedback({
        type: 'success',
        message: `Driver ${drv?.driver_name || targetDriverId} dues marked CLEARED & VERIFIED (₹0).`,
      });
      setTimeout(() => {
        setFeeTrip(null);
        setFeeFeedback(null);
        setFeeStep(1);
      }, 1300);
    } catch (err: any) {
      setFeeFeedback({ type: 'error', message: err?.message || 'Failed to clear office fee.' });
    } finally {
      setIsSavingFee(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Trip ID',
      'Status',
      'Date & Time',
      'Customer Name',
      'Customer Phone',
      'Pickup Location',
      'Dropoff Location',
      'Driver Name',
      'Driver ID',
      'Vehicle Number',
      'Vehicle Category',
      'Estimated Fare (INR)',
      'Final Fare (INR)',
      'Distance (KM)',
      'OTP',
      'Completed At',
    ];

    const rows = filteredTrips.map((t) => [
      `"${t.trip_id.replace(/^TRIP-?/, '')}"`,
      `"${t.status}"`,
      `"${new Date(t.created_at).toLocaleString()}"`,
      `"${t.customer_name}"`,
      `"${t.customer_phone}"`,
      `"${t.pickup_location.replace(/"/g, '""')}"`,
      `"${t.drop_location.replace(/"/g, '""')}"`,
      `"${t.driver_name || 'Unassigned'}"`,
      `"${t.driver_id || ''}"`,
      `"${t.vehicle_number || ''}"`,
      `"${t.vehicle_category || ''}"`,
      t.estimated_fare || 0,
      t.final_fare || t.estimated_fare || 0,
      t.distance_km || 0,
      `"${t.otp || ''}"`,
      `"${t.completed_at ? new Date(t.completed_at).toLocaleString() : 'N/A'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateLabel =
      dateFilter === 'TODAY'
        ? 'Today'
        : dateFilter === 'WEEK'
        ? 'ThisWeek'
        : dateFilter === 'MONTH'
        ? 'ThisMonth'
        : 'Ledger';
    link.setAttribute(
      'download',
      `TrustyYellowCab_Trips_${dateLabel}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> COMPLETED
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
            <Clock className="w-2.5 h-2.5 text-purple-600 animate-spin" /> ON RIDE
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-200">
            ACCEPTED
          </span>
        );
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
            OPEN
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
            <XCircle className="w-2.5 h-2.5 text-slate-400" /> CANCELLED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast Notification when Local Storage is Cleaned */}
      {storageCleanNotification && (
        <div className="bg-emerald-50 border border-emerald-200/90 text-emerald-950 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs transition animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{storageCleanNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setStorageCleanNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Banner with LocalStorage Persistence Indicator & View Toggle */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Trip Management &amp; Ledger
              </h2>
              {localStorageCount > 0 ? (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  <Database className="w-2.5 h-2.5 text-emerald-600" /> Local Storage Active ({localStorageCount} stored)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Local Storage Clean (0 stored)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive operational trip ledger with date-wise search, live route tracking, and operations auditing.
            </p>
          </div>
        </div>

        {/* View Mode Switcher and Quick Actions */}
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end flex-wrap sm:flex-nowrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          {/* Clear Local Storage Button (Only affects browser local cache, NOT backend) */}
          <button
            type="button"
            onClick={() => setIsClearStorageModalOpen(true)}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90 font-bold px-3.5 py-2 rounded-xl text-xs shadow-2xs transition cursor-pointer shrink-0 min-h-[38px]"
            title="Clean local browser storage for trips (Backend database remains untouched)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Clear Local Storage</span>
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-2xs transition cursor-pointer shrink-0 min-h-[38px]"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
        {/* Total Ledger Fares */}
        <div className="min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Settled Revenue
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs sm:text-sm shadow-2xs shrink-0">
              ₹
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight tabular-nums truncate">
              ₹{totalRevenue.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold">settled</span>
          </div>
        </div>

        {/* Completed Rides */}
        <div className="min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Completed Rides
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight tabular-nums truncate">
              {completedTrips.length}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">completed</span>
          </div>
        </div>

        {/* Active Journeys */}
        <div className="min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Active / On Ride
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl font-black text-purple-700 tracking-tight tabular-nums truncate">
              {inProgressTrips.length}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">live journeys</span>
          </div>
        </div>

        {/* Average Ticket Size */}
        <div className="min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Average Ticket
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl font-black text-sky-700 tracking-tight tabular-nums truncate">
              ₹{avgFare}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">per ride</span>
          </div>
        </div>
      </div>

      {/* Modern Filter Toolbar: Date Wise Search (Day, Week, Month, Custom) + Status Tabs */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5 sm:space-y-4">
        {/* ===================== MOBILE DEDICATED LAYOUT (< sm) ===================== */}
        <div className="sm:hidden space-y-3">
          {/* Top Quick Header: Live Indicator, View Mode & Export CSV */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Ledger
              </span>
              <span className="text-xs font-bold text-slate-500 tabular-nums">
                ({filteredTrips.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Table / Cards View Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-950 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Table View"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-slate-950 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Clear Local Storage & Export CSV Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsClearStorageModalOpen(true)}
                  className="bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200/90 font-bold text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs min-h-[38px] cursor-pointer select-none active:scale-95 transition"
                  title="Clear Local Storage (Backend safe)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden xs:inline">Clear Storage</span>
                  <span className="xs:hidden">Clean</span>
                </button>

                <button
                  type="button"
                  onClick={exportToCSV}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs min-h-[38px] cursor-pointer select-none active:scale-95 transition"
                  title="Export filtered records to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>

          {/* Full-width Touch-friendly Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search trip ID, passenger, phone, cab..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200/90 rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px] transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center active:scale-90 transition"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Filter Segmented Carousel */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-500" />
                <span>Date Range</span>
              </span>
              {dateFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => handleDatePresetChange('ALL')}
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-800 cursor-pointer"
                >
                  Reset Date
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today (Day)' },
                { id: 'WEEK', label: 'This Week' },
                { id: 'MONTH', label: 'This Month' },
                { id: 'CUSTOM', label: 'Custom Range' },
              ].map((preset) => {
                const isActive = dateFilter === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleDatePresetChange(preset.id as DateFilterPreset)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 min-h-[40px] active:scale-95 whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Range Picker Card (Visible if CUSTOM is selected) */}
          {dateFilter === 'CUSTOM' && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/90 rounded-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[38px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[38px]"
                  />
                </div>
              </div>

              {(customStartDate || customEndDate) && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setCurrentPage(1);
                    }}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg cursor-pointer transition active:scale-95"
                  >
                    Clear Dates
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Status Filter Carousel with Count Badges */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-amber-500" />
                <span>Trip Status</span>
              </span>
              {selectedStatus !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => handleStatusFilterChange('ALL')}
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-800 cursor-pointer"
                >
                  Reset Status
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
              {[
                { key: 'ALL', label: 'All Trips', dot: '' },
                { key: 'COMPLETED', label: 'Completed', dot: 'bg-emerald-500' },
                { key: 'IN_PROGRESS', label: 'On Ride', dot: 'bg-purple-500' },
                { key: 'ACCEPTED', label: 'Accepted', dot: 'bg-sky-500' },
                { key: 'OPEN', label: 'Open', dot: 'bg-amber-500' },
                { key: 'CANCELLED', label: 'Cancelled', dot: 'bg-slate-400' },
              ].map((st) => {
                const count =
                  st.key === 'ALL'
                    ? trips.length
                    : trips.filter((t) => t.status === st.key).length;
                const isActive = selectedStatus === st.key;
                return (
                  <button
                    key={st.key}
                    onClick={() => handleStatusFilterChange(st.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 min-h-[42px] active:scale-95 whitespace-nowrap ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                    }`}
                  >
                    {st.dot && <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shrink-0`}></span>}
                    <span>{st.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums whitespace-nowrap ${
                        isActive
                          ? 'bg-slate-950 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset All Filters Bar (When active) */}
          {(selectedStatus !== 'ALL' || dateFilter !== 'ALL' || searchQuery || customStartDate || customEndDate) && (
            <button
              onClick={() => {
                setSelectedStatus('ALL');
                setDateFilter('ALL');
                setSearchQuery('');
                setCustomStartDate('');
                setCustomEndDate('');
                setCurrentPage(1);
              }}
              className="w-full text-xs font-bold text-amber-950 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95 cursor-pointer transition shadow-2xs"
              title="Reset All Filters to Default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* ===================== DESKTOP / TABLET LAYOUT (sm+) ===================== */}
        <div className="hidden sm:block space-y-4">
          {/* Date Filter Selection Row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mr-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>Date Filter:</span>
              </span>

              {(
                [
                  { id: 'ALL', label: 'All Time' },
                  { id: 'TODAY', label: 'Today (Day)' },
                  { id: 'WEEK', label: 'This Week' },
                  { id: 'MONTH', label: 'This Month' },
                  { id: 'CUSTOM', label: 'Custom Date Range' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleDatePresetChange(preset.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    dateFilter === preset.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* If Custom Date Range is selected, show date inputs */}
            {dateFilter === 'CUSTOM' && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto pt-1 lg:pt-0">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-slate-500 font-medium">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-slate-500 font-medium">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setCurrentPage(1);
                    }}
                    className="p-1 px-2 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Status Filter Tabs & Search Bar Row */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Status Tabs with count badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {[
                { key: 'ALL', label: 'All Trips' },
                { key: 'COMPLETED', label: 'Completed' },
                { key: 'IN_PROGRESS', label: 'On Ride' },
                { key: 'ACCEPTED', label: 'Accepted' },
                { key: 'OPEN', label: 'Open' },
                { key: 'CANCELLED', label: 'Cancelled' },
              ].map((st) => {
                const count =
                  st.key === 'ALL'
                    ? trips.length
                    : trips.filter((t) => t.status === st.key).length;
                return (
                  <button
                    key={st.key}
                    onClick={() => handleStatusFilterChange(st.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      selectedStatus === st.key
                        ? 'bg-amber-400 text-slate-950 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    <span>{st.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        selectedStatus === st.key
                          ? 'bg-slate-950 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Box & Reset on Desktop */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ID, passenger, phone, cab..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {(selectedStatus !== 'ALL' || dateFilter !== 'ALL' || searchQuery || customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setSelectedStatus('ALL');
                    setDateFilter('ALL');
                    setSearchQuery('');
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1 active:scale-95 shrink-0"
                  title="Reset All Active Filters"
                >
                  <RotateCcw className="w-3 h-3 text-amber-700" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter summary indicator */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          Showing <strong className="text-slate-800">{filteredTrips.length}</strong> trip record
          {filteredTrips.length === 1 ? '' : 's'}{' '}
          {dateFilter !== 'ALL' && (
            <span>
              in <strong>{dateFilter.toLowerCase()}</strong> range
            </span>
          )}
        </div>
        {dateFilter === 'CUSTOM' && (customStartDate || customEndDate) && (
          <span className="text-[11px] font-mono bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
            {customStartDate || 'Start'} → {customEndDate || 'Present'}
          </span>
        )}
      </div>

      {/* Main Trip Records Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredTrips.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
              <History className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-black text-slate-900">No matching trips found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No trip ledger history matches your selected status, search query, or date range.
            </p>
            <button
              onClick={() => {
                setSelectedStatus('ALL');
                setDateFilter('ALL');
                setSearchQuery('');
                setCustomStartDate('');
                setCustomEndDate('');
                setCurrentPage(1);
              }}
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards Grid View (Responsive & Touch-Friendly) */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/40">
            {paginatedTrips.map((t) => (
              <div
                key={t.doc_id || t.trip_id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between gap-3.5"
              >
                {/* Header: ID, Date, Status */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-black text-slate-900 text-sm tracking-tight">
                      #{t.trip_id.replace(/^TRIP-?/, '')}
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {new Date(t.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>{getStatusBadge(t.status)}</div>
                </div>

                {/* Customer & Cab Meta */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{t.customer_name}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">{t.customer_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-slate-950 font-mono">
                      ₹{t.final_fare || t.estimated_fare || 0}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {t.vehicle_category || 'Mini'}
                    </p>
                  </div>
                </div>

                {/* Journey Route */}
                <div className="space-y-2 text-xs bg-white p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-600 mt-1 shrink-0" />
                    <span className="text-slate-800 text-xs font-medium line-clamp-1 leading-relaxed">
                      {t.pickup_location}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-600 mt-1 shrink-0" />
                    <span className="text-slate-600 text-xs line-clamp-1 leading-relaxed">
                      {t.drop_location}
                    </span>
                  </div>
                </div>

                {/* Driver Details & Office Fee Status */}
                {(() => {
                  const driverForTrip = getDriverForTrip(t);
                  return (
                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Driver: <strong className="text-slate-900">{t.driver_name || driverForTrip?.driver_name || 'Unassigned'}</strong>
                          </span>
                        </div>
                        <span className="font-mono text-slate-500 shrink-0">{t.vehicle_number || driverForTrip?.vehicle_number || ''}</span>
                      </div>

                      {/* Driver Fee Status & Edit Button for Assigned Driver Only */}
                      {(t.driver_id || driverForTrip) && onSetDriverOfficeDue && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-xs">
                          <div>
                            {driverForTrip?.payment_status === 'DUE' && (driverForTrip.payment_amount || 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <span>₹{driverForTrip.payment_amount} Due</span>
                                <span className="opacity-70 font-normal">({driverForTrip.payment_note || 'Trip CC'})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Dues Cleared</span>
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenDriverFeeModal(t)}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-950 bg-amber-300 hover:bg-amber-400 active:bg-amber-500 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                            title={`Edit Office Fee for driver ${t.driver_name || t.driver_id}`}
                          >
                            <IndianRupee className="w-3 h-3 text-amber-900" />
                            <span>Edit Office Fee</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Action Buttons: Live Tracking (if available), Delete */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {onOpenTrackingModal && (
                    <button
                      onClick={() => onOpenTrackingModal(t)}
                      className="flex-1 min-h-[40px] text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 px-3 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Open Live Tracking & Route"
                    >
                      <Radio className="w-3.5 h-3.5 text-slate-950" />
                      <span>Track Route</span>
                    </button>
                  )}

                  <button
                    onClick={() => setTripToDelete(t)}
                    className={`${
                      onOpenTrackingModal ? 'w-10' : 'flex-1'
                    } min-h-[40px] flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-100 transition cursor-pointer shrink-0`}
                    title="Delete Trip Record"
                  >
                    <Trash2 className="w-4 h-4" />
                    {!onOpenTrackingModal && <span className="ml-1.5 text-xs font-bold">Delete Record</span>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View (Desktop Structured Table) */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/90 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Trip ID</th>
                  <th className="py-3.5 px-4">Date &amp; Time</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Journey Route</th>
                  <th className="py-3.5 px-4">Driver &amp; Cab</th>
                  <th className="py-3.5 px-4">Fare (INR)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTrips.map((t) => (
                  <tr key={t.doc_id || t.trip_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-black text-slate-900">
                        #{t.trip_id.replace(/^TRIP-?/, '')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {t.vehicle_category || 'Mini'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {new Date(t.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(t.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{t.customer_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5 text-slate-400" />
                        <span>{t.customer_phone}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="space-y-1">
                        <div className="text-slate-800 font-normal truncate flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                          <span className="truncate">{t.pickup_location}</span>
                        </div>
                        <div className="text-slate-500 truncate flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                          <span className="truncate">{t.drop_location}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {(() => {
                        const driverForTrip = getDriverForTrip(t);
                        return (
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{t.driver_name || driverForTrip?.driver_name || 'Unassigned'}</span>
                              {driverForTrip && (
                                driverForTrip.payment_status === 'DUE' && (driverForTrip.payment_amount || 0) > 0 ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                    ₹{driverForTrip.payment_amount} Due
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Cleared
                                  </span>
                                )
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <span>{t.vehicle_number || driverForTrip?.vehicle_number || t.driver_id || 'No Cab'}</span>
                              {driverForTrip?.payment_note && driverForTrip.payment_status === 'DUE' && (
                                <span className="text-[9px] text-slate-400 truncate max-w-[120px]">
                                  • {driverForTrip.payment_note}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-black text-slate-950 text-sm font-mono">
                        ₹{t.final_fare || t.estimated_fare || 0}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {t.distance_km ? `${t.distance_km} km` : 'Fixed'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(t.status)}</td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {(t.driver_id || getDriverForTrip(t)) && onSetDriverOfficeDue && (
                          <button
                            type="button"
                            onClick={() => handleOpenDriverFeeModal(t)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title={`Edit Office Fee for driver who completed this trip (${t.driver_name || t.driver_id})`}
                          >
                            <IndianRupee className="w-3.5 h-3.5 text-amber-800" />
                            <span>Edit Office Fee</span>
                          </button>
                        )}

                        {onOpenTrackingModal && (
                          <button
                            onClick={() => onOpenTrackingModal(t)}
                            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="Open Live Tracking & Route"
                          >
                            <Radio className="w-3.5 h-3.5 text-slate-950" />
                            <span>Track</span>
                          </button>
                        )}

                        <button
                          onClick={() => setTripToDelete(t)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Trip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {filteredTrips.length > TRIPS_PER_PAGE && (
          <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{(currentPage - 1) * TRIPS_PER_PAGE + 1}</strong> to{' '}
              <strong className="text-slate-800">
                {Math.min(currentPage * TRIPS_PER_PAGE, filteredTrips.length).toLocaleString()}
              </strong>{' '}
              of <strong className="text-slate-800">{filteredTrips.length.toLocaleString()}</strong> trips
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1 font-semibold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                <span className="font-bold text-slate-900 bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg">
                  {currentPage}
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-slate-600 font-medium">{totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1 font-semibold"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Trip Confirmation Modal */}
      {tripToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Trip Record</h3>
                <p className="text-xs text-slate-500">Permanently remove from trip history &amp; ledger</p>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>Trip #{tripToDelete.trip_id.replace(/^TRIP-?/, '')}</span>
                <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {tripToDelete.status}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                Customer: <strong>{tripToDelete.customer_name}</strong> ({tripToDelete.customer_phone})
              </div>
              <div className="text-xs text-slate-500 truncate mt-1">
                Route: {tripToDelete.pickup_location} → {tripToDelete.drop_location}
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this trip record? This operation will remove it from both local storage and cloud database.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setTripToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const idToDelete = tripToDelete.doc_id || tripToDelete.trip_id;
                    await onDeleteTrip(idToDelete);
                    setTripToDelete(null);
                  } catch (err) {
                    console.error('Failed to delete trip:', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Driver Office Fee Modal (Only for driver who took this trip) */}
      {feeTrip && (() => {
        const drv = getDriverForTrip(feeTrip);
        const targetDriverId = drv?.driver_id || feeTrip.driver_id || 'UNKNOWN';
        const targetDriverName = drv?.driver_name || feeTrip.driver_name || targetDriverId;
        const currentAmount = drv?.payment_amount || 0;
        const currentStatus = drv?.payment_status || 'CLEARED';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 overflow-hidden relative animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
              {/* Header: Clean, modern, no bulky icon container */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900">
                      Trip Office Fee
                    </h3>
                    <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                      Trip #{feeTrip.trip_id.replace(/^TRIP-?/, '')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    Driver: <span className="font-semibold text-slate-800">{targetDriverName}</span> • <span className="font-mono">{feeTrip.vehicle_number || drv?.vehicle_number || 'No Vehicle'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFeeTrip(null);
                    setFeeFeedback(null);
                    setFeeStep(1);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Full Visible Trip Details Card - Complete Route, No Truncation */}
              <div className="mt-3 p-3 sm:p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2.5 shrink-0">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Trip Information
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                      Fare: ₹{feeTrip.final_fare || feeTrip.estimated_fare || 0}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                      feeTrip.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-blue-100 text-blue-900 border border-blue-300'
                    }`}>
                      {feeTrip.status}
                    </span>
                  </div>
                </div>

                {/* Full Route Details - Fully Visible, No Truncation */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pickup Location</span>
                      <p className="font-semibold text-slate-900 break-words text-xs leading-snug">
                        {feeTrip.pickup_location || 'Not Specified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100 mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Drop Location</span>
                      <p className="font-semibold text-slate-900 break-words text-xs leading-snug">
                        {feeTrip.drop_location || 'Not Specified'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Driver, Vehicle & Passenger Grid */}
                <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Assigned Driver</span>
                    <span className="font-bold text-slate-800">{targetDriverName}</span>{' '}
                    <span className="font-mono text-slate-500">({targetDriverId})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Vehicle Plate</span>
                    <span className="font-mono font-bold text-slate-800">
                      {feeTrip.vehicle_number || drv?.vehicle_number || 'N/A'}
                    </span>
                  </div>
                  {feeTrip.customer_name && (
                    <div className="col-span-2 flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/40">
                      <span className="text-slate-500">Customer: <strong className="text-slate-700">{feeTrip.customer_name}</strong></span>
                      {feeTrip.customer_phone && (
                        <span className="font-mono text-slate-600">{feeTrip.customer_phone}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Current Driver Due Status */}
                <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Driver Office Due:</span>
                  {currentStatus === 'DUE' && currentAmount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      ₹{currentAmount} DUE {drv?.payment_note ? `(${drv.payment_note})` : ''}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      CLEARED / VERIFIED
                    </span>
                  )}
                </div>
              </div>

              {/* Step-by-Step Progress Navigation */}
              <div className="mt-3 grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setFeeStep(1)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    feeStep === 1
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                    feeStep === 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                  }`}>
                    1
                  </span>
                  <span>Amount</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFeeStep(2)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    feeStep === 2
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                    feeStep === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                  }`}>
                    2
                  </span>
                  <span>Purpose</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFeeStep(3)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    feeStep === 3
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                    feeStep === 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                  }`}>
                    3
                  </span>
                  <span>Confirm</span>
                </button>
              </div>

              {/* Feedback Alert */}
              {feeFeedback && (
                <div
                  className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 shrink-0 ${
                    feeFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border border-rose-200'
                  }`}
                >
                  {feeFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-semibold">{feeFeedback.message}</span>
                </div>
              )}

              {/* Step Body */}
              <div className="mt-3 flex-1 overflow-y-auto space-y-3.5 text-xs pr-0.5">
                {/* STEP 1: AMOUNT */}
                {feeStep === 1 && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5">
                        Office Fee / CC Amount (₹ INR)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-lg">
                          ₹
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          required
                          autoFocus
                          value={feeAmount}
                          onChange={(e) => setFeeAmount(e.target.value)}
                          placeholder="e.g. 50"
                          className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-xl font-bold focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                    </div>

                    {/* Fast Preset Chips */}
                    <div>
                      <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                        Quick Fee Presets
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['30', '50', '100', '150', '200', '300', '500', '1000'].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setFeeAmount(amt)}
                            className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center ${
                              feeAmount === amt
                                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs font-black'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Instant Clear Due Option */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setFeeAmount('0')}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          feeAmount === '0'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Set to ₹0 (Clear All Dues)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: PURPOSE / NOTE */}
                {feeStep === 2 && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5">
                        Payment Reason / Note
                      </label>
                      <div className="space-y-1.5">
                        {PAYMENT_NOTE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFeeNotePreset(preset)}
                            className={`w-full p-2.5 rounded-xl border text-left font-bold text-xs transition cursor-pointer flex items-center justify-between ${
                              feeNotePreset === preset
                                ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{preset}</span>
                            {feeNotePreset === preset && (
                              <Check className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Note Option */}
                    <div className="pt-1">
                      <label className="block text-slate-600 font-semibold text-[11px] mb-1">
                        Custom Note or Details (Optional)
                      </label>
                      <input
                        type="text"
                        value={customFeeNote}
                        onChange={(e) => {
                          setCustomFeeNote(e.target.value);
                          if (feeNotePreset !== 'CUSTOM') {
                            setFeeNotePreset('CUSTOM');
                          }
                        }}
                        placeholder={`e.g. Convenience charge for Trip #${feeTrip.trip_id}`}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 3: CONFIRMATION & OFFICE UPI */}
                {feeStep === 3 && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    {/* Summary Card */}
                    <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Driver:</span>
                        <span className="font-bold text-slate-900">
                          {targetDriverName} ({targetDriverId})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Vehicle:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {feeTrip.vehicle_number || drv?.vehicle_number || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Trip ID:</span>
                        <span className="font-mono font-bold text-slate-800">
                          #{feeTrip.trip_id}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-amber-200/80 pt-2">
                        <span className="text-slate-600 font-medium">Fee Amount:</span>
                        <span className="text-base font-black text-amber-950">
                          ₹{feeAmount || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Note / Reason:</span>
                        <span className="font-bold text-slate-900 text-right truncate max-w-[200px]">
                          {feeNotePreset === 'CUSTOM' ? (customFeeNote.trim() || 'Trip CC (Convenience Charge)') : feeNotePreset}
                        </span>
                      </div>
                    </div>

                    {/* Office UPI ID */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-slate-700 font-bold text-xs">
                          Office UPI ID <span className="text-slate-400 font-normal">(Default is blank)</span>
                        </label>
                        {feeOfficeUpi ? (
                          <button
                            type="button"
                            onClick={() => setFeeOfficeUpi('')}
                            className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                          >
                            Set Blank
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFeeOfficeUpi('123mdcreation@okaxis')}
                            className="text-[11px] text-amber-800 hover:text-amber-900 font-bold bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-lg transition cursor-pointer"
                          >
                            + Choose Default ID
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={feeOfficeUpi}
                        onChange={(e) => setFeeOfficeUpi(e.target.value)}
                        placeholder="Blank (No UPI) - click '+ Choose Default ID' if wanted"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-slate-50/50"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                        {feeOfficeUpi.trim() ? (
                          <span className="text-emerald-700 font-semibold">
                            {feeOfficeUpi.trim() === '123mdcreation@okaxis'
                              ? '✓ Default ID: 123mdcreation@okaxis'
                              : `✓ Custom: ${feeOfficeUpi.trim()}`}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">
                            Currently Blank (Leave blank unless you want to attach a UPI ID)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step Navigation & Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  {feeStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setFeeStep((prev) => (prev - 1) as 1 | 2)}
                      className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFeeTrip(null);
                        setFeeFeedback(null);
                        setFeeStep(1);
                      }}
                      className="px-3.5 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  {/* Optional Quick Clear Button if currently has dues */}
                  {currentAmount > 0 && (
                    <button
                      type="button"
                      disabled={isSavingFee}
                      onClick={handleClearDriverFee}
                      className="hidden sm:flex px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer items-center gap-1"
                      title="Clear dues immediately to ₹0"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Clear (₹0)</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {feeStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setFeeStep((prev) => (prev + 1) as 2 | 3)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSavingFee}
                      onClick={handleSaveDriverFee}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {isSavingFee ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            {Number(feeAmount) > 0
                              ? `Set Fee (₹${feeAmount})`
                              : 'Clear Dues (₹0)'}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* ===================== CLEAR LOCAL STORAGE MODAL ===================== */}
      {isClearStorageModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shadow-xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Clear Local Storage History
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Browser storage cleanup only
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearStorageModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Reassurance Callout: NOT Backend */}
            <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Backend Database Protected (Zero Cloud Deletions)</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed pl-6">
                This action strictly removes trip records cached in your web browser's Local Storage. <strong>No trips or ledger history will be deleted from your Firestore database or remote servers.</strong>
              </p>
            </div>

            {/* Storage Details */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Storage Key:</span>
                <span className="font-mono font-bold text-slate-800">trusty_cab_trips_local_v1</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Current Cached Trips:</span>
                <span className="font-bold text-slate-900 tabular-nums">{localStorageCount} records</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Cloud Sync Status:</span>
                <span className="font-bold text-slate-900">
                  {isFirebaseConnected ? 'Connected (Firestore active)' : 'Standalone / Local cache'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmClearLocalStorage(false)}
                className="w-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black py-2.5 px-4 rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clean Local Storage Cache Only</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmClearLocalStorage(true)}
                className="w-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Clean Storage &amp; Reset Screen View</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClearStorageModalOpen(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-700 text-xs font-bold transition cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

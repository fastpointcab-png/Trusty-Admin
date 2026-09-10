import React, { useState, useMemo } from 'react';
import { FirestoreDriver, DriverStatus, VehicleCategory } from '../types';
import {
  Users,
  Plus,
  Search,
  Filter,
  Phone,
  PhoneCall,
  Car,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  RefreshCcw,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  ExternalLink,
  LayoutGrid,
  List,
  Check,
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Database,
  Loader2,
  Wallet,
  IndianRupee,
  User,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { DriverPhotoUploader } from './modals/DriverPhotoUploader';

interface DriverManagementProps {
  drivers: FirestoreDriver[];
  onOpenNewDriverModal: () => void;
  onToggleDriverStatus: (driverId: string) => Promise<void>;
  onResetDeviceBinding: (driverId: string) => Promise<void>;
  onDeleteDriver: (driverId: string) => Promise<void>;
  onUpdateDriver: (driverId: string, data: Partial<FirestoreDriver>) => Promise<void>;
  onCleanDriversTable?: () => Promise<{
    totalScanned: number;
    fieldsCleaned: number;
    duplicatesRemoved: number;
    success: boolean;
  }>;
  onSetDriverOfficeDue?: (
    driverId: string,
    amount: number,
    note?: string,
    officeUpiId?: string
  ) => Promise<void>;
  onClearDriverOfficeDue?: (driverId: string) => Promise<void>;
  isFirebaseConnected?: boolean;
  globalSearchQuery: string;
}

const DRIVERS_PER_PAGE = 36; // Optimized for 2000+ driver fleet (fits 1, 2, 3, 4 col grids evenly)

export const DEFAULT_PAYMENT_NOTE = 'Trip CC (Convenience Charge)';

export const PAYMENT_NOTE_PRESETS = [
  'Trip CC (Convenience Charge)',
  'Driver Registration Fee',
  'Driver Renewal Fee',
  'Office Weekly Dispatch Fee',
] as const;

export const DriverManagement: React.FC<DriverManagementProps> = ({
  drivers,
  onOpenNewDriverModal,
  onToggleDriverStatus,
  onResetDeviceBinding,
  onDeleteDriver,
  onUpdateDriver,
  onCleanDriversTable,
  onSetDriverOfficeDue,
  onClearDriverOfficeDue,
  isFirebaseConnected,
  globalSearchQuery,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [editingDriver, setEditingDriver] = useState<FirestoreDriver | null>(null);
  const [editDriverStep, setEditDriverStep] = useState<1 | 2 | 3>(1);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editFeedback, setEditFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<FirestoreDriver | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // Office Dues Management State (Clean Step-by-Step UI)
  const [managingDueDriver, setManagingDueDriver] = useState<FirestoreDriver | null>(null);
  const [dueStep, setDueStep] = useState<1 | 2 | 3>(1);
  const [dueAmountInput, setDueAmountInput] = useState<string>('500');
  const [dueNoteInput, setDueNoteInput] = useState<string>(DEFAULT_PAYMENT_NOTE);
  // Office UPI ID is blank always by default; populated only if user explicitly chooses default ID
  const [officeUpiInput, setOfficeUpiInput] = useState<string>('');
  const [isSavingDue, setIsSavingDue] = useState<boolean>(false);
  const [dueFeedbackMsg, setDueFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const openDueModal = (drv: FirestoreDriver) => {
    setManagingDueDriver(drv);
    setDueStep(1);
    setDueAmountInput(
      drv.payment_amount !== undefined && drv.payment_amount > 0 ? String(drv.payment_amount) : '500'
    );
    setDueNoteInput(drv.payment_note || DEFAULT_PAYMENT_NOTE);
    // Always start blank as requested: user can click "Choose Default ID" if wanted
    setOfficeUpiInput('');
    setDueFeedbackMsg(null);
  };

  const handleSaveDue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!managingDueDriver || !onSetDriverOfficeDue) return;
    const amountNum = Math.max(0, Number(dueAmountInput) || 0);
    setIsSavingDue(true);
    setDueFeedbackMsg(null);
    try {
      await onSetDriverOfficeDue(
        managingDueDriver.driver_id,
        amountNum,
        dueNoteInput.trim() || DEFAULT_PAYMENT_NOTE,
        officeUpiInput.trim()
      );
      setDueFeedbackMsg({
        text:
          amountNum > 0
            ? `✓ ₹${amountNum} due set for ${managingDueDriver.driver_name}. Live sync sent to Driver App!`
            : `✓ Dues cleared for ${managingDueDriver.driver_name}!`,
        type: 'success',
      });
      setTimeout(() => {
        setManagingDueDriver(null);
        setDueFeedbackMsg(null);
        setDueStep(1);
      }, 1500);
    } catch {
      setDueFeedbackMsg({ text: 'Failed to update due in Firebase.', type: 'error' });
    } finally {
      setIsSavingDue(false);
    }
  };

  const handleClearDue = async () => {
    if (!managingDueDriver) return;
    setIsSavingDue(true);
    setDueFeedbackMsg(null);
    try {
      if (onClearDriverOfficeDue) {
        await onClearDriverOfficeDue(managingDueDriver.driver_id);
      } else if (onSetDriverOfficeDue) {
        await onSetDriverOfficeDue(
          managingDueDriver.driver_id,
          0,
          'Cleared',
          officeUpiInput.trim()
        );
      }
      setDueFeedbackMsg({
        text: `✓ All dues cleared (₹0) for ${managingDueDriver.driver_name}!`,
        type: 'success',
      });
      setTimeout(() => {
        setManagingDueDriver(null);
        setDueFeedbackMsg(null);
        setDueStep(1);
      }, 1300);
    } catch {
      setDueFeedbackMsg({ text: 'Failed to clear due in Firebase.', type: 'error' });
    } finally {
      setIsSavingDue(false);
    }
  };

  // Summary counts - memoized for 2000+ driver fleet
  const totalFleet = drivers.length;
  const onlineDrivers = useMemo(() => drivers.filter((d) => d.is_online && d.status === 'ACTIVE'), [drivers]);
  const activeKyc = useMemo(() => drivers.filter((d) => d.status === 'ACTIVE'), [drivers]);
  const offlineDriversCount = useMemo(() => drivers.filter((d) => !d.is_online).length, [drivers]);
  const blockedDrivers = useMemo(() => drivers.filter((d) => d.status === 'BLOCKED'), [drivers]);
  const driversWithDue = useMemo(() => drivers.filter((d) => (d.payment_amount || 0) > 0), [drivers]);
  const totalDueAmount = useMemo(() => drivers.reduce((sum, d) => sum + (d.payment_amount || 0), 0), [drivers]);

  // Filter drivers - memoized to prevent lag when interacting with UI
  const filteredDrivers = useMemo(() => {
    return drivers.filter((drv) => {
      if (statusFilter === 'ONLINE' && !drv.is_online) return false;
      if (statusFilter === 'OFFLINE' && drv.is_online) return false;
      if (statusFilter === 'ACTIVE' && drv.status !== 'ACTIVE') return false;
      if (statusFilter === 'BLOCKED' && drv.status !== 'BLOCKED') return false;
      if (statusFilter === 'WITH_DUES' && (!drv.payment_amount || drv.payment_amount <= 0)) return false;
      if (categoryFilter !== 'ALL') {
        const drvCat = (drv.vehicle_category || '').trim().toUpperCase();
        const filterCat = categoryFilter.trim().toUpperCase();
        if (drvCat !== filterCat) return false;
      }

      const q = (searchQuery || globalSearchQuery).trim().toLowerCase();
      if (q) {
        const matchName = drv.driver_name.toLowerCase().includes(q);
        const matchId = drv.driver_id.toLowerCase().includes(q);
        const matchPhone = drv.mobile_number.includes(q);
        const matchVehicle = drv.vehicle_number.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchPhone && !matchVehicle) return false;
      }

      return true;
    });
  }, [drivers, statusFilter, categoryFilter, searchQuery, globalSearchQuery]);

  // Pagination for 2000+ drivers
  const totalPages = Math.ceil(filteredDrivers.length / DRIVERS_PER_PAGE) || 1;
  const paginatedDrivers = useMemo(() => {
    const page = Math.min(currentPage, totalPages);
    return filteredDrivers.slice((page - 1) * DRIVERS_PER_PAGE, page * DRIVERS_PER_PAGE);
  }, [filteredDrivers, currentPage, totalPages]);

  const handleOpenEditDriver = (drv: FirestoreDriver) => {
    setEditingDriver({ ...drv });
    setEditDriverStep(1);
    setEditFeedback(null);
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingDriver) return;
    setIsSavingEdit(true);
    setEditFeedback(null);
    try {
      await onUpdateDriver(editingDriver.driver_id, editingDriver);
      setEditFeedback({
        text: `✓ Profile updated for ${editingDriver.driver_name}!`,
        type: 'success',
      });
      setTimeout(() => {
        setEditingDriver(null);
        setEditDriverStep(1);
        setEditFeedback(null);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update driver:', err);
      setEditFeedback({
        text: err?.message || 'Failed to update driver profile.',
        type: 'error',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4 w-full min-w-0">
        {/* Total Registered */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === 'ALL'
              ? 'border-slate-800 ring-2 ring-slate-800/10'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Total Roster
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight tabular-nums truncate">
              {totalFleet}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-500 font-normal truncate">registered cabs</span>
          </div>
        </div>

        {/* Online Fleet */}
        <div
          onClick={() => setStatusFilter('ONLINE')}
          className={`min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === 'ONLINE'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
              : 'border-slate-200/80 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Online & Ready
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-600 tracking-tight tabular-nums truncate">
              {onlineDrivers.length}
            </span>
            <span className="text-[10px] sm:text-xs text-emerald-700 font-normal truncate">GPS active</span>
          </div>
        </div>

        {/* Active Verified */}
        <div
          onClick={() => setStatusFilter('ACTIVE')}
          className={`min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === 'ACTIVE'
              ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20'
              : 'border-slate-200/80 hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Active KYC
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-sky-700 tracking-tight tabular-nums truncate">
              {activeKyc.length}
            </span>
            <span className="text-[10px] sm:text-xs text-sky-700 font-normal truncate">authorized</span>
          </div>
        </div>

        {/* Blocked */}
        <div
          onClick={() => setStatusFilter('BLOCKED')}
          className={`min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            statusFilter === 'BLOCKED'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20'
              : 'border-slate-200/80 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Blocked
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-rose-600 tracking-tight tabular-nums truncate">
              {blockedDrivers.length}
            </span>
            <span className="text-[10px] sm:text-xs text-rose-700 font-normal truncate">restricted</span>
          </div>
        </div>

        {/* Office Dues Pending */}
        <div
          onClick={() => {
            setStatusFilter(statusFilter === 'WITH_DUES' ? 'ALL' : 'WITH_DUES');
            setCurrentPage(1);
          }}
          className={`min-w-0 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shadow-2xs col-span-2 lg:col-span-1 ${
            statusFilter === 'WITH_DUES'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30'
              : 'border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              Office Dues
            </p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-600 tracking-tight tabular-nums truncate">
              ₹{totalDueAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] sm:text-xs text-amber-700 font-normal truncate">
              {driversWithDue.length} due
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3 transition-all">
        {/* ===================== MOBILE DEDICATED LAYOUT (< sm) ===================== */}
        <div className="sm:hidden space-y-3">
          {/* Top Quick Header: Live Indicator, View Mode & Register Driver */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Fleet
              </span>
              <span className="text-xs font-bold text-slate-500 tabular-nums">
                ({filteredDrivers.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Grid / List Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-slate-950 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-950 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Register Driver Button */}
              <button
                onClick={onOpenNewDriverModal}
                className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs min-h-[38px] cursor-pointer select-none active:scale-95 transition"
                title="Register New Driver"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ Register</span>
              </button>
            </div>
          </div>

          {/* Full-width Touch-friendly Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search driver, phone, plate, ID..."
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

          {/* Touch-Friendly Swipeable Status Filter Chips with Counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
            {[
              { id: 'ALL', label: 'All', count: totalFleet, badge: 'bg-slate-200 text-slate-700' },
              { id: 'ONLINE', label: 'Online', count: onlineDrivers.length, badge: 'bg-emerald-100 text-emerald-800 font-bold', dot: 'bg-emerald-500' },
              { id: 'ACTIVE', label: 'Active KYC', count: activeKyc.length, badge: 'bg-sky-100 text-sky-800 font-bold' },
              { id: 'OFFLINE', label: 'Offline', count: offlineDriversCount, badge: 'bg-slate-100 text-slate-600' },
              { id: 'BLOCKED', label: 'Blocked', count: blockedDrivers.length, badge: 'bg-rose-100 text-rose-800 font-bold' },
              { id: 'WITH_DUES', label: 'Has Due', count: driversWithDue.length, badge: 'bg-amber-400 text-slate-950 font-black', icon: IndianRupee },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 min-h-[42px] active:scale-95 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100/90 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-200/60'
                  }`}
                >
                  {tab.dot && <span className={`w-1.5 h-1.5 rounded-full ${tab.dot} shrink-0`}></span>}
                  {IconComp && <IconComp className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span className="whitespace-nowrap">{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums whitespace-nowrap ${
                      isActive ? 'bg-white/20 text-white font-black' : tab.badge
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2-Column Secondary Row: Category Selector & 1-Tap Reset */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Category Filter */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-500">
                <Car className="w-3.5 h-3.5" />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full text-xs font-semibold appearance-none border rounded-xl pl-8 pr-7 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer min-h-[44px] transition-all truncate ${
                  categoryFilter !== 'ALL'
                    ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-400/30'
                    : 'bg-slate-50 border-slate-200/90'
                }`}
                title="Filter by Vehicle Category"
              >
                <option value="ALL">All Categories</option>
                <option value="MINI">MINI</option>
                <option value="SEDAN">SEDAN</option>
                <option value="SUV">SUV</option>
                <option value="SUV+">SUV+</option>
                <option value="INNOVA">INNOVA</option>
                <option value="INNOVA CRYSTA">INNOVA CRYSTA</option>
                {Array.from(
                  new Set(
                    drivers
                      .map((d) => (d.vehicle_category || '').trim().toUpperCase())
                      .filter((cat) => cat && !['MINI', 'SEDAN', 'SUV', 'SUV+', 'INNOVA', 'INNOVA CRYSTA'].includes(cat))
                  )
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} (Custom)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Reset Filters / Count Pill */}
            {statusFilter !== 'ALL' || categoryFilter !== 'ALL' || searchQuery ? (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="w-full text-xs font-bold text-amber-950 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 min-h-[44px] active:scale-95 cursor-pointer transition shadow-2xs"
                title="Reset All Filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Reset</span>
              </button>
            ) : (
              <div className="flex items-center justify-center px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl min-h-[44px] text-xs font-semibold text-slate-500">
                <span className="truncate">All Categories</span>
              </div>
            )}
          </div>
        </div>

        {/* ===================== DESKTOP / TABLET LAYOUT (sm+) ===================== */}
        <div className="hidden sm:flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left Filter Tabs - Wrapping so NO options are hidden */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {['ALL', 'ACTIVE', 'ONLINE', 'OFFLINE', 'BLOCKED', 'WITH_DUES'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {st === 'WITH_DUES' && <IndianRupee className="w-3 h-3 text-amber-400" />}
                <span>{st === 'WITH_DUES' ? 'Has Office Due' : st}</span>
                {st === 'WITH_DUES' && driversWithDue.length > 0 && (
                  <span className="ml-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full">
                    {driversWithDue.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right Search, Category, View Mode & Registration */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Grid/Table toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0 cursor-pointer appearance-none min-w-[130px]"
                title="Filter by Vehicle Category"
              >
                <option value="ALL">All Categories</option>
                <option value="MINI">MINI</option>
                <option value="SEDAN">SEDAN</option>
                <option value="SUV">SUV</option>
                <option value="SUV+">SUV+</option>
                <option value="INNOVA">INNOVA</option>
                <option value="INNOVA CRYSTA">INNOVA CRYSTA</option>
                {Array.from(
                  new Set(
                    drivers
                      .map((d) => (d.vehicle_category || '').trim().toUpperCase())
                      .filter((cat) => cat && !['MINI', 'SEDAN', 'SUV', 'SUV+', 'INNOVA', 'INNOVA CRYSTA'].includes(cat))
                  )
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} (Custom)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Search Box with clear button */}
            <div className="relative flex-1 min-w-[150px] sm:w-52">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search driver, phone, plate..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
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

            {/* Clear active filters button */}
            {(statusFilter !== 'ALL' || categoryFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Reset All Active Filters"
              >
                <RotateCcw className="w-3 h-3 text-amber-700" />
                <span>Reset</span>
              </button>
            )}

            {/* Register Driver Button */}
            <button
              onClick={onOpenNewDriverModal}
              className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs shadow-2xs transition cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Register Driver</span>
            </button>
          </div>
        </div>
      </div>

      {/* Driver List Display */}
      {filteredDrivers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
            <Users className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">No drivers found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            No drivers match the current filter or search criteria.
          </p>
          <button
            onClick={onOpenNewDriverModal}
            className="mt-4 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Driver</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Driver Grid Cards (Image 1 & 6 style) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedDrivers.map((drv) => (
            <div
              key={drv.driver_id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: Driver Name, ID, Category & Trips */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 leading-tight">
                      {drv.driver_name}
                    </h4>
                    <span className="font-mono text-xs font-medium text-amber-700">
                      {drv.driver_id}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200">
                        {drv.vehicle_category}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                          drv.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {drv.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {drv.total_trips || 0} trips
                    </span>
                  </div>
                </div>

                {/* Details specs */}
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Car className="w-3.5 h-3.5" /> Vehicle Plate:
                    </span>
                    <strong className="text-slate-800 font-mono font-medium">{drv.vehicle_number}</strong>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5" /> Mobile Phone:
                    </span>
                    <a
                      href={`tel:${drv.mobile_number}`}
                      className="text-amber-800 font-medium hover:underline flex items-center gap-1"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>{drv.mobile_number}</span>
                    </a>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" /> License Expiry:
                    </span>
                    <span className="text-slate-700 font-normal">{drv.expiry_date || 'N/A'}</span>
                  </div>

                  {/* Android Hardware Device ID Box */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-slate-400" /> Device Lock:
                      </span>
                      {drv.device_id ? (
                        <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          Phone Bound
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                          Unbound
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-slate-500 truncate">
                      {drv.device_id || 'Driver can log in on any authorized Android device.'}
                    </p>
                  </div>

                  {/* Office Due & Driver Payment Status */}
                  <div
                    className={`p-2.5 rounded-xl border space-y-1.5 transition ${
                      (drv.payment_amount || 0) > 0
                        ? 'bg-amber-50/70 border-amber-200/90'
                        : 'bg-slate-50 border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-slate-500" /> Office Due:
                      </span>
                      {(drv.payment_amount || 0) > 0 ? (
                        <span className="text-[11px] font-bold text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                          <IndianRupee className="w-3 h-3" />
                          <span>{drv.payment_amount} DUE</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                          Cleared (₹0)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px] pt-0.5">
                      <span className="text-slate-500 truncate text-[11px]" title={drv.payment_note || DEFAULT_PAYMENT_NOTE}>
                        {drv.payment_note || DEFAULT_PAYMENT_NOTE}
                      </span>
                      <button
                        type="button"
                        onClick={() => openDueModal(drv)}
                        className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-2.5 py-1 rounded-lg border border-amber-600/20 shadow-xs shrink-0 cursor-pointer flex items-center gap-1 text-[11px] transition-all"
                        title="Set Driver Office Due"
                      >
                        <Edit2 className="w-3 h-3 text-slate-950" />
                        <span>Set Due</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Toolbar */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <button
                  onClick={() => openDueModal(drv)}
                  title="Manage Driver Office Due (Update amount in driver app)"
                  className="flex items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold py-1.5 px-2.5 rounded-lg transition cursor-pointer"
                >
                  <IndianRupee className="w-3 h-3 text-amber-700" />
                  <span>Dues</span>
                </button>

                <button
                  onClick={() => onResetDeviceBinding(drv.driver_id)}
                  title="Clear phone binding if driver changed phone"
                  className="flex-1 flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium py-1.5 px-2 rounded-lg transition cursor-pointer"
                >
                  <RefreshCcw className="w-3 h-3 text-slate-600" />
                  <span>Reset Device</span>
                </button>

                <button
                  onClick={() => onToggleDriverStatus(drv.driver_id)}
                  title={drv.status === 'BLOCKED' ? 'Unblock Driver & Set to Active' : 'Block Driver Account'}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                    drv.status === 'BLOCKED'
                      ? 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400'
                      : 'border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:border-rose-400'
                  }`}
                >
                  {drv.status === 'BLOCKED' ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Unblock</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>Block</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleOpenEditDriver(drv)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Edit Driver Profile"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setDriverToDelete(drv)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                  title="Delete Driver"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Driver Table View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/90 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Driver & ID</th>
                  <th className="py-3.5 px-4">Vehicle & Plate</th>
                  <th className="py-3.5 px-4">Mobile Phone</th>
                  <th className="py-3.5 px-4">GPS Status</th>
                  <th className="py-3.5 px-4">Office Due</th>
                  <th className="py-3.5 px-4">KYC State</th>
                  <th className="py-3.5 px-4">Device Lock</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDrivers.map((drv) => (
                  <tr key={drv.driver_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-slate-900">{drv.driver_name}</div>
                        <div className="text-[10px] text-amber-700 font-mono font-medium">
                          {drv.driver_id}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono font-medium text-slate-900">{drv.vehicle_number}</div>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-1.5 py-0.2 rounded border border-slate-200 mt-0.5 inline-block">
                        {drv.vehicle_category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <a
                        href={`tel:${drv.mobile_number}`}
                        className="text-amber-800 font-medium hover:underline flex items-center gap-1"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{drv.mobile_number}</span>
                      </a>
                    </td>

                    <td className="py-3.5 px-4">
                      {drv.is_online ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full border border-slate-200">
                          OFFLINE
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {(drv.payment_amount || 0) > 0 ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 text-[11px] px-2 py-0.5 rounded border border-amber-300">
                              <IndianRupee className="w-3 h-3 text-amber-700" />
                              <span>₹{drv.payment_amount} DUE</span>
                            </span>
                            <span
                              className="text-[9px] text-slate-500 max-w-[120px] truncate mt-0.5"
                              title={drv.payment_note || DEFAULT_PAYMENT_NOTE}
                            >
                              {drv.payment_note || DEFAULT_PAYMENT_NOTE}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Cleared (₹0)
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openDueModal(drv)}
                          className="p-1 text-slate-400 hover:text-amber-800 hover:bg-amber-50 rounded transition cursor-pointer"
                          title="Manage Office Due"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                          drv.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {drv.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => onResetDeviceBinding(drv.driver_id)}
                        className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                      >
                        <RefreshCcw className="w-2.5 h-2.5" />
                        <span>{drv.device_id ? 'Reset Lock' : 'Unbound'}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDueModal(drv)}
                          className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          title="Set Office Due"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditDriver(drv)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onToggleDriverStatus(drv.driver_id)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                            drv.status === 'BLOCKED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-semibold text-[11px] px-2'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                          title={drv.status === 'BLOCKED' ? 'Unblock Driver & Set to Active' : 'Block Driver'}
                        >
                          {drv.status === 'BLOCKED' ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Unblock</span>
                            </>
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          )}
                        </button>
                        <button
                          onClick={() => setDriverToDelete(drv)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Driver"
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
        </div>
      )}

      {/* Pagination Controls for Fleet Scale (2000+ Drivers) */}
      {filteredDrivers.length > DRIVERS_PER_PAGE && (
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{(currentPage - 1) * DRIVERS_PER_PAGE + 1}</strong> to{' '}
            <strong className="text-slate-800">
              {Math.min(currentPage * DRIVERS_PER_PAGE, filteredDrivers.length).toLocaleString()}
            </strong>{' '}
            of <strong className="text-slate-800">{filteredDrivers.length.toLocaleString()}</strong> drivers
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
              <span className="font-bold text-slate-900 bg-amber-100 text-amber-950 px-2.5 py-1 rounded-lg">
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

      {/* Edit Driver Modal (Responsive Clean Step-by-Step UI) */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 overflow-hidden relative animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            {/* Header: Clean, modern, no bulky icon container */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">Edit Driver Profile</h3>
                  <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                    {editingDriver.driver_id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      editingDriver.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {editingDriver.status || 'ACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {editingDriver.driver_name} • <span className="font-mono font-medium">{editingDriver.vehicle_number}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingDriver(null);
                  setEditDriverStep(1);
                  setEditFeedback(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Profile Summary Pill */}
            <div className="mt-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-medium text-slate-500">Fleet Record:</span>
                <span className="font-bold text-slate-900 font-mono">{editingDriver.vehicle_number}</span>
                <span className="text-slate-300">•</span>
                <span className="font-medium text-slate-700">{editingDriver.vehicle_category || 'MINI'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Due:</span>
                <span className="font-bold text-slate-900">₹{editingDriver.payment_amount || 0}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    (editingDriver.payment_amount || 0) > 0
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {editingDriver.payment_status || ((editingDriver.payment_amount || 0) > 0 ? 'DUE' : 'CLEARED')}
                </span>
              </div>
            </div>

            {/* Step-by-Step Progress Navigation Tabs */}
            <div className="mt-3 grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setEditDriverStep(1)}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  editDriverStep === 1
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                    editDriverStep === 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  1
                </span>
                <span className="truncate">Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setEditDriverStep(2)}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  editDriverStep === 2
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                    editDriverStep === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  2
                </span>
                <span className="truncate">Vehicle</span>
              </button>

              <button
                type="button"
                onClick={() => setEditDriverStep(3)}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  editDriverStep === 3
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                    editDriverStep === 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  3
                </span>
                <span className="truncate">Office Dues</span>
              </button>
            </div>

            {/* Feedback Message */}
            {editFeedback && (
              <div
                className={`mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 ${
                  editFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span>{editFeedback.text}</span>
              </div>
            )}

            {/* Step Body */}
            <form onSubmit={handleSaveEdit} className="mt-3 flex-1 overflow-y-auto space-y-4 text-xs pr-0.5">
              {/* STEP 1: DRIVER PROFILE & IDENTITY */}
              {editDriverStep === 1 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Driver Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={editingDriver.driver_name}
                        onChange={(e) =>
                          setEditingDriver({ ...editingDriver, driver_name: e.target.value })
                        }
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-amber-500 focus:bg-white"
                        placeholder="e.g. MYILSAMY"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Mobile Phone (Driver App Login)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        required
                        value={editingDriver.mobile_number}
                        onChange={(e) =>
                          setEditingDriver({ ...editingDriver, mobile_number: e.target.value })
                        }
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:bg-white"
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Account & Dispatch Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDriver({
                            ...editingDriver,
                            status: 'ACTIVE',
                            is_online: editingDriver.is_online ?? true,
                          })
                        }
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                          editingDriver.status !== 'BLOCKED'
                            ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <ShieldCheck
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            editingDriver.status !== 'BLOCKED' ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-xs">ACTIVE</div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                            Allowed to receive & accept ride broadcasts
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditingDriver({
                            ...editingDriver,
                            status: 'BLOCKED',
                            is_online: false,
                          })
                        }
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                          editingDriver.status === 'BLOCKED'
                            ? 'border-rose-500 bg-rose-50/70 text-rose-900 ring-2 ring-rose-500/20'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <ShieldAlert
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            editingDriver.status === 'BLOCKED' ? 'text-rose-600' : 'text-slate-400'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-xs">BLOCKED</div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                            Restricted from receiving & accepting trips
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Driver Profile Photo
                    </label>
                    <DriverPhotoUploader
                      photoUrl={editingDriver.photo_url || ''}
                      onChange={(url) =>
                        setEditingDriver({
                          ...editingDriver,
                          photo_url: url,
                        })
                      }
                      driverName={editingDriver.driver_name || 'Driver Photo'}
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: VEHICLE & CREDENTIALS */}
              {editDriverStep === 2 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Vehicle License Plate Number
                    </label>
                    <div className="relative">
                      <Car className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={editingDriver.vehicle_number}
                        onChange={(e) =>
                          setEditingDriver({
                            ...editingDriver,
                            vehicle_number: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold uppercase focus:ring-2 focus:ring-amber-500 focus:bg-white"
                        placeholder="e.g. TN38AB1234"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Vehicle Category
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-2">
                      {['MINI', 'SEDAN', 'SUV', 'SUV+', 'INNOVA', 'INNOVA CRYSTA'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setEditingDriver({
                              ...editingDriver,
                              vehicle_category: cat,
                            })
                          }
                          className={`py-2 px-1 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                            (editingDriver.vehicle_category || '').toUpperCase() === cat
                              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs font-black'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            ['MINI', 'SEDAN', 'SUV', 'SUV+', 'INNOVA', 'INNOVA CRYSTA'].includes(
                              (editingDriver.vehicle_category || '').toUpperCase()
                            )
                          ) {
                            setEditingDriver({
                              ...editingDriver,
                              vehicle_category: '',
                            });
                          }
                        }}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                          !['MINI', 'SEDAN', 'SUV', 'SUV+', 'INNOVA', 'INNOVA CRYSTA'].includes(
                            (editingDriver.vehicle_category || '').toUpperCase()
                          )
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs font-black'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Custom...
                      </button>
                    </div>

                    {!['MINI', 'SEDAN', 'SUV', 'SUV+', 'INNOVA', 'INNOVA CRYSTA'].includes(
                      (editingDriver.vehicle_category || '').toUpperCase()
                    ) && (
                      <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 animate-in fade-in duration-150">
                        <label className="block text-amber-950 font-bold mb-1">
                          Custom Vehicle Category Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TEMPO TRAVELLER, AUTO, EV SEDAN"
                          value={editingDriver.vehicle_category || ''}
                          onChange={(e) =>
                            setEditingDriver({
                              ...editingDriver,
                              vehicle_category: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full border border-amber-300 rounded-xl px-3 py-2 text-slate-900 bg-white font-bold uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          required
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-slate-700 font-bold">
                        License Expiry Date
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + 1);
                          setEditingDriver({
                            ...editingDriver,
                            expiry_date: d.toISOString().split('T')[0],
                          });
                        }}
                        className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-md cursor-pointer transition"
                        title="Set to 1 Year from today"
                      >
                        +1 Year Auto
                      </button>
                    </div>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={editingDriver.expiry_date || ''}
                        onChange={(e) =>
                          setEditingDriver({ ...editingDriver, expiry_date: e.target.value })
                        }
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-slate-700 font-bold">FCM Push Token</label>
                      <button
                        type="button"
                        onClick={() => {
                          const cleanId = (editingDriver.driver_id || 'drv')
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '');
                          const timestamp = Date.now().toString(36);
                          const part1 = Math.random().toString(36).substring(2, 12);
                          const part2 = Math.random().toString(36).substring(2, 12);
                          setEditingDriver({
                            ...editingDriver,
                            fcm_token: `fcm_${cleanId}_${timestamp}_${part1}${part2}`,
                          });
                        }}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold px-2 py-0.5 rounded-md cursor-pointer transition"
                      >
                        Auto Generate
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editingDriver.fcm_token || ''}
                      onChange={(e) =>
                        setEditingDriver({ ...editingDriver, fcm_token: e.target.value })
                      }
                      placeholder="FCM token for push notifications"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-[11px] focus:ring-2 focus:ring-amber-500 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: OFFICE DUES & PAYMENT SETTINGS */}
              {editDriverStep === 3 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Office Due Amount (₹ INR)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-lg">
                        ₹
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={editingDriver.payment_amount ?? 0}
                        onChange={(e) => {
                          const amt = Math.max(0, Number(e.target.value) || 0);
                          setEditingDriver({
                            ...editingDriver,
                            payment_amount: amt,
                            payment_status: amt > 0 ? 'DUE' : 'CLEARED',
                          });
                        }}
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-xl font-bold focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>

                  {/* Fast Preset Chips */}
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                      Quick Amount Presets
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[50, 100, 200, 300, 500, 800, 1000, 1500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() =>
                            setEditingDriver({
                              ...editingDriver,
                              payment_amount: amt,
                              payment_status: amt > 0 ? 'DUE' : 'CLEARED',
                            })
                          }
                          className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center ${
                            (editingDriver.payment_amount ?? 0) === amt
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
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingDriver({
                          ...editingDriver,
                          payment_amount: 0,
                          payment_status: 'CLEARED',
                          payment_note: 'Cleared',
                        })
                      }
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        (editingDriver.payment_amount ?? 0) === 0
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Set to ₹0 (Clear All Dues)</span>
                    </button>
                  </div>

                  {/* Payment Status Dropdown */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">Payment Status</label>
                    <select
                      value={
                        editingDriver.payment_status ||
                        ((editingDriver.payment_amount || 0) > 0 ? 'DUE' : 'CLEARED')
                      }
                      onChange={(e) =>
                        setEditingDriver({
                          ...editingDriver,
                          payment_status: e.target.value as 'DUE' | 'CLEARED',
                        })
                      }
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold bg-white focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="DUE">DUE (Unpaid / Driver Needs to Pay)</option>
                      <option value="CLEARED">CLEARED (Paid / No Outstanding Dues)</option>
                    </select>
                  </div>

                  {/* Payment Note / Purpose */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Payment Purpose / Reason
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      {PAYMENT_NOTE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setEditingDriver({
                              ...editingDriver,
                              payment_note: preset,
                            })
                          }
                          className={`text-left p-2 rounded-xl border text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            (editingDriver.payment_note || DEFAULT_PAYMENT_NOTE) === preset
                              ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400/30'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              (editingDriver.payment_note || DEFAULT_PAYMENT_NOTE) === preset
                                ? 'bg-amber-500'
                                : 'bg-slate-300'
                            }`}
                          />
                          <span className="truncate">{preset}</span>
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={editingDriver.payment_note || ''}
                      onChange={(e) =>
                        setEditingDriver({
                          ...editingDriver,
                          payment_note: e.target.value,
                        })
                      }
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white"
                      placeholder="Enter custom purpose or select preset above..."
                    />
                  </div>

                  {/* Office UPI ID */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-700 font-bold text-xs">
                        Office UPI ID <span className="text-slate-400 font-normal">(Default is blank)</span>
                      </label>
                      {editingDriver.office_upi_id ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingDriver({
                              ...editingDriver,
                              office_upi_id: '',
                            })
                          }
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                        >
                          Set Blank
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingDriver({
                              ...editingDriver,
                              office_upi_id: '123mdcreation@okaxis',
                            })
                          }
                          className="text-[11px] text-amber-800 hover:text-amber-900 font-bold bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-lg transition cursor-pointer"
                        >
                          + Choose Default ID
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editingDriver.office_upi_id || ''}
                      onChange={(e) =>
                        setEditingDriver({
                          ...editingDriver,
                          office_upi_id: e.target.value,
                        })
                      }
                      placeholder="Blank (No Office UPI) - click '+ Choose Default ID' if wanted"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white bg-slate-50/50"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                      {editingDriver.office_upi_id ? (
                        <span className="text-emerald-700 font-semibold">
                          {editingDriver.office_upi_id === '123mdcreation@okaxis'
                            ? '✓ Default ID: 123mdcreation@okaxis'
                            : `✓ Custom: ${editingDriver.office_upi_id}`}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">
                          Currently Blank (No UPI requested)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Review Summary Card */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-700">
                    <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
                      Summary of Profile Updates
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-slate-400 block">Driver Name:</span>
                        <strong className="text-slate-800">{editingDriver.driver_name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Plate & Category:</span>
                        <strong className="text-slate-800">
                          {editingDriver.vehicle_number} ({editingDriver.vehicle_category})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Mobile:</span>
                        <strong className="text-slate-800 font-mono">{editingDriver.mobile_number}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Status & Dues:</span>
                        <strong
                          className={
                            (editingDriver.payment_amount || 0) > 0
                              ? 'text-amber-700 font-black'
                              : 'text-emerald-700 font-bold'
                          }
                        >
                          ₹{editingDriver.payment_amount || 0} (
                          {editingDriver.payment_status ||
                            ((editingDriver.payment_amount || 0) > 0 ? 'DUE' : 'CLEARED')}
                          )
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDriver(null);
                    setEditDriverStep(1);
                    setEditFeedback(null);
                  }}
                  className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {editDriverStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setEditDriverStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}

                  {editDriverStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setEditDriverStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 shadow-2xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>
                        Next: {editDriverStep === 1 ? 'Vehicle' : 'Office Dues'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSavingEdit}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black hover:bg-amber-400 shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingEdit ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Profile...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Driver Confirmation Modal */}
      {driverToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Driver Account</h3>
                <p className="text-xs text-slate-500">Permanently remove from fleet</p>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>{driverToDelete.driver_name}</span>
                <span className="font-mono text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {driverToDelete.driver_id}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>{driverToDelete.vehicle_number}</span>
                <span>•</span>
                <span>{driverToDelete.mobile_number}</span>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this driver? Their registration and access will be removed from the fleet console.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDriverToDelete(null)}
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
                    await onDeleteDriver(driverToDelete.driver_id);
                    setDriverToDelete(null);
                  } catch (err: any) {
                    console.error('Delete driver error:', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Driver'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {viewingPhoto && (
        <div
          onClick={() => setViewingPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 cursor-pointer"
        >
          <div className="relative max-w-sm w-full bg-white rounded-2xl overflow-hidden p-3 shadow-2xl">
            <img
              src={viewingPhoto}
              alt="Driver"
              referrerPolicy="no-referrer"
              className="w-full h-80 object-cover rounded-xl"
            />
            <p className="text-center text-xs text-slate-500 mt-2 font-medium">Click anywhere to close</p>
          </div>
        </div>
      )}

      {/* Dedicated Driver Office Due & Payment Modal (Clean Step-by-Step UI) */}
      {managingDueDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 overflow-hidden relative animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            {/* Header: Clean, modern, no bulky icon container */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">Driver Office Due</h3>
                  <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                    {managingDueDriver.driver_id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {managingDueDriver.driver_name} • <span className="font-mono font-medium">{managingDueDriver.vehicle_number}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManagingDueDriver(null);
                  setDueFeedbackMsg(null);
                  setDueStep(1);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Status Pill */}
            <div className="mt-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 font-medium">Current Status:</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">
                  ₹{managingDueDriver.payment_amount || 0}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                    (managingDueDriver.payment_amount || 0) > 0
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {managingDueDriver.payment_status || ((managingDueDriver.payment_amount || 0) > 0 ? 'DUE' : 'CLEARED')}
                </span>
              </div>
            </div>

            {/* Step-by-Step Progress Navigation */}
            <div className="mt-3 grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setDueStep(1)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  dueStep === 1
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                  dueStep === 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  1
                </span>
                <span>Amount</span>
              </button>

              <button
                type="button"
                onClick={() => setDueStep(2)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  dueStep === 2
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                  dueStep === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  2
                </span>
                <span>Purpose</span>
              </button>

              <button
                type="button"
                onClick={() => setDueStep(3)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  dueStep === 3
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
                  dueStep === 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  3
                </span>
                <span>Confirm</span>
              </button>
            </div>

            {/* Feedback Message */}
            {dueFeedbackMsg && (
              <div
                className={`mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 ${
                  dueFeedbackMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <span>{dueFeedbackMsg.text}</span>
              </div>
            )}

            {/* Step Body */}
            <form onSubmit={handleSaveDue} className="mt-3 flex-1 overflow-y-auto space-y-4 text-xs pr-0.5">
              {/* STEP 1: AMOUNT */}
              {dueStep === 1 && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Set Due Amount (₹ INR)
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
                        value={dueAmountInput}
                        onChange={(e) => setDueAmountInput(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-xl font-bold focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>

                  {/* Fast Preset Chips */}
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                      Quick Amount Presets
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[50, 100, 200, 300, 500, 800, 1000, 1500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDueAmountInput(String(amt))}
                          className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center ${
                            dueAmountInput === String(amt)
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
                      onClick={() => setDueAmountInput('0')}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        dueAmountInput === '0'
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
              {dueStep === 2 && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5">
                      Payment Purpose / Reason
                    </label>
                    <div className="space-y-1.5">
                      {PAYMENT_NOTE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDueNoteInput(preset)}
                          className={`w-full p-2.5 rounded-xl border text-left font-bold text-xs transition cursor-pointer flex items-center justify-between ${
                            dueNoteInput === preset
                              ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{preset}</span>
                          {dueNoteInput === preset && (
                            <Check className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Note Option */}
                  <div className="pt-1">
                    <label className="block text-slate-600 font-semibold text-[11px] mb-1">
                      Custom Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={dueNoteInput}
                      onChange={(e) => setDueNoteInput(e.target.value)}
                      placeholder="Type custom note or trip reference..."
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: CONFIRMATION & OFFICE UPI */}
              {dueStep === 3 && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  {/* Summary Card */}
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Driver:</span>
                      <span className="font-bold text-slate-900">
                        {managingDueDriver.driver_name} ({managingDueDriver.driver_id})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Vehicle:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {managingDueDriver.vehicle_number}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-200/80 pt-2">
                      <span className="text-slate-600 font-medium">Amount Due:</span>
                      <span className="text-base font-black text-amber-950">
                        ₹{dueAmountInput}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Payment Note:</span>
                      <span className="font-bold text-slate-900 text-right truncate max-w-[200px]">
                        {dueNoteInput}
                      </span>
                    </div>
                  </div>

                  {/* Office UPI ID */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-slate-700 font-bold text-xs">
                        Office UPI ID <span className="text-slate-400 font-normal">(Default is blank)</span>
                      </label>
                      {officeUpiInput ? (
                        <button
                          type="button"
                          onClick={() => setOfficeUpiInput('')}
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                        >
                          Set Blank
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOfficeUpiInput('123mdcreation@okaxis')}
                          className="text-[11px] text-amber-800 hover:text-amber-900 font-bold bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-lg transition cursor-pointer"
                        >
                          + Choose Default ID
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={officeUpiInput}
                      onChange={(e) => setOfficeUpiInput(e.target.value)}
                      placeholder="Blank (No UPI) - click '+ Choose Default ID' if wanted"
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-slate-50/50"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                      {officeUpiInput.trim() ? (
                        <span className="text-emerald-700 font-semibold">
                          {officeUpiInput.trim() === '123mdcreation@okaxis'
                            ? '✓ Default ID: 123mdcreation@okaxis'
                            : `✓ Custom: ${officeUpiInput.trim()}`}
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

              {/* Step Navigation & Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                {dueStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setDueStep((prev) => (prev - 1) as 1 | 2)}
                    className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setManagingDueDriver(null);
                      setDueFeedbackMsg(null);
                      setDueStep(1);
                    }}
                    className="px-3.5 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                <div className="flex items-center gap-2">
                  {dueStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setDueStep((prev) => (prev + 1) as 2 | 3)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSavingDue}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {isSavingDue ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            {Number(dueAmountInput) > 0
                              ? `Set Due (₹${dueAmountInput})`
                              : 'Clear Dues (₹0)'}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

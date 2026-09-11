import React from 'react';
import {
  Car,
  History,
  X,
  ChevronRight,
  Download,
  AlertTriangle,
  Radio,
  Menu,
  LogOut,
} from 'lucide-react';
import { AdminTab, SystemControlSettings, AdminUser } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  systemSettings: SystemControlSettings;
  isFirebaseConnected: boolean;
  isSyncing: boolean;
  connectionStatusText: string;
  currentAdmin: AdminUser;
  onOpenNewTripModal: () => void;
  onOpenSettingsModal?: (tab?: 'system' | 'security' | 'environment') => void;
  onOpenNewDriverModal: () => void;
  onOpenAdminPermissionsModal?: () => void;
  onToggleKillswitch: (online: boolean) => void;
  openTripCount: number;
  onlineDriverCount: number;
  onLogout?: () => void;
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  systemSettings,
  currentAdmin,
  onOpenNewDriverModal,
  onToggleKillswitch,
  onLogout,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (!isOpen) return null;

  const isCutoffActive = !systemSettings.admin_online;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Simple & Clean Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Menu className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Fleet Menu & Operations</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Console Active
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean, Simple Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Driver Live Sync / Emergency Killswitch Switch */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              isCutoffActive
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/20'
                : 'bg-emerald-50/50 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isCutoffActive
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {isCutoffActive ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <Radio className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-900">
                    {isCutoffActive ? 'Sync Cutoff ACTIVE' : 'Driver Sync Online'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {isCutoffActive ? 'Drivers disconnected' : 'Real-time meter connected'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onToggleKillswitch(isCutoffActive)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 min-h-[36px] ${
                  isCutoffActive
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                    : 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-300'
                }`}
              >
                {isCutoffActive ? 'Resume' : 'Cutoff'}
              </button>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Operations
            </h4>

            {/* Register New Driver */}
            <button
              onClick={() => {
                onClose();
                onOpenNewDriverModal();
              }}
              className="w-full p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 text-left flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Car className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Add Fleet Driver & Car</div>
                  <div className="text-[10px] text-slate-500">Register vehicle, category & license</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Trip History & Billing Archive */}
            <button
              onClick={() => {
                setActiveTab('trips');
                onClose();
              }}
              className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs ${
                activeTab === 'trips'
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Trip History & Ledger</div>
                  <div className="text-[10px] text-slate-500">Completed rides audit & operations</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* PWA Install Button (Hidden on Privacy & Tracking Pages) */}
{!window.location.search.includes('page=privacy') &&
 !window.location.search.includes('track=') &&
 !isInstalled &&
 isInstallable && (
  <button
    onClick={() => {
      onClose();
      install();
    }}
    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-2xl text-xs transition cursor-pointer min-h-[44px] shadow-sm"
  >
    <Download className="w-4 h-4 text-amber-400" />
    <span>Install Mobile App (PWA)</span>
  </button>
)}

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold py-2.5 px-4 rounded-2xl text-xs transition cursor-pointer min-h-[42px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out of Console</span>
            </button>
          )}
        </div>

        {/* Clean Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-400 font-mono">
            Trusty Yellow Cab Console
          </span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-200/70 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

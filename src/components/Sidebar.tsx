import React from 'react';
import {
  Radio,
  Users,
  History,
  ShieldCheck,
  Settings,
  Sliders,
  AlertTriangle,
  Zap,
  TrendingUp,
  LayoutDashboard,
  Navigation,
  MapPin,
  Flame,
  ChevronRight,
  LogOut,
  Power,
} from 'lucide-react';
import { AdminTab, FirestoreDriver, FirestoreTrip, AdminUser, SystemSettings } from '../types';

interface SidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  openTripCount: number;
  onlineDriverCount: number;
  currentAdmin: AdminUser;
  systemSettings: SystemSettings;
  isFirebaseConnected: boolean;
  isSyncing: boolean;
  onOpenNewTripModal: () => void;
  onOpenNewDriverModal: () => void;
  onOpenSettingsModal: (tab?: 'system' | 'security' | 'environment') => void;
  onOpenAdminPermissionsModal: () => void;
  onToggleKillswitch: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  openTripCount,
  onlineDriverCount,
  currentAdmin,
  systemSettings,
  isFirebaseConnected,
  isSyncing,
  onOpenNewTripModal,
  onOpenNewDriverModal,
  onOpenSettingsModal,
  onOpenAdminPermissionsModal,
  onToggleKillswitch,
  onLogout,
}) => {
  const navItems: {
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    badgeColor?: string;
  }[] = [
    {
      id: 'dispatch',
      label: 'Dashboard & Dispatch',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: openTripCount > 0 ? `${openTripCount} OPEN` : undefined,
      badgeColor: 'bg-amber-500 text-slate-950 font-black',
    },
    {
      id: 'analytics',
      label: 'Fleet Analytics',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: 'radar',
      label: 'Live Tracking & Radar',
      icon: <Navigation className="w-4 h-4" />,
      badge: onlineDriverCount > 0 ? `${onlineDriverCount} Live` : undefined,
      badgeColor: 'bg-emerald-500 text-white font-bold',
    },
    {
      id: 'drivers',
      label: 'Driver Management',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'trips',
      label: 'Trip Management & Logs',
      icon: <History className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-64 bg-white text-slate-700 border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-30 hidden lg:flex shadow-xs">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-slate-900 text-base tracking-tight leading-tight truncate">
              Fleet Console
            </h1>
          </div>

          {/* Quick Dispatch Action Button */}
          <button
            onClick={onOpenNewTripModal}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-2.5 px-3.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>+ Quick Dispatch Ride</span>
          </button>
        </div>

        {/* Navigation Menu Links */}
        <div className="px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Fleet Management
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      isActive ? 'bg-white/20 text-white font-medium' : (item.badgeColor || 'bg-slate-100 text-slate-600 font-medium')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Settings button in Sidebar */}
          <div className="pt-2 mt-2 border-t border-slate-100">
            <button
              onClick={() => onOpenSettingsModal('system')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all cursor-pointer group text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-slate-400 group-hover:text-indigo-600">
                  <Settings className="w-4 h-4" />
                </span>
                <span className="truncate">Settings</span>
              </div>
              {!systemSettings.admin_online && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold shrink-0">
                  CUTOFF
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Emergency Killswitch Warning Box in Sidebar */}
        {!systemSettings.admin_online && (
          <div className="mx-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs shadow-xs">
            <div className="flex items-center gap-2 font-bold text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Cutoff Active</span>
            </div>
            <p className="text-[11px] text-rose-700/90 mt-1 leading-snug">
              Mobile driver app sync is halted by admin.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={onToggleKillswitch}
                className="flex-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
                title="Resume synchronization with mobile driver app"
              >
                <Power className="w-3.5 h-3.5 shrink-0" />
                <span>Resume Sync</span>
              </button>
              <button
                onClick={() => onOpenSettingsModal('system')}
                className="bg-white hover:bg-rose-100/80 active:bg-rose-200 text-rose-800 border border-rose-300 hover:border-rose-400 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
                title="Manage system settings"
              >
                <Settings className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Manage</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom User & Settings Card (Image 2 style) */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
          <div
            onClick={onOpenAdminPermissionsModal}
            className="flex items-center min-w-0 cursor-pointer hover:opacity-80 transition"
            title="Manage Admin Profile & Roles"
          >
            <p className="text-xs font-semibold text-slate-900 truncate">
              Fleet Console
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenSettingsModal}
              title="Settings & Emergency Cutoff"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Log Out of Console"
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

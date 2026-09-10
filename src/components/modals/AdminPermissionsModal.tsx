import React, { useState } from 'react';
import { AdminUser, AdminRole, AdminPermissions } from '../../types';
import {
  ShieldCheck,
  UserCheck,
  Plus,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  KeyRound,
  FileCode2,
  Sparkles,
  UserPlus,
} from 'lucide-react';

interface AdminPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdmin: AdminUser;
  adminUsers: AdminUser[];
  onAddAdmin: (newAdmin: Omit<AdminUser, 'id' | 'created_at'>) => Promise<void>;
  onUpdateAdmin: (id: string, updates: Partial<AdminUser>) => Promise<void>;
  onDeleteAdmin: (id: string) => Promise<void>;
  onSwitchCurrentAdmin: (admin: AdminUser) => void;
}

export const AdminPermissionsModal: React.FC<AdminPermissionsModalProps> = ({
  isOpen,
  onClose,
  currentAdmin,
  adminUsers,
  onAddAdmin,
  onUpdateAdmin,
  onDeleteAdmin,
  onSwitchCurrentAdmin,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('DISPATCH_MANAGER');
  const [adminToDelete, setAdminToDelete] = useState<AdminUser | null>(null);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);
  const [newPermissions, setNewPermissions] = useState<AdminPermissions>({
    can_dispatch: true,
    can_manage_drivers: true,
    can_change_rates: false,
    can_toggle_killswitch: false,
    can_view_audit_logs: true,
    can_manage_admins: false,
    can_export_data: true,
  });

  if (!isOpen) return null;

  const handleRolePresetChange = (role: AdminRole) => {
    setNewRole(role);
    if (role === 'SUPER_ADMIN') {
      setNewPermissions({
        can_dispatch: true,
        can_manage_drivers: true,
        can_change_rates: true,
        can_toggle_killswitch: true,
        can_view_audit_logs: true,
        can_manage_admins: true,
        can_export_data: true,
      });
    } else if (role === 'DISPATCH_MANAGER') {
      setNewPermissions({
        can_dispatch: true,
        can_manage_drivers: true,
        can_change_rates: false,
        can_toggle_killswitch: false,
        can_view_audit_logs: true,
        can_manage_admins: false,
        can_export_data: true,
      });
    } else if (role === 'FLEET_SUPERVISOR') {
      setNewPermissions({
        can_dispatch: false,
        can_manage_drivers: true,
        can_change_rates: false,
        can_toggle_killswitch: false,
        can_view_audit_logs: true,
        can_manage_admins: false,
        can_export_data: false,
      });
    } else {
      // OPERATOR
      setNewPermissions({
        can_dispatch: true,
        can_manage_drivers: false,
        can_change_rates: false,
        can_toggle_killswitch: false,
        can_view_audit_logs: false,
        can_manage_admins: false,
        can_export_data: false,
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    await onAddAdmin({
      email: newEmail.trim().toLowerCase(),
      name: newName.trim() || newEmail.split('@')[0],
      role: newRole,
      is_active: true,
      permissions: newPermissions,
    });
    setNewEmail('');
    setNewName('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  Admin Panel Permissions & Access Control
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    ALL PERMISSIONS ACTIVE
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Manage administrator accounts, dispatch operators, and role-based permissions (RBAC).
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Administrator Identity Card */}
        <div className="mt-5 p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">{currentAdmin.name || 'Administrator'}</h4>
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-amber-400/30">
                  {currentAdmin.role === 'SUPER_ADMIN' ? 'FULL ACCESS' : currentAdmin.role}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentAdmin.email}</span>
              </p>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Full administrator privileges granted across all collections and security rules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <span className="px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 text-xs font-semibold border border-emerald-800 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> Full Access
            </span>
          </div>
        </div>

        {/* Granted Capabilities Breakdown */}
        <div className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
            Active Security Privileges for {currentAdmin.email}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg border border-slate-200 bg-emerald-50/60 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900 block">Master Killswitch & Sync</strong>
                <span className="text-[11px] text-slate-500">Full control to toggle backend cutoff switch</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-emerald-50/60 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900 block">Dispatch Operations</strong>
                <span className="text-[11px] text-slate-500">Create, assign, override OTP, cancel & complete rides</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-emerald-50/60 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900 block">Fleet & Driver Management</strong>
                <span className="text-[11px] text-slate-500">Register drivers, toggle status, reset device IDs</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-emerald-50/60 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900 block">Tariffs & Rate Cards</strong>
                <span className="text-[11px] text-slate-500">Modify base fares, km rates & waiting multipliers</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-emerald-50/60 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900 block">Security Rules & Audit</strong>
                <span className="text-[11px] text-slate-500">Inspect audit logs & deploy Firestore security rules</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-emerald-50/60 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900 block">Admin Provisioning</strong>
                <span className="text-[11px] text-slate-500">Add or revoke permissions for other team members</span>
              </div>
            </div>
          </div>
        </div>

        {/* Administrator & Dispatcher Accounts Roster */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Console Authorized Administrators & Operators ({adminUsers.length})
            </h4>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel' : 'Add Admin User'}</span>
            </button>
          </div>

          {/* Add New Admin Form */}
          {showAddForm && (
            <form onSubmit={handleCreate} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 mb-4 text-xs space-y-3">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-600" /> Provision New Administrator Account
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="operator@company.com"
                    required
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role Preset</label>
                  <select
                    value={newRole}
                    onChange={(e) => handleRolePresetChange(e.target.value as AdminRole)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-bold"
                  >
                    <option value="SUPER_ADMIN">System Administrator (All Privileges)</option>
                    <option value="DISPATCH_MANAGER">Dispatch Manager</option>
                    <option value="FLEET_SUPERVISOR">Fleet Supervisor</option>
                    <option value="OPERATOR">Standard Dispatch Operator</option>
                  </select>
                </div>
              </div>

              {/* Granular Permission Toggles */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Granular Permissions Granted:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.can_dispatch}
                      onChange={(e) => setNewPermissions({ ...newPermissions, can_dispatch: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Can Dispatch Rides</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.can_manage_drivers}
                      onChange={(e) => setNewPermissions({ ...newPermissions, can_manage_drivers: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Can Manage Drivers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.can_change_rates}
                      onChange={(e) => setNewPermissions({ ...newPermissions, can_change_rates: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Can Change Rates</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.can_toggle_killswitch}
                      onChange={(e) => setNewPermissions({ ...newPermissions, can_toggle_killswitch: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Can Toggle Killswitch</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.can_view_audit_logs}
                      onChange={(e) => setNewPermissions({ ...newPermissions, can_view_audit_logs: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Can View Audit Logs</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.can_manage_admins}
                      onChange={(e) => setNewPermissions({ ...newPermissions, can_manage_admins: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-400"
                    />
                    <span>Can Manage Admins</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-600 shadow-xs cursor-pointer"
                >
                  Grant Permissions & Save
                </button>
              </div>
            </form>
          )}

          {/* Accounts List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
            {adminUsers.map((admin) => {
              const isCurrent = admin.id === currentAdmin.id || admin.email === currentAdmin.email;
              return (
                <div
                  key={admin.id}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                    isCurrent ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                        admin.role === 'SUPER_ADMIN'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {admin.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{admin.name}</span>
                        {isCurrent && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-300">
                            YOU (ACTIVE SESSION)
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            admin.role === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {admin.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{admin.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {admin.permissions.can_dispatch && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded">Dispatch</span>
                        )}
                        {admin.permissions.can_manage_drivers && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded">Drivers</span>
                        )}
                        {admin.permissions.can_change_rates && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded">Rates</span>
                        )}
                        {admin.permissions.can_toggle_killswitch && (
                          <span className="text-[9px] bg-rose-50 text-rose-700 px-1 py-0.2 rounded">Killswitch</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {!isCurrent && (
                      <button
                        onClick={() => onSwitchCurrentAdmin(admin)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] cursor-pointer"
                      >
                        Switch To User
                      </button>
                    )}

                    <button
                      onClick={() => onUpdateAdmin(admin.id, { is_active: !admin.is_active })}
                      title={admin.is_active ? 'Account Active' : 'Account Suspended'}
                      className={`p-1.5 rounded-lg border transition ${
                        admin.is_active
                          ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          : 'border-slate-200 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {admin.is_active ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>

                    {adminUsers.length > 1 && !isCurrent && (
                      <button
                        onClick={() => setAdminToDelete(admin)}
                        className="p-1.5 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                        title="Remove Admin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Rules enforce validation on <code>/databases/$(database)/documents/admins/</code></span>
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Delete Admin Confirmation Dialog */}
        {adminToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Remove Admin</h4>
                  <p className="text-[11px] text-slate-500">{adminToDelete.email}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                Are you sure you want to revoke admin console access for <strong>{adminToDelete.name}</strong>?
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeletingAdmin}
                  onClick={() => setAdminToDelete(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingAdmin}
                  onClick={async () => {
                    setIsDeletingAdmin(true);
                    try {
                      await onDeleteAdmin(adminToDelete.id);
                      setAdminToDelete(null);
                    } finally {
                      setIsDeletingAdmin(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer"
                >
                  {isDeletingAdmin ? 'Removing...' : 'Remove Admin'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

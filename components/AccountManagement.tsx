"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataService } from "@/lib/dataService";
import { UserAccount } from "@/lib/types";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RefreshCw
} from "lucide-react";

export function AccountManagement() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Change Own Password Form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingSelf, setIsChangingSelf] = useState(false);

  // Admin Force-Reset Form
  const [targetUserId, setTargetUserId] = useState("");
  const [adminTempPassword, setAdminTempPassword] = useState("");
  const [isResettingUser, setIsResettingUser] = useState(false);

  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    const me = DataService.getCurrentUser();
    setCurrentUser(me);
    await DataService.fetchLiveFromSupabase();
    const list = DataService.getUsers().filter(u => u.active);
    setUsers(list);
    setTargetUserId(prev => (prev && list.some(u => u.id === prev) ? prev : list[0]?.id || ""));
  }, []);

  useEffect(() => {
    setCurrentUser(DataService.getCurrentUser());
    setUsers(DataService.getUsers().filter(u => u.active));
    loadUsers();
  }, [loadUsers]);

  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!currentUser?.id) {
      setBanner({ type: "error", text: "No active logged-in account detected." });
      return;
    }
    if (newPassword.length < 4) {
      setBanner({ type: "error", text: "New password must be at least 4 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setBanner({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    setIsChangingSelf(true);
    const res = await DataService.changeUserPassword(currentUser.id, oldPassword, newPassword);
    setIsChangingSelf(false);

    if (res.success) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setBanner({ type: "success", text: res.message });
    } else {
      setBanner({ type: "error", text: res.message });
    }
  };

  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!targetUserId) {
      setBanner({ type: "error", text: "Select an account to reset." });
      return;
    }
    if (adminTempPassword.length < 4) {
      setBanner({ type: "error", text: "Temporary password must be at least 4 characters." });
      return;
    }

    setIsResettingUser(true);
    const res = await DataService.resetUserPassword(
      targetUserId,
      adminTempPassword,
      currentUser?.id
    );
    setIsResettingUser(false);

    if (res.success) {
      setAdminTempPassword("");
      const targetName = users.find(u => u.id === targetUserId)?.name || "User";
      setBanner({
        type: "success",
        text: `${res.message} (${targetName} credentials updated in PostgreSQL)`
      });
    } else {
      setBanner({ type: "error", text: res.message });
    }
  };

  const canResetOthers = currentUser?.role === "Owner" || currentUser?.role === "Staff";

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            banner.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Update My Own Password */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#004D40] dark:text-emerald-300 font-black flex items-center justify-center overflow-hidden shrink-0">
              {currentUser?.photoUrl ? (
                <img
                  src={currentUser.photoUrl}
                  alt={currentUser.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <KeyRound className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Change My Password
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Signed in as <strong>{currentUser?.name || "Staff"}</strong> (
                {currentUser?.role || "User"})
              </p>
            </div>
          </div>

          <form onSubmit={handleSelfPasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingSelf}
              className="w-full min-h-[44px] py-2.5 px-5 bg-[#004D40] hover:bg-emerald-900 text-white font-bold text-sm rounded-xl cursor-pointer disabled:opacity-60"
            >
              {isChangingSelf ? "Updating Password..." : "Update My Password"}
            </button>
          </form>
        </div>

        {/* Admin Reset User Credentials */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Administrative Credential Reset
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reset a forgotten driver PIN or dispatcher password
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadUsers}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 cursor-pointer"
              title="Refresh Users"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {!canResetOthers ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500">
              Only Owner and Staff administrators can reset another employee&apos;s credentials.
            </div>
          ) : (
            <form onSubmit={handleAdminReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Select Staff / Driver Account
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-sm font-bold text-slate-900 dark:text-white"
                >
                  {users.length === 0 ? (
                    <option value="">No active accounts found</option>
                  ) : (
                    users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.role} {u.username ? `(@${u.username})` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  New Password / Mobile Driver PIN
                </label>
                <input
                  type="text"
                  required
                  value={adminTempPassword}
                  onChange={(e) => setAdminTempPassword(e.target.value)}
                  placeholder="Minimum 4 characters or PIN digits"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isResettingUser || users.length === 0}
                className="w-full min-h-[44px] py-2.5 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isResettingUser ? "Resetting..." : "Apply Password / PIN Reset"}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountManagement;

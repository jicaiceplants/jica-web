"use client";

import { useState, useEffect } from "react";
import { UserAccount, Role } from "@/lib/types";
import { DataService } from "@/lib/dataService";
import { KeyRound, Shield, User, Check, AlertCircle, RefreshCw, Key, Lock, UserCheck, Mail, X } from "lucide-react";

export default function AccountManagement() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Self-Service Password Change State
  const [selfUserId, setSelfUserId] = useState<string>("");
  const [selfCurrentPass, setSelfCurrentPass] = useState("");
  const [selfNewPass, setSelfNewPass] = useState("");
  const [selfConfirmPass, setSelfConfirmPass] = useState("");
  const [selfSubmitting, setSelfSubmitting] = useState(false);
  const [selfStatus, setSelfStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Self-Service Gmail Address State
  const [selfEmail, setSelfEmail] = useState("");
  const [selfEmailSaving, setSelfEmailSaving] = useState(false);
  const [selfEmailStatus, setSelfEmailStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Admin Edit Email Modal State
  const [editingEmailUser, setEditingEmailUser] = useState<UserAccount | null>(null);
  const [targetEmail, setTargetEmail] = useState("");
  const [emailModalSaving, setEmailModalSaving] = useState(false);
  const [emailModalStatus, setEmailModalStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const reloadUsers = () => {
    const list = DataService.getUsers();
    setUsers(list);
    if (!selfUserId && list.length > 0) {
      setSelfUserId(list[0].id);
      setSelfEmail(list[0].email || "");
    }
  };

  useEffect(() => {
    reloadUsers();
  }, []);

  useEffect(() => {
    const u = users.find(x => x.id === selfUserId);
    if (u) {
      setSelfEmail(u.email || "");
    }
  }, [selfUserId, users]);

  const handleSelfEmailSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfUserId) return;
    setSelfEmailSaving(true);
    setSelfEmailStatus(null);

    try {
      DataService.updateUser(selfUserId, { email: selfEmail.trim() });
      setSelfEmailStatus({ type: "success", text: "Recovery Gmail updated successfully!" });
      reloadUsers();
      setTimeout(() => setSelfEmailStatus(null), 3000);
    } catch (e: any) {
      setSelfEmailStatus({ type: "error", text: "Failed to update recovery email." });
    } finally {
      setSelfEmailSaving(false);
    }
  };

  const handleAdminEmailSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmailUser) return;
    setEmailModalSaving(true);
    setEmailModalStatus(null);

    try {
      DataService.updateUser(editingEmailUser.id, { email: targetEmail.trim() });
      setEmailModalStatus({ type: "success", text: `Updated Gmail for ${editingEmailUser.name}!` });
      reloadUsers();
      setTimeout(() => {
        setEditingEmailUser(null);
        setEmailModalStatus(null);
      }, 1500);
    } catch (e: any) {
      setEmailModalStatus({ type: "error", text: "Failed to update email." });
    } finally {
      setEmailModalSaving(false);
    }
  };

  const filteredUsers = users.filter(u => roleFilter === "ALL" || u.role === roleFilter);

  const handleOpenReset = (user: UserAccount) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setStatusMessage(null);
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (newPassword.length < 4) {
      setStatusMessage({ type: "error", text: "Password must be at least 4 characters long." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: "error", text: "Passwords do not match. Please verify." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    setTimeout(() => {
      const result = DataService.resetUserPassword(selectedUser.id, newPassword);
      setIsSubmitting(false);

      if (result.success) {
        setStatusMessage({ type: "success", text: result.message });
        reloadUsers();
        setTimeout(() => {
          setSelectedUser(null);
          setStatusMessage(null);
        }, 1800);
      } else {
        setStatusMessage({ type: "error", text: result.message });
      }
    }, 500);
  };

  const handleSelfPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfUserId) return;

    if (selfNewPass.length < 4) {
      setSelfStatus({ type: "error", text: "New password must be at least 4 characters long." });
      return;
    }

    if (selfNewPass !== selfConfirmPass) {
      setSelfStatus({ type: "error", text: "New passwords do not match. Please verify." });
      return;
    }

    setSelfSubmitting(true);
    setSelfStatus(null);

    setTimeout(() => {
      const result = DataService.changeUserPassword(selfUserId, selfCurrentPass, selfNewPass);
      setSelfSubmitting(false);

      if (result.success) {
        setSelfStatus({ type: "success", text: result.message });
        setSelfCurrentPass("");
        setSelfNewPass("");
        setSelfConfirmPass("");
        reloadUsers();
        setTimeout(() => setSelfStatus(null), 4000);
      } else {
        setSelfStatus({ type: "error", text: result.message });
      }
    }, 500);
  };

  const roleBadgeColor: Record<Role, string> = {
    Owner: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    Staff: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    Driver: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    Security: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Top Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#00875A]" />
            User & Driver Password Management
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Manage simple starter credentials and passwords for staff, dispatchers, guards, and mobile truck drivers.
          </p>
        </div>

        {/* Role Filters */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
          {["ALL", "Driver", "Staff", "Owner", "Security"].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === r
                  ? "bg-white dark:bg-slate-800 text-[#00875A] dark:text-emerald-400 shadow-sm font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {r === "ALL" ? "All Accounts" : `${r}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Self-Service Change My Password Card */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-800 p-6 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 shadow-sm">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-[#00875A] text-white">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Self-Service: Change My Password
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Staff and drivers can update their personal starter password anytime.
            </p>
          </div>
        </div>

        <form onSubmit={handleSelfPasswordChange} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Select User */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Select Account
            </label>
            <select
              value={selfUserId}
              onChange={(e) => setSelfUserId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (@{u.username || u.id}) — {u.role}
                </option>
              ))}
            </select>
          </div>

          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Current Password
            </label>
            <input
              type="password"
              placeholder="Enter current password"
              value={selfCurrentPass}
              onChange={(e) => setSelfCurrentPass(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
            />
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              placeholder="Min 4 characters"
              value={selfNewPass}
              onChange={(e) => setSelfNewPass(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
            />
          </div>

          {/* Confirm & Submit */}
          <div className="flex gap-2">
            <input
              type="password"
              required
              placeholder="Confirm new"
              value={selfConfirmPass}
              onChange={(e) => setSelfConfirmPass(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
            />
            <button
              type="submit"
              disabled={selfSubmitting}
              className="px-5 py-2 bg-[#00875A] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center gap-1.5"
            >
              {selfSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
              Update
            </button>
          </div>
        </form>

        {selfStatus && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              selfStatus.type === "success"
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200"
                : "bg-red-100 text-red-900 border border-red-300 dark:bg-red-950/60 dark:text-red-200"
            }`}
          >
            {selfStatus.type === "success" ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{selfStatus.text}</span>
          </div>
        )}

        {/* Self-Service Update Recovery Gmail */}
        <div className="mt-5 pt-4 border-t border-emerald-200/60 dark:border-emerald-800/60">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-[#00875A]" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              My Recovery Gmail Address (Used for 6-Digit OTP Reset)
            </h4>
          </div>
          <form onSubmit={handleSelfEmailSave} className="flex flex-col sm:flex-row gap-2 max-w-xl">
            <input
              type="email"
              required
              placeholder="e.g. yourname@gmail.com"
              value={selfEmail}
              onChange={(e) => setSelfEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
            />
            <button
              type="submit"
              disabled={selfEmailSaving}
              className="px-4 py-2 bg-[#00875A] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center justify-center gap-1.5"
            >
              {selfEmailSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              Save Recovery Gmail
            </button>
          </form>

          {selfEmailStatus && (
            <div
              className={`mt-2.5 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 max-w-xl ${
                selfEmailStatus.type === "success"
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200"
                  : "bg-red-100 text-red-900 border border-red-300 dark:bg-red-950/60 dark:text-red-200"
              }`}
            >
              {selfEmailStatus.type === "success" ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
              <span>{selfEmailStatus.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-6">Employee / Driver</th>
                <th className="py-3.5 px-6">Role</th>
                <th className="py-3.5 px-6">Starter Username</th>
                <th className="py-3.5 px-6">Assigned Vehicle</th>
                <th className="py-3.5 px-6">Login Email / Identifier</th>
                <th className="py-3.5 px-6 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 overflow-hidden">
                      {user.photoUrl ? (
                        <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{user.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-base">{user.name}</div>
                      <div className="text-xs text-slate-400 font-normal">{user.phone || "No phone registered"}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${roleBadgeColor[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                      @{user.username || user.id}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {user.assignedTruckId ? (
                      <span className="font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-md text-xs border border-blue-200 dark:border-blue-800">
                        {user.assignedTruckId}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-mono text-xs">
                    {user.email ? (
                      <span>{user.email}</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-sans italic text-[11px]">No Gmail registered</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingEmailUser(user);
                        setTargetEmail(user.email || "");
                        setEmailModalStatus(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold rounded-lg text-xs transition-colors border border-slate-300 dark:border-slate-600"
                      title="Update Recovery Gmail"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Edit Gmail
                    </button>
                    <button
                      onClick={() => handleOpenReset(user)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-[#00875A] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold rounded-lg text-xs transition-colors border border-emerald-200 dark:border-emerald-800"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-[#00875A] dark:text-emerald-400 rounded-xl">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Admin Reset Password
                </h3>
                <p className="text-xs text-slate-500">
                  Account: <strong>{selectedUser.name}</strong> (@{selectedUser.username || selectedUser.id})
                </p>
              </div>
            </div>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:border-[#00875A] bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-type new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:border-[#00875A] bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                />
              </div>

              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    statusMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {statusMessage.type === "success" ? (
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#00875A] text-white font-bold text-sm rounded-xl hover:brightness-110 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save New Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Gmail Modal */}
      {editingEmailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-[#00875A] dark:text-emerald-400 rounded-xl">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Update Recovery Gmail
                  </h3>
                  <p className="text-xs text-slate-500">
                    Account: <strong>{editingEmailUser.name}</strong> (@{editingEmailUser.username || editingEmailUser.id})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingEmailUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminEmailSave} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  Gmail Address (for Password Reset & OTP)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. user@gmail.com"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  className="px-3.5 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:border-[#00875A] bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Used by driver or staff member when requesting 6-digit OTP password reset codes.
                </span>
              </div>

              {emailModalStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    emailModalStatus.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {emailModalStatus.type === "success" ? (
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{emailModalStatus.text}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={emailModalSaving}
                  onClick={() => setEditingEmailUser(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailModalSaving}
                  className="px-6 py-2.5 bg-[#00875A] text-white font-bold text-sm rounded-xl hover:brightness-110 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {emailModalSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Gmail"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { DataService } from "@/lib/dataService";
import { UserAccount, Role, TruckVehicle } from "@/lib/types";
import { ImageUploadField, deleteStorageImage } from "@/components/ImageUploadField";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Truck,
  Phone,
  Mail,
  User as UserIcon
} from "lucide-react";

const ROLES: Role[] = ["Owner", "Staff", "Driver", "Security"];

export function EmployeeManagement() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [trucks, setTrucks] = useState<TruckVehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("Staff");
  const [password, setPassword] = useState("");
  const [assignedTruckId, setAssignedTruckId] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [initialPhotoUrl, setInitialPhotoUrl] = useState("");
  const tempUploadsRef = useRef<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);

  const loadRoster = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      await DataService.fetchLiveFromSupabase();
      setUsers(DataService.getUsers());
      setTrucks(DataService.getTrucks());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setUsers(DataService.getUsers());
    setTrucks(DataService.getTrucks());
    loadRoster(false);
  }, [loadRoster]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter(u => {
      if (!u.active) return false;
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, roleFilter]);

  const openAddModal = () => {
    setEditingUser(null);
    setName("");
    setUsername("");
    setEmail("");
    setPhone("");
    setRole("Staff");
    setPassword("");
    setAssignedTruckId("");
    setPhotoUrl("");
    setInitialPhotoUrl("");
    tempUploadsRef.current = [];
    setModalOpen(true);
  };

  const openEditModal = (u: UserAccount) => {
    setEditingUser(u);
    setName(u.name);
    setUsername(u.username || "");
    setEmail(u.email || "");
    setPhone(u.phone || "");
    setRole(u.role);
    setPassword("");
    setAssignedTruckId(u.assignedTruckId || "");
    setPhotoUrl(u.photoUrl || "");
    setInitialPhotoUrl(u.photoUrl || "");
    tempUploadsRef.current = [];
    setModalOpen(true);
  };

  const handleCloseModal = async () => {
    // Prune any temporary images uploaded during this canceled edit session
    const unsavedTemps = tempUploadsRef.current.filter(url => url && url !== initialPhotoUrl);
    await Promise.all(unsavedTemps.map(url => deleteStorageImage(url)));
    tempUploadsRef.current = [];
    setModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setBanner({ type: "error", text: "Employee full name is required." });
      return;
    }

    setIsSaving(true);
    setBanner(null);

    // Clean up any intermediate uploaded candidates that aren't the final chosen photoUrl
    const unusedTemps = tempUploadsRef.current.filter(url => url && url !== photoUrl && url !== initialPhotoUrl);
    await Promise.all(unusedTemps.map(url => deleteStorageImage(url)));
    tempUploadsRef.current = [];

    if (editingUser) {
      const updated = await DataService.updateUser(editingUser.id, {
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        role,
        assignedTruckId: role === "Driver" ? assignedTruckId || undefined : undefined,
        photoUrl: photoUrl || "",
        ...(password.trim().length >= 4 ? { password: password.trim() } : {})
      });
      setIsSaving(false);
      if (updated) {
        if (initialPhotoUrl && initialPhotoUrl !== photoUrl) {
          await deleteStorageImage(initialPhotoUrl);
        }
        setModalOpen(false);
        await loadRoster(false);
        setBanner({ type: "success", text: `Updated employee record for ${updated.name}.` });
      } else {
        setBanner({ type: "error", text: "Unable to update employee record." });
      }
    } else {
      const res = await DataService.addUser({
        name: name.trim(),
        username: username.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        role,
        assignedTruckId: role === "Driver" ? assignedTruckId || undefined : undefined,
        photoUrl: photoUrl || undefined,
        password: password.trim() || "1234",
        active: true
      });
      setIsSaving(false);
      if (res.success && res.user) {
        setModalOpen(false);
        await loadRoster(false);
        setBanner({ type: "success", text: `Added ${res.user.name} (${res.user.role}).` });
      } else {
        setBanner({ type: "error", text: res.message || "Failed to create employee." });
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const actor = DataService.getCurrentUser()?.name || "Staff";
    await DataService.deleteUser(target.id, actor);
    await loadRoster(false);
    setBanner({ type: "success", text: `Moved ${target.name} to Trash Archive.` });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 flex flex-col lg:flex-row gap-3 lg:items-center justify-between shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee name, username, email, or role..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | "ALL")}
            className="min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Roles</option>
            {ROLES.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => loadRoster(true)}
            disabled={isRefreshing}
            className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[44px] px-4 py-2 bg-[#004D40] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

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

      {isLoading ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
          Loading employee directory...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
          No active employees match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(u => (
            <div
              key={u.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#004D40] dark:text-emerald-300 font-black flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                    {u.photoUrl ? (
                      <img
                        src={u.photoUrl}
                        alt={u.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{u.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                      {u.name}
                    </h4>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      {u.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(u)}
                    aria-label={`Edit ${u.name}`}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(u)}
                    aria-label={`Delete ${u.name}`}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Username: <strong className="text-slate-700 dark:text-slate-200">{u.username || "None"}</strong></span>
                </div>
                {u.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                )}
                {u.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{u.phone}</span>
                  </div>
                )}
                {u.role === "Driver" && (
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 shrink-0 text-[#004D40] dark:text-emerald-400" />
                    <span>Assigned Truck: <strong>{u.assignedTruckId || "Unassigned"}</strong></span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
            <div className="p-5 bg-[#004D40] text-white flex items-center justify-between">
              <h3 className="text-lg font-black">
                {editingUser ? "Edit Employee Account" : "Add New Employee"}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <ImageUploadField
                label="Staff / Driver Photo"
                folder="employees"
                shape="circle"
                value={photoUrl}
                onChange={setPhotoUrl}
                onTempUploadCreated={(url) => tempUploadsRef.current.push(url)}
                fallbackIcon={<UserIcon className="w-8 h-8" />}
              />

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm font-bold text-slate-900 dark:text-white"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                  Email (for OTP Recovery)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    {editingUser ? "New Password (Optional)" : "Initial Password / PIN"}
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? "Keep existing" : "1234"}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {role === "Driver" && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                    Default Assigned Truck
                  </label>
                  <select
                    value={assignedTruckId}
                    onChange={(e) => setAssignedTruckId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm font-bold text-slate-900 dark:text-white"
                  >
                    <option value="">Unassigned</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.id} • {t.plateNumber} ({t.model})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[44px] px-5 py-2 bg-[#004D40] hover:bg-emerald-900 text-white font-bold text-sm rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Deactivate & Move to Trash?"
        message={`Move employee "${deleteTarget?.name}" to the 30-day Trash Archive and revoke active login sessions?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default EmployeeManagement;

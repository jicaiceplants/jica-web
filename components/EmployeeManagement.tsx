"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, Shield, Phone, Mail, Truck, X, Check, AlertCircle, Upload, Key, UserCheck } from "lucide-react";
import { UserAccount, Role, TruckVehicle } from "@/lib/types";
import { DataService } from "@/lib/dataService";
import { compressImage } from "@/lib/imageUtils";
import ConfirmModal from "./ConfirmModal";

// Compute 2-letter initials (first word initial + last word initial)
function getAvatarInitials(name: string): string {
  if (!name || !name.trim()) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const roleBadgeColors: Record<Role, { badge: string; avatarBg: string }> = {
  Owner: {
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    avatarBg: "bg-gradient-to-br from-purple-600 to-indigo-700 text-white"
  },
  Staff: {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
    avatarBg: "bg-gradient-to-br from-emerald-600 to-teal-700 text-white"
  },
  Security: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    avatarBg: "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
  },
  Driver: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    avatarBg: "bg-gradient-to-br from-blue-600 to-cyan-700 text-white"
  }
};

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<UserAccount[]>([]);
  const [trucks, setTrucks] = useState<TruckVehicle[]>([]);
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<Role>("Staff");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formTruckId, setFormTruckId] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadData = () => {
    setEmployees(DataService.getUsers());
    setTrucks(DataService.getTrucks());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setFormName("");
    setFormUsername("");
    setFormPassword("");
    setFormRole("Staff");
    setFormEmail("");
    setFormPhone("");
    setFormTruckId("");
    setFormPhotoUrl("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (emp: UserAccount) => {
    setEditingId(emp.id);
    setFormName(emp.name);
    setFormUsername(emp.username || "");
    setFormPassword(emp.password || "");
    setFormRole(emp.role);
    setFormEmail(emp.email || "");
    setFormPhone(emp.phone || "");
    setFormTruckId(emp.assignedTruckId || "");
    setFormPhotoUrl(emp.photoUrl || "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setFormError("");
      const compressedDataUrl = await compressImage(file, 600, 0.8);
      setFormPhotoUrl(compressedDataUrl);
    } catch (err: any) {
      setFormError(err.message || "Failed to process photo from device.");
    }
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError("Full Name is required and cannot be blank.");
      return;
    }

    const defaultUsername = formUsername.trim() || 
      (formRole === "Driver" 
        ? `truck${employees.filter(e => e.role === "Driver").length + 1}driver` 
        : trimmedName.toLowerCase().replace(/\s+/g, ""));
    const defaultPassword = formPassword.trim() || defaultUsername;

    if (editingId) {
      // Update existing
      DataService.updateUser(editingId, {
        name: trimmedName,
        username: defaultUsername,
        password: defaultPassword,
        role: formRole,
        email: formEmail.trim(),
        phone: formPhone.trim(),
        assignedTruckId: formRole === "Driver" ? formTruckId : undefined,
        photoUrl: formPhotoUrl || undefined
      });
      setFeedbackMessage(`Updated ${trimmedName} successfully!`);
    } else {
      // Create new
      DataService.addUser({
        name: trimmedName,
        username: defaultUsername,
        password: defaultPassword,
        role: formRole,
        email: formEmail.trim(),
        phone: formPhone.trim(),
        assignedTruckId: formRole === "Driver" ? formTruckId : undefined,
        photoUrl: formPhotoUrl || undefined,
        active: true
      });
      setFeedbackMessage(`Added ${trimmedName} to the roster! Starter Username: ${defaultUsername}`);
    }

    setIsModalOpen(false);
    reloadData();
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const confirmDelete = (id: string) => {
    setEmployeeToDelete(id);
  };

  const executeDelete = () => {
    if (employeeToDelete) {
      DataService.deleteUser(employeeToDelete);
      reloadData();
      setEmployeeToDelete(null);
      setFeedbackMessage("Employee removed from roster.");
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const filteredEmployees = employees.filter(e => filterRole === "ALL" || e.role === filterRole);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#00875A]" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              JICA Personnel & Staff Management
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Official personnel roster for Gusa Ice Plant, Security Gate, and Cagayan de Oro delivery fleet.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-6 py-3 bg-[#00875A] hover:bg-[#007048] text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all text-sm shrink-0"
        >
          <Plus className="w-5 h-5" />
          Add Personnel
        </button>
      </div>

      {/* Role Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
          Filter:
        </span>
        {["ALL", "Owner", "Staff", "Security", "Driver"].map((r) => {
          const count = employees.filter(e => r === "ALL" || e.role === r).length;
          return (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                filterRole === r
                  ? "bg-[#00875A] text-white border-[#00875A] shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <span>{r === "ALL" ? "All Personnel" : r}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterRole === r ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toast Notification */}
      {feedbackMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-800 dark:text-emerald-200 text-sm font-semibold">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Personnel Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full py-16 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">No Personnel Found</h4>
            <p className="text-sm text-slate-500 max-w-md mt-1 mb-5">
              No staff or drivers match your current filter. Click &quot;Add Personnel&quot; to register drivers or office staff.
            </p>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00875A] hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Personnel
            </button>
          </div>
        ) : (
          filteredEmployees.map((employee) => {
          const colors = roleBadgeColors[employee.role] || roleBadgeColors.Staff;
          const initials = getAvatarInitials(employee.name);
          const assignedTruck = trucks.find(t => t.id === employee.assignedTruckId);

          return (
            <div
              key={employee.id}
              className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-md transition-all relative"
            >
              {/* Card Header with Avatar */}
              <div className="p-6 flex items-start gap-4 border-b border-slate-100 dark:border-slate-700/60">
                {/* Fallback Initials Avatar Badge / Photo */}
                <div className="relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-inner">
                  {employee.photoUrl ? (
                    <img
                      src={employee.photoUrl}
                      alt={employee.name}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                  <div
                    className={`w-full h-full flex items-center justify-center font-black text-xl shadow-inner select-none ${colors.avatarBg} ${employee.photoUrl ? "hidden" : "flex"}`}
                  >
                    {initials}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider rounded-md border ${colors.badge}`}>
                      {employee.role}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(employee)}
                        title="Edit personnel"
                        aria-label="Edit personnel"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(employee.id)}
                        title="Remove personnel"
                        aria-label="Remove personnel"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-1.5 truncate">
                    {employee.name}
                  </h3>
                  
                  {/* Starter Username Badge */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      @{employee.username || employee.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Body - Contact & Assignment Details */}
              <div className="p-5 flex flex-col gap-2.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-900/30 flex-1 justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{employee.email || "No email provided"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{employee.phone || "No phone provided"}</span>
                  </div>
                </div>

                {/* If Driver: Show Assigned Truck Vehicle */}
                {employee.role === "Driver" && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold">
                      <Truck className="w-4 h-4" />
                      <span>{employee.assignedTruckId || "Unassigned"}</span>
                    </div>
                    {assignedTruck && (
                      <span className="text-[11px] font-mono font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">
                        {assignedTruck.plateNumber}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }))}
      </div>

      {/* Add / Edit Personnel Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {editingId ? "Edit Personnel Profile" : "Add New Personnel"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEmployee} className="p-6 flex flex-col gap-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Photo Upload Area (Real Device Upload with Compression) */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-800 shrink-0 flex items-center justify-center relative">
                  {formPhotoUrl ? (
                    <img 
                      src={formPhotoUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span className="font-black text-2xl text-slate-400">
                      {formName ? getAvatarInitials(formName) : "??"}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Profile Photo
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00875A] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload From Device
                    </button>
                    {formPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormPhotoUrl("")}
                        className="px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Auto-compressed to &lt;80 KB. Stored safely in cloud.
                  </p>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dino Trocino, Ellyza Dilapos..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Role & Department
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as Role)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                >
                  <option value="Owner">Owner / Executive</option>
                  <option value="Staff">Office Staff / Dispatcher</option>
                  <option value="Security">Security Guard / Gate In-Charge</option>
                  <option value="Driver">Delivery Driver</option>
                </select>
              </div>

              {/* Starter Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Login Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. truck1driver, staff1"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Starter Password
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. truck1driver"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  />
                </div>
              </div>

              {/* If Driver: Assigned Truck */}
              {formRole === "Driver" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Assigned Delivery Truck
                  </label>
                  <select
                    value={formTruckId}
                    onChange={(e) => setFormTruckId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  >
                    <option value="">-- No Truck Assigned --</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id} • {t.plateNumber} ({t.model})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Contact Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Gmail Address (For OTP Recovery)
                  </label>
                  <input
                    type="email"
                    placeholder="user@gmail.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="0917-xxx-xxxx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#007048] text-white font-bold text-sm shadow-md"
                >
                  {editingId ? "Save Changes" : "Create Personnel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!employeeToDelete}
        onConfirm={executeDelete}
        onCancel={() => setEmployeeToDelete(null)}
        message="Are you sure you want to remove this employee from the active roster? This action can be audited in system logs."
      />
    </div>
  );
}

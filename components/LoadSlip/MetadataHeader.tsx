"use client";

import { Lock } from "lucide-react";
import { TruckVehicle, UserAccount } from "@/lib/types";
import ComboBox from "../ComboBox";

interface MetadataHeaderProps {
  currentDate: string;
  currentTime: string;
  selectedTruckId: string;
  onTruckChange: (truckId: string) => void;
  selectedDriverId: string;
  onDriverChange: (driverId: string) => void;
  trucks: TruckVehicle[];
  driversList: UserAccount[];
  currentUser: UserAccount;
}

export default function MetadataHeader({
  currentDate,
  currentTime,
  selectedTruckId,
  onTruckChange,
  selectedDriverId,
  onDriverChange,
  trucks,
  driversList,
  currentUser
}: MetadataHeaderProps) {
  const truckOptions = (trucks || []).map(t => ({
    value: t.id,
    label: `${t.id} - ${t.plateNumber}`,
    subLabel: `${t.model} (Max Capacity: ${t.capacitySacks} sacks)`
  }));

  const driverOptions = (driversList || []).map(d => ({
    value: d.id,
    label: d.name,
    subLabel: d.assignedTruckId ? `Assigned to ${d.assignedTruckId}` : "Available Driver"
  }));

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Truck Selector (100% live from Supabase) */}
      <ComboBox
        label="Truck Number & Plate"
        value={selectedTruckId}
        onChange={onTruckChange}
        options={truckOptions}
        placeholder={truckOptions.length === 0 ? "No trucks found — add in Settings" : "Select Truck..."}
        disabled={truckOptions.length === 0}
      />

      {/* Date (Auto Asia/Manila read-only) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Date (Manila)</label>
        <input
          type="date"
          className="min-h-[44px] px-3.5 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-not-allowed font-medium text-base"
          value={currentDate}
          readOnly
        />
      </div>

      {/* Time (Auto Asia/Manila read-only) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Time (UTC+8)</label>
        <input
          type="time"
          className="min-h-[44px] px-3.5 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-not-allowed font-medium text-base"
          value={currentTime}
          readOnly
        />
      </div>

      {/* In-Charge (Strictly Auto-Locked to Authenticated User — Never Editable or Spoofable) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span>In-Charge</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-[#00875A] dark:text-emerald-300">
            <Lock className="w-2.5 h-2.5" />
            Locked
          </span>
        </label>
        <div
          className="min-h-[44px] px-3.5 py-2.5 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 text-slate-900 dark:text-white flex items-center justify-between gap-2 select-none"
          title="Auto-locked to currently signed-in dispatcher account"
        >
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{currentUser.name}</div>
            <div className="text-[11px] font-semibold text-[#00875A] dark:text-emerald-400 truncate">
              {currentUser.role} {currentUser.username ? `• @${currentUser.username}` : ""}
            </div>
          </div>
          <Lock className="w-4 h-4 text-[#00875A] shrink-0" />
        </div>
      </div>

      {/* Assigned Driver Selector (100% live from Supabase) */}
      <ComboBox
        label="Assigned Driver"
        value={selectedDriverId}
        onChange={onDriverChange}
        options={driverOptions}
        placeholder={driverOptions.length === 0 ? "No drivers found — add in Employees" : "Select Driver..."}
        disabled={driverOptions.length === 0}
      />
    </section>
  );
}

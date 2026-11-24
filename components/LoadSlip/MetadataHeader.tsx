"use client";

import { TruckVehicle, UserAccount } from "@/lib/types";
import ComboBox from "../ComboBox";

interface MetadataHeaderProps {
  currentDate: string;
  currentTime: string;
  selectedTruckId: string;
  onTruckChange: (truckId: string) => void;
  selectedInChargeId: string;
  onInChargeChange: (staffId: string) => void;
  selectedDriverId: string;
  onDriverChange: (driverId: string) => void;
  trucks: TruckVehicle[];
  staffList: UserAccount[];
  driversList: UserAccount[];
}

export default function MetadataHeader({
  currentDate,
  currentTime,
  selectedTruckId,
  onTruckChange,
  selectedInChargeId,
  onInChargeChange,
  selectedDriverId,
  onDriverChange,
  trucks,
  staffList,
  driversList
}: MetadataHeaderProps) {
  const truckOptions = (trucks || []).map(t => ({
    value: t.id,
    label: `${t.id} - ${t.plateNumber}`,
    subLabel: `${t.model} (Cap: ${t.capacitySacks} sacks)`
  }));

  const staffOptions = (staffList || []).map(s => ({
    value: s.id,
    label: s.name,
    subLabel: `${s.role} • ${s.phone || ""}`
  }));

  const driverOptions = (driversList || []).map(d => ({
    value: d.id,
    label: d.name,
    subLabel: d.assignedTruckId ? `Assigned to ${d.assignedTruckId}` : "Available Driver"
  }));

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Searchable Combo Box for Truck */}
      <ComboBox
        label="Truck Number & Plate"
        value={selectedTruckId}
        onChange={onTruckChange}
        options={truckOptions}
        placeholder={truckOptions.length === 0 ? "No trucks registered (Add in Settings)" : "Select Truck..."}
        disabled={truckOptions.length === 0}
      />

      {/* Date (Auto read-only) */}
      <div className="flex flex-col gap-1.5 opacity-90">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Date</label>
        <input 
          type="date" 
          className="px-3.5 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-not-allowed font-medium text-base" 
          value={currentDate}
          readOnly
        />
      </div>

      {/* Time (Auto read-only) */}
      <div className="flex flex-col gap-1.5 opacity-90">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Time</label>
        <input 
          type="time" 
          className="px-3.5 py-2.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-not-allowed font-medium text-base" 
          value={currentTime}
          readOnly
        />
      </div>

      {/* Searchable Combo Box for In-Charge */}
      <ComboBox
        label="In-Charge (Dispatch/Owner)"
        value={selectedInChargeId}
        onChange={onInChargeChange}
        options={staffOptions}
        placeholder={staffOptions.length === 0 ? "No staff registered (Add in Employees)" : "Select In-Charge..."}
        disabled={staffOptions.length === 0}
      />

      {/* Searchable Combo Box for Driver */}
      <ComboBox
        label="Assigned Driver"
        value={selectedDriverId}
        onChange={onDriverChange}
        options={driverOptions}
        placeholder={driverOptions.length === 0 ? "No drivers registered (Add in Employees)" : "Select Driver..."}
        disabled={driverOptions.length === 0}
      />
    </section>
  );
}

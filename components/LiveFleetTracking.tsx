"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, MapPin, Navigation, Truck, AlertOctagon, CheckCircle2, ShieldAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { LiveTruckTelemetry } from "@/lib/types";
import { DataService } from "@/lib/dataService";

const MapComponent = dynamic(() => import("./LiveFleetMap"), { ssr: false });

export default function LiveFleetTracking() {
  const [telemetry, setTelemetry] = useState<LiveTruckTelemetry[]>([]);
  const [activeSos, setActiveSos] = useState<LiveTruckTelemetry | null>(null);

  useEffect(() => {
    const list = DataService.getLiveTelemetry();
    setTelemetry(list);
    const alertTruck = list.find(t => t.sosAlert && t.sosAlert.active);
    setActiveSos(alertTruck || null);
  }, []);

  const handleDispatchRescue = (truckId: string) => {
    DataService.dispatchRescue(truckId);
    const updated = DataService.getLiveTelemetry();
    setTelemetry(updated);
    const alertTruck = updated.find(t => t.sosAlert && t.sosAlert.active);
    setActiveSos(alertTruck || null);
    alert(`Rescue vehicle dispatched to ${truckId} near Lapasan Highway! Driver notified.`);
  };

  return (
    <div className="flex flex-col gap-6 h-full min-h-[850px] pb-12">
      {/* Emergency Alert Center Banner */}
      {activeSos && (
        <section className={`border-l-4 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md transition-all ${
          activeSos.sosAlert?.dispatchedRescue
            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-900 dark:text-amber-200"
            : "bg-red-50 dark:bg-red-950/30 border-red-500 text-red-900 dark:text-red-200 animate-pulse"
        }`}>
          <div className="flex items-start md:items-center gap-4">
            <div className={`p-3 rounded-full shrink-0 ${
              activeSos.sosAlert?.dispatchedRescue
                ? "bg-amber-100 dark:bg-amber-900/50 text-amber-600"
                : "bg-red-100 dark:bg-red-900/60 text-red-600"
            }`}>
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-black tracking-tight">Emergency Roadside Alert Center</h2>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  activeSos.sosAlert?.dispatchedRescue
                    ? "bg-amber-600 text-white"
                    : "bg-red-600 text-white"
                }`}>
                  {activeSos.sosAlert?.dispatchedRescue ? "Rescue Dispatched" : "1 Breakdown Active"}
                </span>
              </div>
              <p className="text-sm font-medium">
                <strong>{activeSos.truckId} ({activeSos.truckPlate}) - Driver {activeSos.driverName}:</strong>{" "}
                {activeSos.sosAlert?.reason} at {activeSos.currentLocationName}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {activeSos.sosAlert?.dispatchedRescue ? (
              <span className="flex items-center gap-1.5 font-bold text-xs bg-amber-200/60 dark:bg-amber-900/50 px-4 py-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Help en route to Lapasan
              </span>
            ) : (
              <button
                onClick={() => handleDispatchRescue(activeSos.truckId)}
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold py-2.5 px-7 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm shrink-0"
              >
                Dispatch Rescue Team
              </button>
            )}
          </div>
        </section>
      )}

      {/* Main Tracking Area */}
      <section className="flex flex-col xl:flex-row gap-6 flex-1 h-auto xl:h-[650px]">
        {/* Map Container */}
        <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm overflow-hidden relative h-[500px] xl:h-full w-full">
          {/* Overlay Map Badge */}
          <div className="absolute top-4 left-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 z-[1000]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Active Fleet Route Monitoring</h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Live GPS & Sack Delivery Tracking</p>
          </div>

          <MapComponent />
        </div>

        {/* Live Driver Progress Monitor Side Panel */}
        <div className="w-full xl:w-[420px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-3xl overflow-hidden flex flex-col shrink-0">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Active Driver Progress</h2>
            <p className="text-slate-500 text-xs mt-1">
              Live sack inventory reconciliation and stop progress.
            </p>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/30">
            {telemetry.map((t) => {
              const fulfillmentPct = t.totalStops > 0 ? Math.round((t.completedStops / t.totalStops) * 100) : 0;

              return (
                <div
                  key={t.truckId}
                  className={`bg-white dark:bg-slate-800 border-2 rounded-2xl p-4 shadow-sm transition-all ${
                    t.status === "Alert"
                      ? "border-red-300 dark:border-red-800/60 bg-red-50/30"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {/* Truck & Driver Row */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl font-bold ${
                        t.status === "Alert"
                          ? "bg-red-100 text-red-600"
                          : t.status === "Delivering"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-amber-100 text-amber-600"
                      }`}>
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{t.truckId}</h3>
                          <span className="text-xs font-mono text-slate-400">({t.truckPlate})</span>
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">{t.driverName}</span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider rounded-lg ${
                      t.status === "Alert"
                        ? "bg-red-100 text-red-700"
                        : t.status === "Delivering"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {t.status}
                    </span>
                  </div>

                  {/* Sacks on Truck Counter (Loaded vs. Delivered vs. Remaining) */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Loaded</span>
                      <span className="text-sm font-black text-blue-600">{t.loadedSacks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Delivered</span>
                      <span className="text-sm font-black text-emerald-600">{t.deliveredSacks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">On Truck</span>
                      <span className="text-sm font-black text-amber-600">{t.remainingSacks}</span>
                    </div>
                  </div>

                  {/* Stop Progress Bar */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600 dark:text-slate-400">
                        {t.completedStops} of {t.totalStops} Stops Completed
                      </span>
                      <span className="text-[#00875A] font-extrabold">{fulfillmentPct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#00875A] h-full rounded-full transition-all duration-300"
                        style={{ width: `${fulfillmentPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Current Location / Target Stop */}
                  <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-100/60 dark:bg-slate-900/40 p-2.5 rounded-lg">
                    <MapPin className="w-4 h-4 text-[#00875A] shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Current Stop: {t.currentStopStoreName}</div>
                      <div className="text-slate-500 text-[11px]">{t.currentLocationName}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

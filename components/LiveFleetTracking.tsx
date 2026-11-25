"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataService } from "@/lib/dataService";
import { supabase } from "@/lib/supabaseClient";
import { LiveFleetMap } from "@/components/LiveFleetMap";
import { LiveTruckTelemetry, DeliveryLocation } from "@/lib/types";
import { formatManilaDateTime } from "@/lib/dateUtils";
import {
  Navigation,
  Truck,
  Siren,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Package,
  Gauge
} from "lucide-react";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://jica-backend-production.up.railway.app")
  .replace(/\/+$/, "")
  .trim();

export function LiveFleetTracking() {
  const [telemetry, setTelemetry] = useState<LiveTruckTelemetry[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadLiveFleet = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const [liveTel] = await Promise.all([
        DataService.fetchLiveTelemetry(),
        DataService.fetchLiveFromSupabase()
      ]);
      setTelemetry(liveTel);
      setLocations(DataService.getLocations());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLocations(DataService.getLocations());
    loadLiveFleet(false);

    const channel = supabase
      .channel("live-fleet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "gps_logs" }, () => {
        loadLiveFleet(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts" }, () => {
        loadLiveFleet(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "load_slips" }, () => {
        loadLiveFleet(false);
      })
      .subscribe();

    const poll = setInterval(() => loadLiveFleet(false), 5000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [loadLiveFleet]);

  const handleDispatchRescue = async (truck: LiveTruckTelemetry) => {
    setBanner(null);
    DataService.dispatchRescue(truck.truckId);

    try {
      const currentUser = DataService.getCurrentUser();
      let alertId = "";
      const activeRes = await fetch(`${BACKEND_URL}/api/v1/telemetry/sos/active`);
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        const match = (activeData.alerts || []).find(
          (a: any) => a.truck_id === truck.truckId && a.status === "Active"
        );
        if (match?.id) alertId = match.id;
      }

      if (alertId) {
        await fetch(`${BACKEND_URL}/api/v1/telemetry/sos/acknowledge`, {
          method: "POST",
          headers: DataService.getAuthHeaders(),
          body: JSON.stringify({
            alert_id: alertId,
            acknowledged_by: currentUser?.name || "Dispatch Desk",
            dispatcher_reply: "Rescue unit dispatched immediately from Live Fleet Control."
          })
        });
      }
    } catch {
      // Non-fatal fallback
    }

    setBanner({
      type: "success",
      text: `Rescue acknowledgment sent for ${truck.truckId} (${truck.driverName}).`
    });
    await loadLiveFleet(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-emerald-600" />
            <span>Live Fleet GPS Corridor</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time truck coordinates, sack delivery progress, and active breakdown alerts
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadLiveFleet(true)}
          disabled={isRefreshing}
          className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh Positions</span>
        </button>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${banner.type === "success"
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <LiveFleetMap
            telemetry={telemetry}
            locations={locations}
            selectedTruckId={selectedTruckId}
            onSelectTruck={setSelectedTruckId}
          />
        </div>

        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Active Fleet Vehicles ({telemetry.length})
          </div>

          {isLoading ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
              Loading live fleet telemetry...
            </div>
          ) : telemetry.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No fleet telemetry active right now. Dispatch a Load Slip to track vehicles live.
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto scroll-touch pr-1">
              {telemetry.map(trk => {
                const isSelected = selectedTruckId === trk.truckId;
                const isAlert = trk.status === "Alert" || Boolean(trk.sosAlert?.active);

                return (
                  <div
                    key={trk.truckId}
                    onClick={() => setSelectedTruckId(trk.truckId)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${isAlert
                      ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800"
                      : isSelected
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-[#004D40] dark:border-emerald-600"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Truck
                          className={`w-4 h-4 ${isAlert ? "text-red-600" : "text-[#004D40] dark:text-emerald-400"
                            }`}
                        />
                        <strong className="text-sm font-black text-slate-900 dark:text-white">
                          {trk.truckId}
                        </strong>
                        <span className="text-xs text-slate-500">{trk.truckPlate}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isAlert
                          ? "bg-red-600 text-white animate-pulse"
                          : trk.status === "Idle"
                            ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}
                      >
                        {trk.status}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <div>
                        Driver: <strong>{trk.driverName || "Unassigned"}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {trk.deliveredSacks}/{trk.loadedSacks} sacks
                        </span>
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5" />
                          {trk.speedKmh} km/h
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Last ping: {formatManilaDateTime(trk.lastPingTime)}
                      </div>
                    </div>

                    {trk.sosAlert?.active && (
                      <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-900 space-y-2">
                        <div className="text-xs font-black text-red-700 dark:text-red-300 flex items-center gap-1.5">
                          <Siren className="w-4 h-4" />
                          <span>SOS: {trk.sosAlert.reason}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDispatchRescue(trk);
                            }}
                            className="flex-1 min-h-[44px] py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl cursor-pointer"
                          >
                            {trk.sosAlert.dispatchedRescue ? "Rescue Dispatched ✓" : "Send Rescue Acknowledgment"}
                          </button>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const currentUser = DataService.getCurrentUser();
                              try {
                                await fetch(`${BACKEND_URL}/api/v1/telemetry/sos/resolve`, {
                                  method: "POST",
                                  headers: DataService.getAuthHeaders(),
                                  body: JSON.stringify({
                                    truck_id: trk.truckId,
                                    driver_id: trk.driverId,
                                    resolved_by: currentUser?.name || "Dispatch Desk"
                                  })
                                });
                              } catch {
                                // non-fatal
                              }
                              setBanner({
                                type: "success",
                                text: `SOS alert resolved for ${trk.truckId}.`
                              });
                              await loadLiveFleet(false);
                            }}
                            className="min-h-[44px] py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                          >
                            Resolve SOS
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveFleetTracking;

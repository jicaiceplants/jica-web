"use client";

import { useEffect, useRef, useState } from "react";
import { DataService } from "@/lib/dataService";
import { CDO_DEPOT } from "@/lib/mockData";
import { LiveTruckTelemetry, DeliveryLocation } from "@/lib/types";
import { Truck, MapPin, Warehouse, AlertTriangle, CheckCircle, Navigation, Info } from "lucide-react";

declare global {
  interface Window {
    google?: any;
    initGoogleFleetMap?: () => void;
  }
}

export default function LiveFleetMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [telemetry, setTelemetry] = useState<LiveTruckTelemetry[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [selectedItem, setSelectedItem] = useState<{
    type: "depot" | "hub" | "truck";
    title: string;
    sub: string;
    details?: any;
  } | null>(null);

  const [hasGoogleMapsKey, setHasGoogleMapsKey] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  useEffect(() => {
    const list = DataService.getLiveTelemetry();
    const hubs = DataService.getLocations();
    setTelemetry(list);
    setLocations(hubs);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (apiKey && apiKey !== "your_google_maps_api_key_here") {
      setHasGoogleMapsKey(true);

      // Dynamically load Google Maps JavaScript API
      if (typeof window !== "undefined") {
        if (window.google?.maps) {
          initGoogleMap();
        } else {
          const existingScript = document.getElementById("google-maps-script");
          if (!existingScript) {
            const script = document.createElement("script");
            script.id = "google-maps-script";
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
              initGoogleMap();
            };
            document.head.appendChild(script);
          } else {
            existingScript.addEventListener("load", initGoogleMap);
          }
        }
      }
    }
  }, []);

  const initGoogleMap = () => {
    if (!mapContainerRef.current || !window.google?.maps) return;

    try {
      const google = window.google;
      const cdoCenter = { lat: 8.4772, lng: 124.6540 };

      const map = new google.maps.Map(mapContainerRef.current, {
        center: cdoCenter,
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });

      const infoWindow = new google.maps.InfoWindow();

      // 1. JICA Ice Plant Depot Pin (Gusa Old Rd)
      const depotPos = { lat: CDO_DEPOT.latitude, lng: CDO_DEPOT.longitude };
      const depotMarker = new google.maps.Marker({
        position: depotPos,
        map,
        title: CDO_DEPOT.name,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: "#00875A",
          fillOpacity: 1,
          strokeColor: "#FFD700",
          strokeWeight: 2.5
        }
      });

      depotMarker.addListener("click", () => {
        infoWindow.setContent(`
          <div style="font-family: sans-serif; padding: 4px;">
            <div style="font-weight: 900; color: #00875A; font-size: 14px;">🏭 ${CDO_DEPOT.name}</div>
            <div style="font-size: 12px; color: #334155; margin-top: 2px;">${CDO_DEPOT.address}</div>
            <div style="font-size: 11px; font-weight: bold; color: #0f172a; margin-top: 4px; background: #ecfdf5; padding: 3px 6px; border-radius: 4px; display: inline-block;">
              Official Plant Origin & Return Point
            </div>
          </div>
        `);
        infoWindow.open(map, depotMarker);
      });

      // 2. Saved Delivery Location Hubs
      locations.forEach((hub) => {
        const hubMarker = new google.maps.Marker({
          position: { lat: hub.latitude, lng: hub.longitude },
          map,
          title: hub.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#3b82f6",
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 2
          }
        });

        hubMarker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="font-family: sans-serif; padding: 4px;">
              <div style="font-weight: 800; color: #1e3a8a; font-size: 13px;">📍 ${hub.name}</div>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">${hub.address}</div>
              <div style="font-size: 11px; font-weight: bold; color: #2563eb; margin-top: 4px;">
                Zone: ${hub.zone}
              </div>
            </div>
          `);
          infoWindow.open(map, hubMarker);
        });
      });

      // 3. Live Active Driver Trucks
      telemetry.forEach((t) => {
        const isAlert = t.status === "Alert";
        const color = isAlert ? "#ef4444" : t.status === "Delivering" ? "#00875A" : "#f59e0b";

        const truckMarker = new google.maps.Marker({
          position: { lat: t.latitude, lng: t.longitude },
          map,
          title: `${t.truckId} - ${t.driverName}`,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            rotation: t.heading || 0
          }
        });

        truckMarker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="font-family: sans-serif; padding: 6px; min-width: 200px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 900; color: #0f172a; font-size: 14px;">🚚 ${t.truckId} (${t.truckPlate})</span>
                <span style="font-size: 10px; font-weight: 800; background: ${color}20; color: ${color}; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                  ${t.status}
                </span>
              </div>
              <div style="font-size: 12px; font-weight: bold; color: #334155; margin-top: 4px;">Driver: ${t.driverName}</div>
              <div style="font-size: 11px; color: #64748b;">Current Stop: <strong>${t.currentStopStoreName}</strong></div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Speed: ${t.speedKmh} km/h • Updated: ${t.lastPingTime}</div>
              <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 11px; display: flex; justify-content: space-between;">
                <span>Sacks Delivered: <strong>${t.deliveredSacks}/${t.loadedSacks}</strong></span>
                <span style="color: #00875A; font-weight: bold;">Remaining: ${t.remainingSacks}</span>
              </div>
              ${isAlert && t.sosAlert ? `
                <div style="margin-top: 6px; background: #fef2f2; border: 1px solid #f87171; padding: 4px 6px; border-radius: 4px; color: #b91c1c; font-size: 11px; font-weight: bold;">
                  ⚠️ SOS: ${t.sosAlert.reason}
                </div>
              ` : ''}
            </div>
          `);
          infoWindow.open(map, truckMarker);
        });
      });

      setMapLoaded(true);
    } catch (err) {
      console.error("Error initializing Google Maps:", err);
    }
  };

  return (
    <div className="w-full h-[500px] xl:h-full relative bg-slate-900 rounded-3xl overflow-hidden">
      {/* Real Google Maps Container */}
      <div 
        ref={mapContainerRef} 
        className={`w-full h-full ${hasGoogleMapsKey && mapLoaded ? "block" : "hidden"}`} 
      />

      {/* Interactive Google-Ready Vector Map Canvas (Displayed when no live key is set or offline) */}
      {(!hasGoogleMapsKey || !mapLoaded) && (
        <div className="w-full h-full relative flex flex-col justify-between p-6 bg-radial from-slate-900 via-slate-950 to-black select-none overflow-hidden">
          {/* Subtle Google Maps Integration Banner */}
          <div className="z-20 self-end bg-slate-800/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700 text-[11px] text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Google Maps JavaScript API Ready</span>
          </div>

          {/* Interactive CDO Map Graphic */}
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-40 pointer-events-none">
            <svg viewBox="0 0 1000 650" className="w-full h-full object-cover">
              {/* Cagayan de Oro River & Macajalar Bay */}
              <path
                d="M 50,50 Q 300,90 600,60 T 950,50"
                fill="none"
                stroke="#1e3a8a"
                strokeWidth="70"
                opacity="0.4"
              />
              <path
                d="M 380,60 Q 370,250 340,400 T 310,620"
                fill="none"
                stroke="#1e3a8a"
                strokeWidth="24"
                opacity="0.5"
              />
              {/* National Highway & C.M. Recto Ave Arterial */}
              <path
                d="M 850,230 L 680,260 L 520,270 L 400,280 L 320,310 L 260,380 L 220,520 L 190,620"
                fill="none"
                stroke="#334155"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 850,230 L 680,260 L 520,270 L 400,280 L 320,310 L 260,380 L 220,520 L 190,620"
                fill="none"
                stroke="#00875A"
                strokeWidth="3"
                strokeDasharray="8 6"
              />
            </svg>
          </div>

          {/* Pins Overlay (JICA Depot, CDO Hubs, Live Fleet) */}
          <div className="absolute inset-0 z-10 p-8 pointer-events-auto flex items-center justify-center">
            <div className="relative w-full max-w-4xl h-[420px]">
              
              {/* 1. JICA Ice Plant Depot Pin (Gusa Old Rd) */}
              <button
                onClick={() => setSelectedItem({
                  type: "depot",
                  title: CDO_DEPOT.name,
                  sub: CDO_DEPOT.address,
                  details: {
                    coordinates: `${CDO_DEPOT.latitude}, ${CDO_DEPOT.longitude}`,
                    role: "Cold Storage, Bagging & Fleet Departure Plant"
                  }
                })}
                style={{ right: "12%", top: "34%" }}
                className="absolute flex flex-col items-center group -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 focus:outline-hidden"
              >
                <div className="w-11 h-11 rounded-2xl bg-[#00875A] border-3 border-[#FFD700] shadow-xl flex items-center justify-center text-lg text-white">
                  🏭
                </div>
                <div className="mt-1 px-2.5 py-0.5 rounded-full bg-[#00875A] text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                  Gusa Ice Plant
                </div>
              </button>

              {/* 2. Delivery Hub Pins */}
              {locations.map((loc, idx) => {
                // Computed positions across the CDO corridor
                const leftPos = `${22 + idx * 10}%`;
                const topPos = `${38 + (idx % 2 === 0 ? -10 : 8)}%`;

                return (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedItem({
                      type: "hub",
                      title: loc.name,
                      sub: loc.address,
                      details: { zone: loc.zone, customers: loc.customersCount || 3 }
                    })}
                    style={{ left: leftPos, top: topPos }}
                    className="absolute flex flex-col items-center group -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 focus:outline-hidden"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">
                      📍
                    </div>
                    <div className="mt-1 px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-slate-200 text-[10px] font-bold truncate max-w-[110px] shadow-sm">
                      {loc.name.split(" - ")[0]}
                    </div>
                  </button>
                );
              })}

              {/* 3. Live Active Driver Trucks */}
              {telemetry.map((t, idx) => {
                const isAlert = t.status === "Alert";
                const bg = isAlert ? "bg-red-600 animate-pulse" : t.status === "Delivering" ? "bg-[#00875A]" : "bg-amber-500";
                const leftPos = idx === 0 ? "54%" : idx === 1 ? "28%" : "68%";
                const topPos = idx === 0 ? "46%" : idx === 1 ? "68%" : "42%";

                return (
                  <button
                    key={t.truckId}
                    onClick={() => setSelectedItem({
                      type: "truck",
                      title: `${t.truckId} (${t.truckPlate})`,
                      sub: `Driver: ${t.driverName}`,
                      details: t
                    })}
                    style={{ left: leftPos, top: topPos }}
                    className="absolute flex flex-col items-center group -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 focus:outline-hidden z-20"
                  >
                    <div className={`w-10 h-10 rounded-2xl ${bg} border-2 border-white shadow-2xl flex items-center justify-center text-white text-sm font-bold`}>
                      🚚
                    </div>
                    <div className="mt-1 px-2 py-0.5 rounded-full bg-slate-950/95 border border-slate-700 text-white text-[10px] font-black tracking-wider flex items-center gap-1 shadow-md">
                      <span>{t.truckId}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isAlert ? "bg-red-400" : "bg-emerald-400"}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Detail Modal / Popup Card */}
          {selectedItem && (
            <div className="z-30 self-center bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-[#00875A] dark:text-emerald-300">
                    {selectedItem.type === "depot" ? "Official JICA Origin Plant" : selectedItem.type === "truck" ? "Live Fleet Telemetry" : "Delivery Hub"}
                  </span>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white mt-1">
                    {selectedItem.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    {selectedItem.sub}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  ✕
                </button>
              </div>

              {selectedItem.type === "truck" && selectedItem.details && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Current Location</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {selectedItem.details.currentStopStoreName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Delivery Sacks</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {selectedItem.details.deliveredSacks} / {selectedItem.details.loadedSacks} Sacks
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Vehicle Status</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                      {selectedItem.details.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">GPS Speed</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {selectedItem.details.speedKmh} km/h
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Corridor Guide */}
          <div className="z-10 bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold">Corridor: JICA ICEPLANT ➔ Lapasan ➔ Divisoria ➔ Uptown CDO</span>
            <span className="font-mono text-emerald-400 font-bold">Plant: #69 Old Road Gusa, CDOC 9000 (8.4770, 124.6798)</span>
          </div>
        </div>
      )}
    </div>
  );
}

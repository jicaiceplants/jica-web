"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { loadGoogleMaps, BASE_GOOGLE_MAP_OPTIONS } from "@/lib/googleMapsLoader";
import { CDO_DEPOT, CDO_MAP_CENTER } from "@/lib/constants";
import { LiveTruckTelemetry, DeliveryLocation } from "@/lib/types";
import { MapPin } from "lucide-react";

interface LiveFleetMapProps {
  telemetry: LiveTruckTelemetry[];
  locations: DeliveryLocation[];
  selectedTruckId?: string;
  onSelectTruck?: (truckId: string) => void;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export function LiveFleetMap({
  telemetry,
  locations,
  selectedTruckId,
  onSelectTruck
}: LiveFleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const onSelectTruckRef = useRef(onSelectTruck);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    onSelectTruckRef.current = onSelectTruck;
  }, [onSelectTruck]);

  const mapOptions = useMemo(
    () => ({
      ...BASE_GOOGLE_MAP_OPTIONS,
      center: { lat: CDO_MAP_CENTER.lat, lng: CDO_MAP_CENTER.lng },
      zoom: 13
    }),
    []
  );

  useEffect(() => {
    let mounted = true;

    loadGoogleMaps(GOOGLE_MAPS_API_KEY)
      .then((google) => {
        if (!mounted || !mapContainerRef.current) return;
        const map = new google.maps.Map(mapContainerRef.current, mapOptions);
        mapInstanceRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        setMapReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        setMapError(err?.message || "Unable to load Live Fleet Map.");
      });

    return () => {
      mounted = false;
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
    };
  }, [mapOptions]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const google = window.google;
    if (!mapReady || !map || !google?.maps) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // 1. Official JICA Depot Pin
    const depotMarker = new google.maps.Marker({
      position: { lat: CDO_DEPOT.latitude, lng: CDO_DEPOT.longitude },
      map,
      title: CDO_DEPOT.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#004D40",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3
      },
      zIndex: 50
    });
    depotMarker.addListener("click", () => {
      infoWindowRef.current?.setContent(
        `<div style="font-family:sans-serif;padding:4px"><strong>${CDO_DEPOT.name}</strong><br/><span style="font-size:12px;color:#475569">${CDO_DEPOT.address}</span></div>`
      );
      infoWindowRef.current?.open(map, depotMarker);
    });
    markersRef.current.push(depotMarker);

    // 2. Delivery Hubs
    (locations || []).forEach(hub => {
      if (!Number.isFinite(hub.latitude) || !Number.isFinite(hub.longitude)) return;
      const hubMarker = new google.maps.Marker({
        position: { lat: hub.latitude, lng: hub.longitude },
        map,
        title: hub.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: "#0284c7",
          fillOpacity: 0.85,
          strokeColor: "#ffffff",
          strokeWeight: 2
        },
        zIndex: 20
      });
      hubMarker.addListener("click", () => {
        infoWindowRef.current?.setContent(
          `<div style="font-family:sans-serif;padding:4px"><strong>${hub.name}</strong><br/><span style="font-size:11px;color:#64748b">${hub.zone} • ${hub.address}</span></div>`
        );
        infoWindowRef.current?.open(map, hubMarker);
      });
      markersRef.current.push(hubMarker);
    });

    // 3. Live Fleet Trucks
    (telemetry || []).forEach(trk => {
      const lat = Number.isFinite(trk.latitude) ? trk.latitude : CDO_DEPOT.latitude;
      const lng = Number.isFinite(trk.longitude) ? trk.longitude : CDO_DEPOT.longitude;
      const isAlert = trk.status === "Alert" || Boolean(trk.sosAlert?.active);
      const isSelected = selectedTruckId && selectedTruckId === trk.truckId;

      const truckMarker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: `${trk.truckId} (${trk.truckPlate})`,
        label: {
          text: trk.truckId,
          color: "#ffffff",
          fontSize: "10px",
          fontWeight: "bold"
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 18 : 14,
          fillColor: isAlert ? "#dc2626" : trk.status === "Idle" ? "#64748b" : "#16a34a",
          fillOpacity: 1,
          strokeColor: isSelected ? "#facc15" : "#ffffff",
          strokeWeight: isSelected ? 4 : 2.5
        },
        zIndex: isAlert ? 200 : 100
      });

      truckMarker.addListener("click", () => {
        if (onSelectTruckRef.current) onSelectTruckRef.current(trk.truckId);
        infoWindowRef.current?.setContent(
          `<div style="font-family:sans-serif;padding:4px;min-width:170px">
            <strong>${trk.truckId} • ${trk.truckPlate}</strong><br/>
            <span style="font-size:12px">Driver: ${trk.driverName}</span><br/>
            <span style="font-size:12px">Status: <b>${trk.status}</b> (${trk.speedKmh} km/h)</span><br/>
            <span style="font-size:11px;color:#475569">Delivered: ${trk.deliveredSacks} / ${trk.loadedSacks} sacks</span>
          </div>`
        );
        infoWindowRef.current?.open(map, truckMarker);
      });

      markersRef.current.push(truckMarker);
    });
  }, [telemetry, locations, selectedTruckId, mapReady]);

  if (mapError) {
    return (
      <div className="h-[380px] sm:h-[460px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500">
        <MapPin className="w-8 h-8 text-slate-400 mb-2" />
        <p className="font-bold text-slate-700 dark:text-slate-200">{mapError}</p>
      </div>
    );
  }

  return (
    <div className="relative h-[380px] sm:h-[460px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shadow-xs">
      <div ref={mapContainerRef} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-900/80 text-xs font-bold text-slate-500">
          Initializing Cagayan de Oro Fleet Map...
        </div>
      )}
    </div>
  );
}

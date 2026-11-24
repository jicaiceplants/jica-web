"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import MetadataHeader from "@/components/LoadSlip/MetadataHeader";
import OrderTable from "@/components/LoadSlip/OrderTable";
import LoadSlipHistory from "@/components/LoadSlipHistory";
import Settings from "@/components/Settings";
import Invoices from "@/components/Invoices";
import EmployeeManagement from "@/components/EmployeeManagement";
import LiveFleetTracking from "@/components/LiveFleetTracking";
import AccountManagement from "@/components/AccountManagement";
import ShiftReconciliation from "@/components/ShiftReconciliation";
import TrashManagement from "@/components/TrashManagement";
import WebLogin from "@/components/WebLogin";
import { Sun, Moon, Sparkles, AlertTriangle, Siren, Send, X, MapPin, Truck, User, Clock, CheckCircle2 } from "lucide-react";
import { DataService } from "@/lib/dataService";
import { TruckVehicle, UserAccount } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Web Audio API emergency alarm generator (alternating 880Hz / 1200Hz siren)
class AudioAlarmService {
  private ctx: AudioContext | null = null;
  private timer: any = null;
  private isPlaying = false;

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      let high = false;
      this.beep(880);
      this.timer = setInterval(() => {
        high = !high;
        this.beep(high ? 1200 : 880);
      }, 700);
    } catch (e) {
      console.warn("Audio alarm warning:", e);
    }
  }

  private beep(freq: number) {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (_) { }
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (_) { }
      this.ctx = null;
    }
  }
}

const audioAlarm = new AudioAlarmService();

interface ActiveSosAlert {
  id: string;
  idempotency_key?: string;
  load_slip_id?: string;
  driver_id?: string;
  truck_id: string;
  latitude: number;
  longitude: number;
  reason: string;
  status: "Active" | "Acknowledged";
  created_at: string;
  dispatcher_reply?: string;
  acknowledged_by?: string;
}

export default function DispatchDashboard() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState("Load Slip");
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Metadata state for today's load slip
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [selectedInChargeId, setSelectedInChargeId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const [trucks, setTrucks] = useState<TruckVehicle[]>([]);
  const [staffList, setStaffList] = useState<UserAccount[]>([]);
  const [driversList, setDriversList] = useState<UserAccount[]>([]);

  // Emergency SOS Alert State
  const [activeSosModal, setActiveSosModal] = useState<ActiveSosAlert | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [dispatcherReplyNote, setDispatcherReplyNote] = useState("Help is on the Way: Support vehicle & mechanic en route to your coordinates.");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [ackFeedback, setAckFeedback] = useState<string | null>(null);

  // 1. Session Persistence & Authentication (24-hour expiration)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("jica_web_session");
      if (raw) {
        const session = JSON.parse(raw);
        if (session && session.user && session.expiresAt && Date.now() < session.expiresAt) {
          if (session.user.role === "Owner" || session.user.role === "Staff") {
            setCurrentUser(session.user);
            DataService.setCurrentUser(session.user);
          } else {
            localStorage.removeItem("jica_web_session");
            setCurrentUser(null);
          }
        } else {
          localStorage.removeItem("jica_web_session");
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.warn("Session check error:", e);
      setCurrentUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  const handleLogout = () => {
    audioAlarm.stop();
    localStorage.removeItem("jica_web_session");
    setCurrentUser(null);
  };

  // 2. Load Core Data & Live Supabase Sync
  useEffect(() => {
    if (!currentUser) return;

    const now = new Date();
    setCurrentDate(now.toISOString().split("T")[0]);
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    setCurrentTime(`${hours}:${minutes}`);

    const t = DataService.getTrucks();
    const s = DataService.getStaff();
    const d = DataService.getDrivers();

    setTrucks(t);
    setStaffList(s);
    setDriversList(d);

    if (t.length > 0) setSelectedTruckId(t[0].id);
    if (s.length > 0) setSelectedInChargeId(s[0].id);
    if (d.length > 0) setSelectedDriverId(d[0].id);

    // Sync live from Supabase PostgreSQL on mount
    DataService.fetchLiveFromSupabase().then(() => {
      const freshTrucks = DataService.getTrucks();
      const freshStaff = DataService.getStaff();
      const freshDrivers = DataService.getDrivers();
      setTrucks(freshTrucks);
      setStaffList(freshStaff);
      setDriversList(freshDrivers);
      if (freshTrucks.length > 0 && !selectedTruckId) setSelectedTruckId(freshTrucks[0].id);
      if (freshStaff.length > 0 && !selectedInChargeId) setSelectedInChargeId(freshStaff[0].id);
      if (freshDrivers.length > 0 && !selectedDriverId) setSelectedDriverId(freshDrivers[0].id);
    });
  }, [currentUser]);

  // 3. Global Audible Emergency SOS Alert Poller (every 3 seconds)
  useEffect(() => {
    if (!currentUser) return;

    const checkSosAlerts = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/telemetry/sos/active`);
        if (res.ok) {
          const data = await res.json();
          const alerts: ActiveSosAlert[] = data.alerts || [];
          const activeUnack = alerts.find(a => a.status === "Active" && !dismissedAlertIds.has(a.id));

          if (activeUnack) {
            setActiveSosModal(activeUnack);
            audioAlarm.start();
          } else if (activeSosModal && !alerts.find(a => a.id === activeSosModal.id && a.status === "Active")) {
            // Alert was resolved/acknowledged elsewhere
            audioAlarm.stop();
            setActiveSosModal(null);
          }
        }
      } catch (err) {
        // Silent catch for background poller
      }
    };

    checkSosAlerts();
    const interval = setInterval(checkSosAlerts, 3000);
    return () => {
      clearInterval(interval);
      audioAlarm.stop();
    };
  }, [currentUser, dismissedAlertIds, activeSosModal]);

  const handleDismissSos = () => {
    audioAlarm.stop();
    if (activeSosModal) {
      setDismissedAlertIds(prev => new Set(prev).add(activeSosModal.id));
    }
    setActiveSosModal(null);
  };

  const handleViewOnFleetMap = () => {
    audioAlarm.stop();
    setActiveTab("Live Fleet Tracking");
    setActiveSosModal(null);
  };

  const handleAcknowledgeSos = async () => {
    if (!activeSosModal) return;
    setIsSendingReply(true);

    try {
      const replyMsg = dispatcherReplyNote.trim() || "Help is on the Way: Mechanic dispatch en route to your coordinates.";
      const ackBy = currentUser?.name || "Office Dispatcher";

      const res = await fetch(`${BACKEND_URL}/api/v1/telemetry/sos/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: activeSosModal.id,
          dispatcher_reply: replyMsg,
          acknowledged_by: ackBy
        })
      });

      audioAlarm.stop();

      if (res.ok) {
        setAckFeedback("Reply broadcasted! Driver has been notified.");
        setTimeout(() => {
          setActiveSosModal(null);
          setAckFeedback(null);
        }, 1800);
      } else {
        setActiveSosModal(null);
      }
    } catch (e) {
      audioAlarm.stop();
      setActiveSosModal(null);
    } finally {
      setIsSendingReply(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "Load Slip":
        return (
          <>
            <MetadataHeader
              currentDate={currentDate}
              currentTime={currentTime}
              selectedTruckId={selectedTruckId}
              onTruckChange={setSelectedTruckId}
              selectedInChargeId={selectedInChargeId}
              onInChargeChange={setSelectedInChargeId}
              selectedDriverId={selectedDriverId}
              onDriverChange={setSelectedDriverId}
              trucks={trucks}
              staffList={staffList}
              driversList={driversList}
            />
            <OrderTable
              currentDate={currentDate}
              currentTime={currentTime}
              truckId={selectedTruckId}
              inChargeId={selectedInChargeId}
              driverId={selectedDriverId}
              onSavedSuccess={(slip) => {
                // Keep staff on page with notification
              }}
            />
          </>
        );
      case "Load Slip History":
        return <LoadSlipHistory />;
      case "Live Fleet Tracking":
        return <LiveFleetTracking />;
      case "Shift Closing":
        return <ShiftReconciliation />;
      case "User & Passwords":
        return <AccountManagement />;
      case "Employee Management":
        return <EmployeeManagement />;
      case "Invoices":
        return <Invoices />;
      case "Settings":
        return <Settings />;
      case "Trash":
        return <TrashManagement />;
      default:
        return (
          <>
            <MetadataHeader
              currentDate={currentDate}
              currentTime={currentTime}
              selectedTruckId={selectedTruckId}
              onTruckChange={setSelectedTruckId}
              selectedInChargeId={selectedInChargeId}
              onInChargeChange={setSelectedInChargeId}
              selectedDriverId={selectedDriverId}
              onDriverChange={setSelectedDriverId}
              trucks={trucks}
              staffList={staffList}
              driversList={driversList}
            />
            <OrderTable
              currentDate={currentDate}
              currentTime={currentTime}
              truckId={selectedTruckId}
              inChargeId={selectedInChargeId}
              driverId={selectedDriverId}
            />
          </>
        );
    }
  };

  const tabTitles: Record<string, { title: string; subtitle: string }> = {
    "Load Slip": { title: "Digital Load Slip Builder", subtitle: "Build and dispatch daily ice deliveries for Cagayan de Oro routes" },
    "Load Slip History": { title: "Load Slip History & Archive", subtitle: "Audit past deliveries, cash collections, and partial sack adjustments" },
    "Live Fleet Tracking": { title: "Live Fleet & Driver Corridor", subtitle: "Real-time truck locations, delivered sacks, and roadside SOS alerts" },
    "Shift Closing": { title: "End-of-Day Truck Shift Closing", subtitle: "Reconcile delivered sacks, returned cold storage inventory, and remitted cash collection" },
    "User & Passwords": { title: "User & Password Management", subtitle: "Reset passwords and administer driver and dispatcher mobile credentials" },
    "Employee Management": { title: "Employee Roster", subtitle: "Manage staff accounts, phone contacts, and assigned roles" },
    "Invoices": { title: "Invoices & Official Receipts", subtitle: "Review cash receipts and formal charge invoices for institutional accounts" },
    "Settings": { title: "Settings & Pricing", subtitle: "Configure wholesale ice rates and manage Cagayan de Oro delivery location hubs" }
  };

  if (isAuthChecking) {
    return (
      <div className="h-screen w-full bg-[#004D40] flex flex-col items-center justify-center text-white">
        <img src="/jica-logo.png" alt="JICA Logo" className="w-24 h-auto animate-pulse mb-4" />
        <p className="text-sm font-bold tracking-widest uppercase text-emerald-200">
          Loading JICA Dispatch Portal...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <WebLogin onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const headerInfo = tabTitles[activeTab] || { title: activeTab, subtitle: "Manage your ice logistics system" };

  return (
    <div className={`${isDarkMode ? "dark" : ""} flex h-screen w-full bg-slate-100 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-transparent overflow-y-auto relative">
        <header className="p-8 pb-5 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md z-20 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {headerInfo.title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
              {headerInfo.subtitle}
            </p>
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            title="Toggle Light/Dark Theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
        </header>

        <div className="p-8 flex-1 max-w-[1450px] w-full mx-auto space-y-8">
          {renderContent()}
        </div>
      </main>

      {/* GLOBAL AUDIBLE EMERGENCY SOS ALERT MODAL */}
      {activeSosModal && (
        <div className="fixed inset-0 z-50 bg-red-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-4 border-red-600 shadow-2xl max-w-xl w-full p-6 sm:p-8 relative overflow-hidden">
            {/* Top Siren Animation Stripe */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

            <div className="flex justify-between items-start pt-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg animate-bounce">
                  <Siren className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-600 text-white text-[11px] font-black uppercase rounded-full tracking-wider animate-pulse">
                      CRITICAL ALERT
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {new Date(activeSosModal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                    Emergency Roadside SOS!
                  </h2>
                </div>
              </div>

              <button
                onClick={handleDismissSos}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Mute & Dismiss Alarm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Breakdown & Telemetry Details */}
            <div className="mt-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-red-200/60 dark:border-red-900/60 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Breakdown Reason
                </span>
                <span className="text-sm font-black text-red-700 dark:text-red-300 px-3 py-1 bg-red-200/60 dark:bg-red-900/60 rounded-xl">
                  {activeSosModal.reason}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-red-600 shrink-0" />
                  <div>
                    <span className="text-slate-500 block">Truck Vehicle</span>
                    <strong className="text-slate-900 dark:text-white font-bold">{activeSosModal.truck_id}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-red-600 shrink-0" />
                  <div>
                    <span className="text-slate-500 block">Driver ID</span>
                    <strong className="text-slate-900 dark:text-white font-bold truncate max-w-[140px] block">{activeSosModal.driver_id || "Mobile Driver"}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs">
                <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 font-mono">
                  Coordinates: <strong>{activeSosModal.latitude?.toFixed(5)}, {activeSosModal.longitude?.toFixed(5)}</strong>
                </span>
              </div>
            </div>

            {/* Dispatcher Response Action */}
            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Send Dispatcher Feedback to Driver ("Help is on the Way")
              </label>
              <textarea
                rows={2}
                value={dispatcherReplyNote}
                onChange={(e) => setDispatcherReplyNote(e.target.value)}
                placeholder="Type response to driver..."
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />

              {ackFeedback && (
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{ackFeedback}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  onClick={handleAcknowledgeSos}
                  disabled={isSendingReply}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingReply ? "Broadcasting..." : "Broadcast: Help is on the Way"}</span>
                </button>

                <button
                  onClick={handleViewOnFleetMap}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapPin className="w-4 h-4" />
                  <span>View on Fleet Map</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

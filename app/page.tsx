"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Sun, Moon, Siren, Send, X, MapPin, Truck, User, CheckCircle2, Menu } from "lucide-react";
import { DataService } from "@/lib/dataService";
import { TruckVehicle, UserAccount } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { getManilaDateString, getManilaTimeString, formatManilaDateTime } from "@/lib/dateUtils";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://jica-backend-production.up.railway.app")
  .replace(/\/+$/, "")
  .trim();

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
    } catch {
      // ignore autoplay blocks
    }
  }

  private beep(freq: number) {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === "suspended") this.ctx.resume();
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
    } catch { }
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
      } catch { }
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
  driver_name?: string;
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
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("Load Slip");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Manila date/time for Load Slip
  const [currentDate, setCurrentDate] = useState(() => getManilaDateString());
  const [currentTime, setCurrentTime] = useState(() => getManilaTimeString());
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const [trucks, setTrucks] = useState<TruckVehicle[]>([]);
  const [driversList, setDriversList] = useState<UserAccount[]>([]);

  // Emergency SOS Alert State
  const [activeSosModal, setActiveSosModal] = useState<ActiveSosAlert | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [dispatcherReplyNote, setDispatcherReplyNote] = useState(
    "Help is on the Way: Support vehicle & mechanic en route to your coordinates."
  );
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [ackFeedback, setAckFeedback] = useState<string | null>(null);

  const activeSosRef = useRef<ActiveSosAlert | null>(null);
  activeSosRef.current = activeSosModal;

  const forceLogout = useCallback((reason?: string) => {
    audioAlarm.stop();
    DataService.clearSession();
    setCurrentUser(null);
    setSessionNotice(
      reason || "You have been logged out because this account was signed in on another device."
    );
  }, []);

  // Register global 401 SESSION_REVOKED interceptor
  useEffect(() => {
    DataService.setSessionRevokedHandler((reason) => {
      forceLogout(reason);
    });
    return () => DataService.setSessionRevokedHandler(null);
  }, [forceLogout]);

  // 1. Initial Session Verification
  useEffect(() => {
    const restoreAndVerifySession = async () => {
      try {
        const raw = localStorage.getItem("jica_web_session");
        if (!raw) {
          setCurrentUser(null);
          return;
        }
        const session = JSON.parse(raw);
        if (
          session?.user &&
          session?.sessionToken &&
          session?.expiresAt &&
          Date.now() < session.expiresAt &&
          (session.user.role === "Owner" || session.user.role === "Staff")
        ) {
          DataService.setCurrentUser(session.user);
          const check = await DataService.validateActiveSession();
          if (check.valid) {
            setCurrentUser(session.user);
            setSessionNotice(null);
          } else {
            DataService.clearSession();
            setCurrentUser(null);
            setSessionNotice(check.reason || "Session signed out from another device.");
          }
        } else {
          DataService.clearSession();
          setCurrentUser(null);
        }
      } catch {
        DataService.clearSession();
        setCurrentUser(null);
      } finally {
        setIsAuthChecking(false);
      }
    };

    restoreAndVerifySession();
  }, []);

  // 2. Strict Single Active Session Guard (Supabase Realtime + 5s Polling)
  useEffect(() => {
    if (!currentUser?.id) return;
    const localToken = DataService.getSessionToken();
    if (!localToken) {
      forceLogout("Missing active session token. Please sign in again.");
      return;
    }

    const channel = supabase
      .channel(`web-session-guard-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_accounts",
          filter: `id=eq.${currentUser.id}`
        },
        (payload: any) => {
          const remoteToken = payload?.new?.active_session_token;
          const isActive = payload?.new?.is_active;
          const deletedAt = payload?.new?.deleted_at;

          if (isActive === false || deletedAt) {
            forceLogout("Your account has been deactivated.");
            return;
          }
          if (remoteToken !== localToken) {
            forceLogout("You have been logged out because this account was signed in on another device.");
          }
        }
      )
      .subscribe();

    const pollInterval = setInterval(async () => {
      const check = await DataService.validateActiveSession();
      if (!check.valid) {
        forceLogout(check.reason);
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, forceLogout]);

  const handleLogout = async () => {
    audioAlarm.stop();
    await DataService.logoutUser();
    setSessionNotice(null);
    setCurrentUser(null);
  };

  // Keep Manila clock ticking cleanly every 30s
  useEffect(() => {
    const syncManilaClock = () => {
      setCurrentDate(getManilaDateString());
      setCurrentTime(getManilaTimeString());
    };
    syncManilaClock();
    const timer = setInterval(syncManilaClock, 30000);
    return () => clearInterval(timer);
  }, []);

  const refreshReferenceData = useCallback(async () => {
    await DataService.fetchLiveFromSupabase();
    const freshTrucks = DataService.getTrucks();
    const freshDrivers = DataService.getDrivers();
    setTrucks(freshTrucks);
    setDriversList(freshDrivers);

    setSelectedTruckId(prev =>
      freshTrucks.some(t => t.id === prev) ? prev : freshTrucks[0]?.id || ""
    );
    setSelectedDriverId(prev =>
      freshDrivers.some(d => d.id === prev) ? prev : freshDrivers[0]?.id || ""
    );
  }, []);

  // 3. Load Core Data & Live Supabase Sync on Login / Tab switch
  useEffect(() => {
    if (!currentUser) return;
    setTrucks(DataService.getTrucks());
    setDriversList(DataService.getDrivers());
    refreshReferenceData();
  }, [currentUser, activeTab, refreshReferenceData]);

  // 4. Global Audible Emergency SOS Alert Poller (every 4 seconds)
  useEffect(() => {
    if (!currentUser) return;

    const checkSosAlerts = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/telemetry/sos/active`);
        if (res.ok) {
          const data = await res.json();
          const alerts: ActiveSosAlert[] = (data.alerts || []).filter((a: any) => {
            const st = String(a?.status || "").toUpperCase();
            return st !== "RESOLVED" && st !== "DISMISSED";
          });
          const activeUnack = alerts.find(a => a.status === "Active" && !dismissedAlertIds.has(a.id));

          if (activeUnack) {
            setActiveSosModal(activeUnack);
            audioAlarm.start();
          } else if (
            activeSosRef.current &&
            !alerts.find(a => a.id === activeSosRef.current?.id && a.status === "Active")
          ) {
            audioAlarm.stop();
            setActiveSosModal(null);
          }
        }
      } catch {
        // silent catch
      }
    };

    checkSosAlerts();
    const interval = setInterval(checkSosAlerts, 4000);
    return () => {
      clearInterval(interval);
      audioAlarm.stop();
    };
  }, [currentUser, dismissedAlertIds]);

  const handleDismissSos = () => {
    audioAlarm.stop();
    if (activeSosModal) {
      setDismissedAlertIds(prev => new Set(prev).add(activeSosModal.id));
    }
    setActiveSosModal(null);
  };

  const handleResolveSos = async () => {
    if (!activeSosModal) return;
    setIsSendingReply(true);
    try {
      await fetch(`${BACKEND_URL}/api/v1/telemetry/sos/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: activeSosModal.id,
          idempotency_key: activeSosModal.id,
          driver_id: activeSosModal.driver_id,
          truck_id: activeSosModal.truck_id,
          resolved_by: currentUser?.name || "Office Dispatcher"
        })
      });
    } catch {
      // silent catch
    } finally {
      audioAlarm.stop();
      setDismissedAlertIds(prev => new Set(prev).add(activeSosModal.id));
      setActiveSosModal(null);
      setIsSendingReply(false);
    }
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
      const replyMsg =
        dispatcherReplyNote.trim() || "Help is on the Way: Support vehicle & mechanic en route to your coordinates.";
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
    } catch {
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
              selectedDriverId={selectedDriverId}
              onDriverChange={setSelectedDriverId}
              trucks={trucks}
              driversList={driversList}
              currentUser={currentUser!}
            />
            <OrderTable
              currentDate={currentDate}
              currentTime={currentTime}
              truckId={selectedTruckId}
              driverId={selectedDriverId}
              currentUser={currentUser!}
              onSavedSuccess={() => {
                refreshReferenceData();
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
        return null;
    }
  };

  const tabTitles: Record<string, { title: string; subtitle: string }> = {
    "Load Slip": {
      title: "Digital Load Slip Builder",
      subtitle: "Build and dispatch daily ice deliveries for Cagayan de Oro routes (Asia/Manila)"
    },
    "Load Slip History": {
      title: "Load Slip History & Archive",
      subtitle: "Audit past deliveries, cash collections, and partial sack adjustments"
    },
    "Live Fleet Tracking": {
      title: "Live Fleet & Driver Corridor",
      subtitle: "Real-time truck locations, delivered sacks, and roadside SOS alerts"
    },
    "Shift Closing": {
      title: "End-of-Day Truck Shift Closing",
      subtitle: "Confirm finished deliveries, cash safe remittances, and returned ice sacks"
    },
    "User & Passwords": {
      title: "User & Password Management",
      subtitle: "Reset passwords and manage driver and dispatcher credentials"
    },
    "Employee Management": {
      title: "Employee Roster",
      subtitle: "Manage staff accounts, phone contacts, and assigned roles"
    },
    Invoices: {
      title: "Invoices & Official Receipts",
      subtitle: "Review sales receipts and charge invoices linked cleanly to load slips"
    },
    Settings: {
      title: "Settings & Pricing",
      subtitle: "Configure wholesale ice rates, fleet capacities, and Cagayan de Oro delivery hubs"
    },
    Trash: {
      title: "Trash & 30-Day Recovery",
      subtitle: "Restore soft-deleted records or purge historical items (Owner only)"
    }
  };

  if (isAuthChecking) {
    return (
      <div className="h-dvh w-full bg-[#004D40] flex flex-col items-center justify-center text-white p-6">
        <img src="/jica-logo.png" alt="JICA Logo" className="w-24 h-auto animate-pulse mb-4" />
        <p className="text-sm font-bold tracking-widest uppercase text-emerald-200 text-center">
          Verifying Session & Loading Dispatch Portal...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <WebLogin
        sessionNotice={sessionNotice}
        onLoginSuccess={(user) => {
          setSessionNotice(null);
          setCurrentUser(user);
        }}
      />
    );
  }

  const headerInfo = tabTitles[activeTab] || { title: activeTab, subtitle: "Manage your ice logistics system" };

  return (
    <div
      className={`${
        isDarkMode ? "dark" : ""
      } flex h-dvh w-full bg-slate-100 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200`}
    >
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full bg-transparent overflow-y-auto scroll-touch relative min-w-0">
        <header className="p-4 sm:p-6 lg:p-8 pb-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md z-20 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open Menu"
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-xs shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                {headerInfo.title}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-xs sm:text-sm font-medium truncate">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer shrink-0 flex items-center justify-center"
            title="Toggle Light/Dark Theme"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 flex-1 max-w-[1450px] w-full mx-auto space-y-6">
          {renderContent()}
        </div>
      </main>

      {/* GLOBAL AUDIBLE EMERGENCY SOS ALERT MODAL */}
      {activeSosModal && (
        <div className="fixed inset-0 z-[70] bg-red-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-4 border-red-600 shadow-2xl max-w-xl w-full p-6 sm:p-8 relative overflow-hidden max-h-[90dvh] overflow-y-auto">
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
                      {formatManilaDateTime(activeSosModal.created_at)}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                    Emergency Roadside SOS!
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismissSos}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Mute & Dismiss Alarm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

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
                    <span className="text-slate-500 block">Driver</span>
                    <strong className="text-slate-900 dark:text-white font-bold truncate max-w-[140px] block">
                      {activeSosModal.driver_name || activeSosModal.driver_id || "Mobile Driver"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs">
                <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 font-mono">
                  Coordinates:{" "}
                  <strong>
                    {activeSosModal.latitude?.toFixed(5)}, {activeSosModal.longitude?.toFixed(5)}
                  </strong>
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Send Dispatcher Feedback to Driver (&quot;Help is on the Way&quot;)
              </label>
              <textarea
                rows={2}
                value={dispatcherReplyNote}
                onChange={(e) => setDispatcherReplyNote(e.target.value)}
                placeholder="Type response to driver..."
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />

              {ackFeedback && (
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{ackFeedback}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleAcknowledgeSos}
                  disabled={isSendingReply}
                  className="flex-1 min-h-[44px] py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingReply ? "Broadcasting..." : "Broadcast: Help is on the Way"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleViewOnFleetMap}
                  className="min-h-[44px] py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapPin className="w-4 h-4" />
                  <span>View on Fleet Map</span>
                </button>

                <button
                  type="button"
                  onClick={handleResolveSos}
                  disabled={isSendingReply}
                  className="min-h-[44px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Resolved</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

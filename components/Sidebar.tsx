"use client";

import { FileText, CreditCard, Settings, Users, Map, History, KeyRound, RotateCcw, Trash2, LogOut, X } from "lucide-react";
import { UserAccount } from "@/lib/types";

type SidebarProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
};

const NavItem = ({
  icon,
  label,
  active,
  onClick,
  badge
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full min-h-[44px] flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${active
          ? "bg-yellow-400 text-emerald-950 shadow-md hover:brightness-105"
          : "text-emerald-50 hover:bg-white/10 active:bg-white/20"
        }`}
    >
      <div className="flex items-center gap-3">
        <span className={active ? "opacity-100" : "opacity-80"}>{icon}</span>
        <span>{label}</span>
      </div>
      {badge && (
        <span
          className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${active ? "bg-emerald-950 text-yellow-400" : "bg-white/20 text-white"
            }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
};

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  isOpen = false,
  onClose
}: SidebarProps) {
  const handleSelect = (tab: string) => {
    setActiveTab(tab);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile / iPad Backdrop Drawer Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#00875A] dark:bg-emerald-950 text-white flex flex-col shadow-2xl shrink-0 h-dvh overflow-y-auto scroll-touch border-r border-emerald-800 transform transition-transform duration-200 lg:static lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="p-6 flex flex-col items-center justify-center border-b border-white/10 gap-3 relative">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Navigation Menu"
              className="lg:hidden absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-emerald-100 hover:bg-white/15"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <img
            src="/jica-logo.png"
            alt="JICA Ice Logistics Logo"
            className="w-24 sm:w-28 h-auto object-contain"
          />
          <div className="text-center">
            <h2 className="text-xl font-black tracking-wider text-yellow-400 uppercase drop-shadow-md">
              J.I.C.A ICE LOGISTICS
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200 block mt-0.5">
              CDO Logistics & Dispatch
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-1.5">
          <div className="pb-2">
            <p className="text-[11px] font-black text-emerald-300 uppercase tracking-widest px-3">
              Dispatch Operations
            </p>
          </div>

          <NavItem
            icon={<FileText className="w-5 h-5" />}
            label="Digital Load Slip"
            active={activeTab === "Load Slip"}
            onClick={() => handleSelect("Load Slip")}
          />
          <NavItem
            icon={<History className="w-5 h-5" />}
            label="Load Slip History"
            active={activeTab === "Load Slip History"}
            onClick={() => handleSelect("Load Slip History")}
            badge="Archive"
          />
          <NavItem
            icon={<Map className="w-5 h-5" />}
            label="Live Fleet Tracking"
            active={activeTab === "Live Fleet Tracking"}
            onClick={() => handleSelect("Live Fleet Tracking")}
          />
          <NavItem
            icon={<RotateCcw className="w-5 h-5" />}
            label="Shift Closing & Remit"
            active={activeTab === "Shift Closing"}
            onClick={() => handleSelect("Shift Closing")}
          />
          <NavItem
            icon={<CreditCard className="w-5 h-5" />}
            label="Invoices & Receipts"
            active={activeTab === "Invoices"}
            onClick={() => handleSelect("Invoices")}
          />

          <div className="pt-5 pb-2">
            <p className="text-[11px] font-black text-emerald-300 uppercase tracking-widest px-3">
              Administration
            </p>
          </div>

          <NavItem
            icon={<KeyRound className="w-5 h-5" />}
            label="User & Passwords"
            active={activeTab === "User & Passwords"}
            onClick={() => handleSelect("User & Passwords")}
          />
          <NavItem
            icon={<Users className="w-5 h-5" />}
            label="Employee Roster"
            active={activeTab === "Employee Management"}
            onClick={() => handleSelect("Employee Management")}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings & Pricing"
            active={activeTab === "Settings"}
            onClick={() => handleSelect("Settings")}
          />
          <NavItem
            icon={<Trash2 className="w-5 h-5" />}
            label="Trash / Deleted"
            active={activeTab === "Trash"}
            onClick={() => handleSelect("Trash")}
            badge="30d"
          />
        </nav>

        {currentUser && (
          <div className="p-3.5 mx-3 mb-2 rounded-2xl bg-black/20 border border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-yellow-400 text-emerald-950 font-black flex items-center justify-center shrink-0 overflow-hidden text-sm shadow-inner">
                {currentUser.photoUrl ? (
                  <img src={currentUser.photoUrl} alt={currentUser.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser.name ? currentUser.name.charAt(0) : "U"}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {currentUser.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-yellow-400/90 text-emerald-950 rounded">
                    {currentUser.role}
                  </span>
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Log Out"
                aria-label="Log Out"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-emerald-200 hover:text-white hover:bg-white/15 transition-all shrink-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="p-4 border-t border-white/10 text-center">
          <span className="text-[11px] text-emerald-300 block font-medium">
            #69 Old Road Gusa, CDOC 9000
          </span>
          <span className="text-[10px] text-emerald-400/80 block mt-0.5">
            IceTrack v1.0 • Asia/Manila (UTC+8)
          </span>
        </div>
      </aside>
    </>
  );
}

"use client";

import { useState } from "react";
import { ShieldCheck, FileText, MapPin, X, CheckCircle2 } from "lucide-react";

interface ComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "privacy" | "terms" | "gps";
}

export default function ComplianceModal({
  isOpen,
  onClose,
  defaultTab = "privacy"
}: ComplianceModalProps) {
  const [tab, setTab] = useState<"privacy" | "terms" | "gps">(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#00875A]" />
              Internal Workforce Compliance & Policies
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              JICA Ice Logistics and Delivery • Philippine Data Privacy Act (RA 10173)
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-900/50 p-2 gap-2">
          <button
            onClick={() => setTab("privacy")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === "privacy"
                ? "bg-white dark:bg-slate-800 text-[#00875A] dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            Privacy Notice
          </button>
          <button
            onClick={() => setTab("terms")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === "terms"
                ? "bg-white dark:bg-slate-800 text-[#00875A] dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Terms of Use
          </button>
          <button
            onClick={() => setTab("gps")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tab === "gps"
                ? "bg-white dark:bg-slate-800 text-[#00875A] dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50"
            }`}
          >
            <MapPin className="w-4 h-4" />
            Shift-Only GPS Consent
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {tab === "privacy" && (
            <div className="space-y-3">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Internal Employee Privacy Notice (RA 10173)
              </h4>
              <p>
                JICA Ice Logistics (&quot;Company&quot;) operates IceTrack strictly for internal delivery operations, fleet tracking, load reconciliation, and safety. This notice informs staff and drivers of personal data processing under the Philippine Data Privacy Act of 2012.
              </p>
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white">1. Data Collected:</p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>Full Name, Assigned Truck Plate, Mobile Number, and Role.</li>
                  <li>Real-time GPS coordinates collected <strong>strictly while on an active delivery route</strong>.</li>
                  <li>Delivery transaction confirmations and payment collections (Cash/Charge Invoices).</li>
                </ul>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">2. Purpose of Processing:</p>
              <p className="text-xs">
                To route ice trucks efficiently across Cagayan de Oro (Gusa to Uptown corridor), prevent product melting/deterioration, dispatch immediate roadside assistance during breakdowns, and accurately audit daily cash and invoice remittances.
              </p>
              <p className="font-semibold text-slate-900 dark:text-white">3. Data Retention:</p>
              <p className="text-xs">
                Raw GPS logs are automatically pruned after six (6) months. Financial records and Load Slips are retained for company tax and accounting auditing.
              </p>
            </div>
          )}

          {tab === "terms" && (
            <div className="space-y-3">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Internal Workforce Acceptable Use Policy
              </h4>
              <p>
                Access to the JICA IceTrack Web Dispatcher and Driver Mobile Application is restricted to authorized employees, drivers, and management of JICA Ice Logistics.
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <p className="font-bold">Key Operational Responsibilities:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Drivers must verify actual delivered sack quantities with the store receiver before tapping &quot;Confirm Paid&quot;.</li>
                  <li>Any partial deliveries or damaged/melted sacks must be documented with the accurate reason in the mobile app.</li>
                  <li>Emergency SOS alerts must be triggered only for genuine vehicle breakdowns, flat tires, or accidents.</li>
                  <li>Login credentials must not be shared with outside parties or unauthorized personnel.</li>
                </ul>
              </div>
            </div>
          )}

          {tab === "gps" && (
            <div className="space-y-3">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Driver Shift-Only GPS Telemetry Consent
              </h4>
              <p>
                To provide live fastest route recommendations and dispatch rescue teams in case of breakdowns, IceTrack tracks your vehicle location while your shift route is active.
              </p>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#00875A]" />
                  <span>Your Privacy Safeguards:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Shift-Only Tracking:</strong> GPS tracking occurs only between the time you start your route and complete your delivery run. It automatically stops when your shift ends.</li>
                  <li><strong>Battery & Data Optimized:</strong> Telemetry uses a 15-meter spatial movement filter, minimizing mobile data and battery drain.</li>
                  <li><strong>Zero External Sharing:</strong> Your location is visible strictly on the JICA Gusa office dispatcher console.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#00875A] text-white font-bold rounded-xl text-sm hover:brightness-110 transition-all shadow-md"
          >
            I Acknowledge & Understand
          </button>
        </div>
      </div>
    </div>
  );
}

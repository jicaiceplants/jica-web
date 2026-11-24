"use client";

import { useEffect } from "react";
import Image from "next/image";
import { RotateCcw, AlertTriangle, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard caught client error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl p-8 flex flex-col items-center">
        {/* JICA Branded Logo */}
        <div className="w-24 h-24 relative mb-6 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 p-2 bg-white">
          <Image
            src="/jica-logo.png"
            alt="JICA Ice Logistics Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-black uppercase tracking-wider mb-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          System Notice
        </div>

        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Something Interrupted Dispatch
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {error.message || "An unexpected application state occurred while processing manifest or fleet telemetry."}
        </p>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#00875A] hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-900/20 hover:shadow-xl transition-all text-sm uppercase tracking-wider"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again / Recover
          </button>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold rounded-xl text-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            Reload Dispatch Dashboard
          </Link>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-6 font-medium">
        JICA Ice Logistics & Delivery • Cagayan de Oro City
      </p>
    </div>
  );
}

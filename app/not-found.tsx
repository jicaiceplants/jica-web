import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Home, Compass } from "lucide-react";

export default function NotFound() {
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

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#00875A] dark:text-emerald-300 text-xs font-black uppercase tracking-wider mb-3">
          <Compass className="w-3.5 h-3.5" />
          Page Route Not Found (404)
        </div>

        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
          Lost Along the Route?
        </h1>
        
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
          The dispatch dashboard page or manifest link you are looking for does not exist or has been relocated within JICA Ice Logistics.
        </p>

        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#00875A] hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-900/20 hover:shadow-xl transition-all text-sm uppercase tracking-wider"
        >
          <Home className="w-4 h-4" />
          Return to Dispatch Dashboard
        </Link>
      </div>

      <p className="text-xs text-slate-400 mt-6 font-medium">
        JICA Ice Logistics & Delivery • Cagayan de Oro City
      </p>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

interface ComboBoxOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface ComboBoxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboBoxOption[];
  placeholder?: string;
  disabled?: boolean;
}

export default function ComboBox({
  label,
  value,
  onChange,
  options,
  placeholder = "Select or search...",
  disabled = false
}: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-1.5 relative" ref={dropdownRef}>
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 text-left bg-white dark:bg-slate-800 border-2 rounded-xl flex items-center justify-between text-base font-medium transition-all ${
          isOpen 
            ? "border-[#00875A] ring-2 ring-emerald-500/20" 
            : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900" : "cursor-pointer"}`}
      >
        <span className={selectedOption ? "text-slate-900 dark:text-white font-bold" : "text-slate-400 font-normal"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50">
            <Search className="w-4 h-4 text-slate-400 ml-1" />
            <input
              type="text"
              className="w-full bg-transparent text-sm py-1 focus:outline-none text-slate-900 dark:text-white"
              placeholder="Filter names or plates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-700/50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full px-3 py-2.5 text-left rounded-lg flex items-center justify-between text-sm transition-colors ${
                    opt.value === value
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-[#00875A] dark:text-emerald-400 font-bold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.subLabel && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                        {opt.subLabel}
                      </span>
                    )}
                  </div>
                  {opt.value === value && <Check className="w-4 h-4 text-[#00875A]" />}
                </button>
              ))
            ) : (
              <div className="p-3 text-center text-xs text-slate-400">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

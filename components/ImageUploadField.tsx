"use client";

import React, { useRef, useState } from "react";
import { Upload, Trash2, Loader2, Camera, AlertCircle } from "lucide-react";
import {
  uploadOptimizedImage,
  deleteStorageImage,
  ImageAssetFolder
} from "@/lib/imageUpload";

interface ImageUploadFieldProps {
  label: string;
  folder: ImageAssetFolder;
  value?: string;
  onChange: (newUrl: string) => void;
  onTempUploadCreated?: (tempUrl: string) => void;
  fallbackIcon: React.ReactNode;
  shape?: "square" | "circle";
}

export function ImageUploadField({
  label,
  folder,
  value,
  onChange,
  onTempUploadCreated,
  fallbackIcon,
  shape = "square"
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always reset value so picking the same image twice triggers onChange on iPad Safari
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);
    setStatusNote(null);

    try {
      const { publicUrl, bytes } = await uploadOptimizedImage(file, folder);
      if (onTempUploadCreated) {
        onTempUploadCreated(publicUrl);
      }
      onChange(publicUrl);
      const kb = Math.max(1, Math.round(bytes / 1024));
      setStatusNote(`Uploaded compressed photo (${kb} KB)`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to upload photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setErrorMsg(null);
    setStatusNote(null);
    onChange("");
  };

  return (
    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className={`w-20 h-20 border border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-800 shrink-0 flex items-center justify-center overflow-hidden ${
            shape === "circle" ? "rounded-full" : "rounded-xl"
          }`}
        >
          {value ? (
            <img
              src={value}
              alt={label}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-slate-400">{fallbackIcon}</div>
          )}
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
              {label}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Auto-compressed to &le;640px WebP (~40–100 KB) for Supabase Free Tier
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="sr-only"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="min-h-[44px] px-4 py-2 bg-[#004D40] hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Compressing &amp; Uploading...</span>
                </>
              ) : (
                <>
                  {value ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  <span>{value ? "Change Photo" : "Upload Photo"}</span>
                </>
              )}
            </button>

            {value && !isUploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="min-h-[44px] px-3.5 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {statusNote && (
        <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          {statusNote}
        </div>
      )}

      {errorMsg && (
        <div className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

export { deleteStorageImage };

"use client";

import { supabase } from "@/lib/supabaseClient";

export const JICA_ASSETS_BUCKET = "jica-assets";
export type ImageAssetFolder = "employees" | "products" | "trucks" | "hubs";

const MAX_RAW_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB camera photo safety ceiling
const TARGET_MAX_DIMENSION = 640;
const TARGET_QUALITY = 0.7;
const TARGET_SOFT_MAX_BYTES = 110 * 1024; // Keep compressed images ~40KB-100KB

export function isBase64DataUrl(url?: string | null): boolean {
  return Boolean(url && /^data:/i.test(url.trim()));
}

/**
 * Strips base64 data URIs cleanly so large blobs are NEVER persisted into PostgreSQL.
 */
export function sanitizeStoredImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed || isBase64DataUrl(trimmed)) return undefined;
  return trimmed;
}

/**
 * Extracts the storage object path inside the `jica-assets` bucket from a public URL.
 */
export function extractStoragePathFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${JICA_ASSETS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rawPath = url.slice(idx + marker.length).split("?")[0];
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

/**
 * Deletes an image asset from Supabase Storage `jica-assets` (prevents 1 GB storage bloat).
 */
export async function deleteStorageImage(url?: string | null): Promise<void> {
  const path = extractStoragePathFromUrl(url);
  if (!path) return;
  try {
    await supabase.storage.from(JICA_ASSETS_BUCKET).remove([path]);
  } catch (err) {
    console.warn("Supabase storage cleanup notice:", err);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), mime, quality);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the selected image file."));
    img.src = src;
  });
}

/**
 * Client-side HTML5 Canvas image resizer & compressor:
 * - Scales proportionally to max 640px width/height
 * - Compresses to WebP at 0.70 quality (falls back to JPEG at 0.70 if browser lacks WebP encode)
 * - Steps down slightly only if >110 KB so files stay ~40 KB - 100 KB
 */
export async function compressImageToBlob(
  file: File,
  maxDimension: number = TARGET_MAX_DIMENSION,
  targetQuality: number = TARGET_QUALITY
): Promise<{ blob: Blob; ext: "webp" | "jpg"; contentType: string; bytes: number }> {
  const looksLikeImage =
    file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif|gif|bmp)$/i.test(file.name);
  if (!looksLikeImage) {
    throw new Error("Please choose a valid image file (JPG, PNG, or WebP).");
  }
  if (file.size > MAX_RAW_UPLOAD_BYTES) {
    throw new Error("Photo is too large (max 10 MB before compression).");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width <= 0 || height <= 0) {
      throw new Error("Selected image has invalid dimensions.");
    }

    if (width >= height && width > maxDimension) {
      height = Math.max(1, Math.round((height * maxDimension) / width));
      width = maxDimension;
    } else if (height > width && height > maxDimension) {
      width = Math.max(1, Math.round((width * maxDimension) / height));
      height = maxDimension;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas image processor is unavailable in this browser.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    // Prefer WebP; fall back cleanly to JPEG if browser lacks WebP encoder (e.g. older iOS Safari)
    let blob = await canvasToBlob(canvas, "image/webp", targetQuality);
    let contentType = "image/webp";
    let ext: "webp" | "jpg" = "webp";

    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", targetQuality);
      contentType = "image/jpeg";
      ext = "jpg";
    }

    if (!blob) {
      throw new Error("Failed to compress image.");
    }

    // Ensure final upload stays lean (~40 KB - 100 KB) even for ultra-detailed textures
    let currentQuality = targetQuality;
    let attempts = 0;
    while (blob.size > TARGET_SOFT_MAX_BYTES && currentQuality > 0.45 && attempts < 2) {
      currentQuality = Math.max(0.45, currentQuality - 0.12);
      const retry = await canvasToBlob(canvas, contentType, currentQuality);
      if (retry && retry.size < blob.size) {
        blob = retry;
      }
      attempts += 1;
    }

    return { blob, ext, contentType, bytes: blob.size };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compresses an image file and uploads it to Supabase Storage `jica-assets`.
 * Never stores base64 in PostgreSQL and automatically removes superseded storage objects.
 */
export async function uploadOptimizedImage(
  file: File,
  folder: ImageAssetFolder,
  oldUrlToDelete?: string | null
): Promise<{ publicUrl: string; bytes: number }> {
  const { blob, ext, contentType, bytes } = await compressImageToBlob(file);

  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const objectPath = `${folder}/${Date.now()}-${rand}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(JICA_ASSETS_BUCKET)
    .upload(objectPath, blob, {
      contentType,
      cacheControl: "31536000",
      upsert: false
    });

  if (uploadErr) {
    throw new Error(
      uploadErr.message || "Storage upload failed. Verify the jica-assets bucket exists in Supabase."
    );
  }

  const { data } = supabase.storage.from(JICA_ASSETS_BUCKET).getPublicUrl(objectPath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) {
    throw new Error("Upload succeeded, but public URL could not be resolved.");
  }

  if (oldUrlToDelete && oldUrlToDelete !== publicUrl) {
    await deleteStorageImage(oldUrlToDelete);
  }

  return { publicUrl, bytes };
}

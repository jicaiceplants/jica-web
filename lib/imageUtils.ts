/**
 * Client-Side Image Resizer & Compressor for JICA Ice Logistics
 * Supports raw photo uploads up to 5 MB (5,242,880 bytes)
 * Scales proportionally to max 1000px, JPEG quality 0.8
 * Returns base64 Data URL ready for local storage preview & Supabase Storage upload
 */
export async function compressImage(
  file: File,
  maxDimension: number = 1000,
  targetQuality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Selected file is not an image."));
    }

    // Validate 5 MB max input limit
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_FILE_SIZE) {
      return reject(new Error("File size exceeds 5 MB. Please select a photo under 5 MB."));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image into memory."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale keeping max dimension <= maxDimension (default 1000px)
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          return reject(new Error("Canvas context is unavailable."));
        }

        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG or WebP
        let quality = targetQuality;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);

        // Iteratively reduce quality only if byte size is > 500 KB (~680,000 base64 chars)
        const MAX_BASE64_LENGTH = 680000;
        let iterations = 0;
        while (dataUrl.length > MAX_BASE64_LENGTH && quality > 0.4 && iterations < 4) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          iterations++;
        }

        resolve(dataUrl);
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

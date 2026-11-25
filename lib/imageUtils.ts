// Compatibility wrapper forwarding legacy imports cleanly to canvas + WebP/JPEG blob uploader
export {
  compressImageToBlob,
  uploadOptimizedImage,
  deleteStorageImage,
  extractStoragePathFromUrl,
  sanitizeStoredImageUrl
} from "./imageUpload";

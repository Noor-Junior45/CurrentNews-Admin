import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Loader2, 
  Trash2, 
  Plus, 
  Check, 
  AlertCircle,
  CornerDownRight
} from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';
import { cleanImageUrl, getFallbackImageUrl } from '../utils/imageUrl';
import { auth } from '../firebase';

interface PhotoAttachmentSectionProps {
  primaryImageUrl: string;
  onPrimaryImageUrlChange: (url: string) => void;
  galleryUrls: string[];
  onGalleryUrlsChange: (urls: string[]) => void;
  imagePosition: 'top' | 'middle' | 'bottom' | 'inline';
  onImagePositionChange: (pos: 'top' | 'middle' | 'bottom' | 'inline') => void;
  onInsertPhotoIntoContent?: (url: string) => void;
  onInsertFigureIntoContent?: (figureTag: string, figNum?: number, url?: string) => void;
  primaryImageUrlFallback?: string;
  onPrimaryImageUrlFallbackChange?: (url: string) => void;
  galleryUrlsFallback?: string[];
  onGalleryUrlsFallbackChange?: (urls: string[]) => void;
  galleryPositions?: ('gallery' | 'top' | 'middle' | 'bottom' | 'inline')[];
  onGalleryPositionsChange?: (positions: ('gallery' | 'top' | 'middle' | 'bottom' | 'inline')[]) => void;
}

export default function PhotoAttachmentSection({
  primaryImageUrl,
  onPrimaryImageUrlChange,
  galleryUrls,
  onGalleryUrlsChange,
  imagePosition,
  onImagePositionChange,
  onInsertPhotoIntoContent,
  onInsertFigureIntoContent,
  primaryImageUrlFallback,
  onPrimaryImageUrlFallbackChange,
  galleryUrlsFallback = [],
  onGalleryUrlsFallbackChange,
  galleryPositions = [],
  onGalleryPositionsChange,
}: PhotoAttachmentSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Core upload pipeline with client-side compression
  const processAndUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setError('Please select valid image files (JPG, PNG, WebP).');
      setIsUploading(false);
      return;
    }

    const uploadedUrls: string[] = [];
    const uploadedFallbackUrls: string[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      let processedFile: File = file;
      try {
        const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setStatusText(`Compressing photo ${i + 1}/${validFiles.length} (${originalSizeMB} MB)...`);

        // Compress in browser via HTML5 Canvas into ultra-fast WebP before uploading
        const compressedFile = await compressImage(file, 1920, 1080, 0.82);
        processedFile = compressedFile;
        const compressedSizeKB = Math.round(compressedFile.size / 1024);

        setStatusText(`Uploading photo ${i + 1}/${validFiles.length} (${compressedSizeKB} KB)...`);

        const formData = new FormData();
        formData.append('image', compressedFile);

        let uploadSuccess = false;
        let cleanUrl = '';
        let cleanFallback = '';

        try {
          let idToken: string | null = null;
          try {
            idToken = await auth.currentUser?.getIdToken();
          } catch (_) {}

          const uploadHeaders: Record<string, string> = {
            'Accept': 'application/json',
          };
          if (idToken) {
            uploadHeaders['Authorization'] = `Bearer ${idToken}`;
          }

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: uploadHeaders,
          });

          const rawText = await res.text();
          // Inspect response and ensure it is valid JSON (not an HTML cookie check or interstitial)
          if (rawText && !rawText.trim().startsWith('<') && !rawText.toLowerCase().includes('cookie check')) {
            try {
              const data = JSON.parse(rawText);
              if (res.ok && data?.success && data?.url) {
                cleanUrl = cleanImageUrl(data.url);
                cleanFallback = getFallbackImageUrl(cleanUrl, data.fallbackUrl);
                uploadSuccess = true;
              }
            } catch {
              // Fall through to client data fallback
            }
          }
        } catch (fetchErr) {
          console.debug('Direct upload notice:', fetchErr);
        }

        if (uploadSuccess && cleanUrl) {
          uploadedUrls.push(cleanUrl);
          uploadedFallbackUrls.push(cleanFallback);
        } else {
          // Resilient client-side fallback: preserve photo as high-speed WebP data URL
          // Writer is never blocked or shown technical server cookies
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(processedFile);
          });
          if (dataUrl && dataUrl.startsWith('data:image/')) {
            uploadedUrls.push(dataUrl);
            uploadedFallbackUrls.push(dataUrl);
          }
        }
      } catch (err: any) {
        console.warn('Photo processing note:', err);
        try {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(processedFile);
          });
          if (dataUrl && dataUrl.startsWith('data:image/')) {
            uploadedUrls.push(dataUrl);
            uploadedFallbackUrls.push(dataUrl);
          }
        } catch {
          setError('Failed to process image file. Please try another image.');
        }
      }
    }

    if (uploadedUrls.length > 0) {
      setError(null);
      if (!primaryImageUrl) {
        // Set first as primary, remaining to gallery
        onPrimaryImageUrlChange(uploadedUrls[0]);
        if (onPrimaryImageUrlFallbackChange) {
          onPrimaryImageUrlFallbackChange(uploadedFallbackUrls[0]);
        }
        onImagePositionChange('bottom');
        if (uploadedUrls.length > 1) {
          onGalleryUrlsChange([...galleryUrls, ...uploadedUrls.slice(1)]);
          if (onGalleryUrlsFallbackChange) {
            onGalleryUrlsFallbackChange([...galleryUrlsFallback, ...uploadedFallbackUrls.slice(1)]);
          }
          if (onGalleryPositionsChange) {
            const extraCount = uploadedUrls.length - 1;
            const newPos: ('gallery' | 'top' | 'middle' | 'bottom' | 'inline')[] = Array(extraCount).fill('bottom');
            onGalleryPositionsChange([...(galleryPositions || []), ...newPos]);
          }
        }
      } else {
        // If primary already exists, append all newly uploaded to gallery with bottom position
        onGalleryUrlsChange([...galleryUrls, ...uploadedUrls]);
        if (onGalleryUrlsFallbackChange) {
          onGalleryUrlsFallbackChange([...galleryUrlsFallback, ...uploadedFallbackUrls]);
        }
        if (onGalleryPositionsChange) {
          const newPos: ('gallery' | 'top' | 'middle' | 'bottom' | 'inline')[] = Array(uploadedUrls.length).fill('bottom');
          onGalleryPositionsChange([...(galleryPositions || []), ...newPos]);
        }
      }
    }

    setIsUploading(false);
    setStatusText('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAndUploadFiles(e.dataTransfer.files);
    }
  };

  const handleGalleryFlowChange = (idx: number, newFlow: 'gallery' | 'top' | 'middle' | 'bottom' | 'inline') => {
    const targetUrl = galleryUrls[idx];
    const figNum = idx + 2;

    if (newFlow === 'top') {
      // Swap to primary
      const oldPrimary = primaryImageUrl;
      const oldPrimaryFb = primaryImageUrlFallback || primaryImageUrl;
      const thisFb = galleryUrlsFallback?.[idx] || targetUrl;

      onPrimaryImageUrlChange(targetUrl);
      if (onPrimaryImageUrlFallbackChange) {
        onPrimaryImageUrlFallbackChange(thisFb);
      }

      const newGallery = [...galleryUrls];
      const newGalleryFb = [...galleryUrlsFallback];

      if (oldPrimary) {
        newGallery[idx] = oldPrimary;
        newGalleryFb[idx] = oldPrimaryFb;
      } else {
        newGallery.splice(idx, 1);
        newGalleryFb.splice(idx, 1);
      }

      onGalleryUrlsChange(newGallery);
      if (onGalleryUrlsFallbackChange) {
        onGalleryUrlsFallbackChange(newGalleryFb);
      }
      onImagePositionChange('top');
      return;
    }

    if (newFlow === 'inline') {
      if (onInsertPhotoIntoContent) {
        onInsertPhotoIntoContent(targetUrl);
      } else {
        onInsertFigureIntoContent?.('', figNum, targetUrl);
      }
    }

    if (onGalleryPositionsChange) {
      const updated = [...galleryPositions];
      while (updated.length < galleryUrls.length) {
        updated.push('bottom');
      }
      updated[idx] = newFlow;
      onGalleryPositionsChange(updated);
    }
  };

  const hasPhotos = Boolean(primaryImageUrl) || galleryUrls.length > 0;

  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4" id="image-attachment-group">
      {/* 1. Header with logo and nothing else */}
      <div className="flex items-center space-x-2">
        <ImageIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
          Upload Photo
        </h3>
      </div>

      {/* 2. Drag & Drop / Click to browse box (Hidden once at least one photo is uploaded, Add Image button used thereafter) */}
      {!hasPhotos && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          } ${isUploading ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && processAndUploadFiles(e.target.files)}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="py-2 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400 animate-spin" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                {statusText || 'Uploading to Cloudflare R2...'}
              </span>
            </div>
          ) : (
            <div className="py-2 flex flex-col items-center justify-center space-y-2">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Click to browse or drop an image file here
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error notification if any */}
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Previews in left side and in same line in right side photo flow placement */}
      {hasPhotos && (
        <div className="space-y-3 pt-1">
          {/* Primary Photo Row */}
          {primaryImageUrl && (
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Left Side: Thumbnail Preview */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                  <img
                    src={cleanImageUrl(primaryImageUrl)}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      const fb = getFallbackImageUrl(primaryImageUrl, primaryImageUrlFallback);
                      if (fb && target.src !== fb) {
                        target.src = fb;
                      } else {
                        target.style.display = 'none';
                      }
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/60">
                      <Check className="h-3 w-3" />
                      <span>Primary Photo</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (onInsertPhotoIntoContent) {
                          onInsertPhotoIntoContent(primaryImageUrl);
                        } else {
                          onInsertFigureIntoContent?.('', 1, primaryImageUrl);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-md transition-all cursor-pointer shadow-2xs"
                      title="Insert this photo directly into article at cursor position"
                    >
                      <CornerDownRight className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Insert in Article</span>
                    </button>
                  </div>
                  <span className="block text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                    {primaryImageUrl}
                  </span>
                </div>
              </div>

              {/* Right Side in Same Line: Position selector & Delete */}
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 shadow-2xs">
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 shrink-0">
                    Position:
                  </label>
                  <select
                    value={imagePosition || 'bottom'}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      if (val === 'inline') {
                        if (onInsertPhotoIntoContent) {
                          onInsertPhotoIntoContent(primaryImageUrl);
                        } else {
                          onInsertFigureIntoContent?.('', 1, primaryImageUrl);
                        }
                        onImagePositionChange('inline');
                      } else {
                        onImagePositionChange(val);
                      }
                    }}
                    className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-transparent focus:outline-hidden cursor-pointer"
                  >
                    <option value="bottom" className="dark:bg-slate-900">End of Story (Default)</option>
                    <option value="top" className="dark:bg-slate-900">Top of Story</option>
                    <option value="middle" className="dark:bg-slate-900">Middle of Story</option>
                    <option value="inline" className="dark:bg-slate-900">Inside Article Body</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Promote first gallery item to primary if available, otherwise clear
                    if (galleryUrls.length > 0) {
                      onPrimaryImageUrlChange(galleryUrls[0]);
                      onGalleryUrlsChange(galleryUrls.slice(1));
                      if (onPrimaryImageUrlFallbackChange) {
                        onPrimaryImageUrlFallbackChange(galleryUrlsFallback[0] || galleryUrls[0]);
                      }
                      if (onGalleryUrlsFallbackChange) {
                        onGalleryUrlsFallbackChange(galleryUrlsFallback.slice(1));
                      }
                    } else {
                      onPrimaryImageUrlChange('');
                      if (onPrimaryImageUrlFallbackChange) {
                        onPrimaryImageUrlFallbackChange('');
                      }
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Additional Photos (Gallery) Rows with Flow Selection Box */}
          {galleryUrls.map((url, idx) => {
            const figNum = idx + 2;
            const currentFlow = galleryPositions?.[idx] || 'bottom';
            return (
              <div key={idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-16 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                    <img
                      src={cleanImageUrl(url)}
                      alt="Article Photo Attachment"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fb = getFallbackImageUrl(url, galleryUrlsFallback?.[idx]);
                        if (fb && target.src !== fb) {
                          target.src = fb;
                        } else {
                          target.style.display = 'none';
                        }
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        Additional Photo
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onInsertPhotoIntoContent) {
                            onInsertPhotoIntoContent(url);
                          } else {
                            onInsertFigureIntoContent?.('', figNum, url);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-md transition-all cursor-pointer shadow-2xs"
                        title="Insert this photo directly into article at cursor position"
                      >
                        <CornerDownRight className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        <span>Insert in Article</span>
                      </button>
                    </div>
                    <span className="block text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                      {url}
                    </span>
                  </div>
                </div>

                {/* Right Side in Same Line: Position selector for gallery photo & Swap/Delete */}
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center w-full sm:w-auto justify-between sm:justify-end flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 shadow-2xs">
                    <label className="text-[10px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 shrink-0">
                      Position:
                    </label>
                    <select
                      value={currentFlow || 'bottom'}
                      onChange={(e) => handleGalleryFlowChange(idx, e.target.value as any)}
                      className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-transparent focus:outline-hidden cursor-pointer"
                    >
                      <option value="bottom" className="dark:bg-slate-900">End of Story (Default)</option>
                      <option value="top" className="dark:bg-slate-900">Top of Story</option>
                      <option value="middle" className="dark:bg-slate-900">Middle of Story</option>
                      <option value="gallery" className="dark:bg-slate-900">Bottom Photo Gallery</option>
                      <option value="inline" className="dark:bg-slate-900">Inside Article Body</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleGalleryFlowChange(idx, 'top')}
                      className="text-[10px] font-mono font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                      title="Promote this photo to primary hero"
                    >
                      Make Primary
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onGalleryUrlsChange(galleryUrls.filter((_, i) => i !== idx));
                        if (onGalleryUrlsFallbackChange) {
                          onGalleryUrlsFallbackChange(galleryUrlsFallback.filter((_, i) => i !== idx));
                        }
                        if (onGalleryPositionsChange && galleryPositions) {
                          onGalleryPositionsChange(galleryPositions.filter((_, i) => i !== idx));
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Remove photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bottom "Add Image" button */}
          <div className="pt-1">
            <input
              ref={addMoreInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && processAndUploadFiles(e.target.files)}
              className="hidden"
              disabled={isUploading}
            />
            <button
              type="button"
              onClick={() => addMoreInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-2.5 px-4 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Add Image</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

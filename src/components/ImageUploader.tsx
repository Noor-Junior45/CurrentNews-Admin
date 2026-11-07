import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Check, 
  AlertCircle, 
  Loader2, 
  X, 
  ExternalLink,
  Copy
} from 'lucide-react';
import { cleanImageUrl, getFallbackImageUrl } from '../utils/imageUrl';
import { auth } from '../firebase';

interface ImageUploaderProps {
  onImageUploaded: (url: string, fallbackUrl?: string) => void;
  label?: string;
  helperText?: string;
  className?: string;
}

export default function ImageUploader({
  onImageUploaded,
  label = 'Upload Image to Cloudflare R2',
  helperText = 'Select or drag & drop a photo (JPEG, PNG, WebP, GIF up to 15MB).',
  className = '',
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);
  const [lastUploadedFallbackUrl, setLastUploadedFallbackUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!file) return;

    // Client-side file type check
    if (!file.type.startsWith('image/')) {
      setError('Selected file is not an image. Please choose a JPG, PNG, or WebP.');
      return;
    }

    // Client-side file size check (15MB)
    if (file.size > 15 * 1024 * 1024) {
      setError('Image is larger than 15MB. Please choose a smaller photo.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgressText(`Uploading ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);

    try {
      const formData = new FormData();
      formData.append('image', file);

      let uploadSuccess = false;
      let publicUrl = '';
      let fallbackUrl = '';

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

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: uploadHeaders,
        });

        const rawText = await response.text();
        if (rawText && !rawText.trim().startsWith('<') && !rawText.toLowerCase().includes('cookie check')) {
          try {
            const data = JSON.parse(rawText);
            if (response.ok && data?.success && data?.url) {
              publicUrl = cleanImageUrl(data.url);
              fallbackUrl = getFallbackImageUrl(publicUrl, data.fallbackUrl);
              uploadSuccess = true;
            }
          } catch {
            // JSON parse notice
          }
        }
      } catch (fetchErr) {
        console.debug('Upload notice:', fetchErr);
      }

      if (uploadSuccess && publicUrl) {
        setLastUploadedUrl(publicUrl);
        setLastUploadedFallbackUrl(fallbackUrl || null);
        onImageUploaded(publicUrl, fallbackUrl);
      } else {
        // Safe local data fallback
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          setLastUploadedUrl(dataUrl);
          setLastUploadedFallbackUrl(dataUrl);
          onImageUploaded(dataUrl, dataUrl);
        } else {
          setError('Failed to process image file.');
        }
      }

      setIsUploading(false);
      setProgressText('');
    } catch (err: any) {
      console.warn('Upload note:', err);
      try {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          setLastUploadedUrl(dataUrl);
          setLastUploadedFallbackUrl(dataUrl);
          onImageUploaded(dataUrl, dataUrl);
        } else {
          setError('Failed to process photo.');
        }
      } catch {
        setError('Failed to process photo.');
      }
      setIsUploading(false);
      setProgressText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleCopyUrl = () => {
    if (lastUploadedUrl) {
      navigator.clipboard.writeText(lastUploadedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`space-y-3 ${className}`} id="r2-image-uploader">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
          <UploadCloud className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>{label}</span>
        </label>
        <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50">
          Cloudflare R2 Storage
        </span>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        } ${isUploading ? 'opacity-75 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="py-4 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
              {progressText || 'Transferring to Cloudflare R2...'}
            </span>
          </div>
        ) : (
          <div className="py-2 flex flex-col items-center justify-center space-y-2">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-900/50">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Click to browse or drop an image file here
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {helperText}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button 
            type="button"
            onClick={() => setError(null)}
            className="p-1 text-rose-500 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Last Uploaded Confirmation & Link */}
      {lastUploadedUrl && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-md bg-slate-100 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 overflow-hidden shrink-0">
              <img 
                src={lastUploadedUrl} 
                alt="Uploaded thumbnail" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (lastUploadedFallbackUrl && target.src !== lastUploadedFallbackUrl) {
                    target.src = lastUploadedFallbackUrl;
                  } else {
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                <span>Uploaded to Cloudflare R2</span>
              </div>
              <span className="block text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                {lastUploadedUrl}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-bold flex items-center gap-1 transition-colors"
              title="Copy URL"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <a
              href={lastUploadedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Open full image in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

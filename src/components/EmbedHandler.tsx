import React, { useState, useEffect } from 'react';
import { Youtube, Facebook, Link2, Globe, ExternalLink, RefreshCw, Play, AlertCircle } from 'lucide-react';

interface EmbedHandlerProps {
  youtubeUrl?: string;
  facebookUrl?: string;
  customLinks?: string[];
  isHeader?: boolean;
}

interface FacebookParsedData {
  canonicalUrl: string;
  embedSrc: string;
  mediaType: 'reel' | 'video' | 'post';
  isRawPluginSrc: boolean;
  rawInput: string;
}

/**
 * Robustly parses and normalizes Facebook URLs, share links, reels, videos, posts,
 * or raw <iframe> and SDK embed codes into clean canonical URLs and iframe plugin embed sources.
 */
function resolveFacebookData(input: string = ''): FacebookParsedData | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. If user pasted a raw <iframe> code block
  if (trimmed.includes('<iframe') && trimmed.includes('src=')) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      let src = srcMatch[1].trim();
      if (src.startsWith('//')) src = `https:${src}`;

      // If it is already a Facebook plugin URL
      if (src.includes('facebook.com/plugins/')) {
        let innerHref = '';
        try {
          const urlObj = new URL(src);
          innerHref = urlObj.searchParams.get('href') || '';
        } catch (e) {
          const hrefMatch = src.match(/[?&]href=([^&]+)/);
          if (hrefMatch && hrefMatch[1]) {
            innerHref = decodeURIComponent(hrefMatch[1]);
          }
        }
        const targetUrl = innerHref || src;
        const isReel = targetUrl.includes('/reel/') || targetUrl.includes('/share/r/');
        const isVid = isReel || targetUrl.includes('/videos/') || targetUrl.includes('/watch') || src.includes('video.php');

        return {
          canonicalUrl: targetUrl,
          embedSrc: src,
          mediaType: isReel ? 'reel' : isVid ? 'video' : 'post',
          isRawPluginSrc: true,
          rawInput: trimmed,
        };
      }
    }
  }

  // 2. Extract URL from data-href (Facebook SDK code) or raw text
  let extractedUrl = trimmed;
  if (trimmed.includes('data-href=')) {
    const dataHrefMatch = trimmed.match(/data-href=["']([^"']+)["']/i);
    if (dataHrefMatch && dataHrefMatch[1]) {
      extractedUrl = dataHrefMatch[1].trim();
    }
  } else if (trimmed.includes('<iframe')) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      extractedUrl = srcMatch[1].trim();
    }
  }

  // Strip surrounding quotes
  extractedUrl = extractedUrl.replace(/^["']|["']$/g, '').trim();

  // Normalize protocol
  if (extractedUrl.startsWith('//')) {
    extractedUrl = `https:${extractedUrl}`;
  } else if (!/^https?:\/\//i.test(extractedUrl)) {
    extractedUrl = `https://${extractedUrl}`;
  }

  // Normalize mobile and legacy subdomains to www.facebook.com
  extractedUrl = extractedUrl
    .replace(/^https?:\/\/(m|mobile|web|l)\.facebook\.com/i, 'https://www.facebook.com')
    .replace(/^http:\/\//i, 'https://');

  // Strip mobile tracking query parameters (e.g. ?mibextid=..., ?ref=...) that break Facebook plugins
  try {
    const parsed = new URL(extractedUrl);
    if (parsed.hostname.includes('facebook.com')) {
      const trackingParams = [
        'mibextid', 'ref', 'rdid', 'locale', 'fs', 's', 
        '__cft__', '__tn__', 'utm_source', 'utm_medium', 
        'utm_campaign', 'sfnsn', 'wtsid'
      ];
      trackingParams.forEach(p => parsed.searchParams.delete(p));
      extractedUrl = parsed.toString();
    }
  } catch (e) {
    // Retain extractedUrl if native URL parsing fails
  }

  // Determine media type
  const isReel = extractedUrl.includes('/reel/') || extractedUrl.includes('/share/r/');
  const isVideo = isReel ||
    extractedUrl.includes('/videos/') ||
    extractedUrl.includes('/watch') ||
    extractedUrl.includes('fb.watch') ||
    extractedUrl.includes('/share/v/') ||
    extractedUrl.includes('video.php');

  const mediaType: 'reel' | 'video' | 'post' = isReel ? 'reel' : isVideo ? 'video' : 'post';

  // If the extracted URL is already a plugin URL
  if (extractedUrl.includes('facebook.com/plugins/')) {
    return {
      canonicalUrl: extractedUrl,
      embedSrc: extractedUrl,
      mediaType,
      isRawPluginSrc: true,
      rawInput: trimmed,
    };
  }

  // Construct official Facebook plugin embed source
  const encodedHref = encodeURIComponent(extractedUrl);
  let embedSrc = '';
  if (mediaType === 'reel') {
    embedSrc = `https://www.facebook.com/plugins/video.php?href=${encodedHref}&show_text=false&autoplay=false&width=360`;
  } else if (mediaType === 'video') {
    embedSrc = `https://www.facebook.com/plugins/video.php?href=${encodedHref}&show_text=false&autoplay=false&width=500`;
  } else {
    embedSrc = `https://www.facebook.com/plugins/post.php?href=${encodedHref}&show_text=true&width=500`;
  }

  return {
    canonicalUrl: extractedUrl,
    embedSrc,
    mediaType,
    isRawPluginSrc: false,
    rawInput: trimmed,
  };
}

/**
 * Extracts YouTube video ID from various YouTube URL formats or iframe codes.
 */
function getYouTubeVideoId(url: string = ''): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let resolved = trimmed;
  if (trimmed.includes('<iframe') && trimmed.includes('src=')) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) resolved = match[1];
  }

  const pattern = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = resolved.match(pattern);
  return match ? match[1] : null;
}

export default function EmbedHandler({ youtubeUrl, facebookUrl, customLinks, isHeader }: EmbedHandlerProps) {
  const [reloadKey, setReloadKey] = useState(0);

  const hasYouTube = !!youtubeUrl && youtubeUrl.trim().length > 0;
  const hasFacebook = !!facebookUrl && facebookUrl.trim().length > 0;
  const validCustomLinks = (customLinks || []).filter(link => link && link.trim().length > 0);
  const hasCustom = validCustomLinks.length > 0;

  // Initialize Facebook SDK for single-page application XFBML parsing
  useEffect(() => {
    if (!hasFacebook) return;

    // Ensure #fb-root element exists in DOM
    if (!document.getElementById('fb-root')) {
      const fbRoot = document.createElement('div');
      fbRoot.id = 'fb-root';
      document.body.appendChild(fbRoot);
    }

    // Inject Facebook official SDK if not yet loaded
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v20.0';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        try {
          (window as any).FB?.XFBML?.parse();
        } catch (e) {}
      };
      document.body.appendChild(script);
    } else {
      try {
        (window as any).FB?.XFBML?.parse();
      } catch (e) {}
    }
  }, [facebookUrl, hasFacebook, reloadKey]);

  if (!hasYouTube && !hasFacebook && !hasCustom) return null;

  const ytVideoId = hasYouTube ? getYouTubeVideoId(youtubeUrl) : null;
  const fbData = hasFacebook ? resolveFacebookData(facebookUrl) : null;

  return (
    <div className={isHeader ? "mb-8" : "mt-10 pt-6 border-t border-slate-200 dark:border-slate-700"} id="embeds-section">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* YouTube Video Embed */}
        {hasYouTube && (
          <div className="flex flex-col bg-transparent border-0 p-0 shadow-none" id="yt-embed-box">
            <div className="flex items-center justify-between text-red-600 mb-3">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 fill-[#FF0000]" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.513 3.545 12 3.545 12 3.545s-7.513 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.875.508 9.388.508 9.388.508s7.513 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wider font-mono">YouTube Video</span>
              </div>

              {ytVideoId && (
                <a 
                  href={`https://www.youtube.com/watch?v=${ytVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                  title="Open on YouTube"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            
            {ytVideoId ? (
              <div className="relative w-full max-w-2xl mx-auto aspect-video rounded-xl overflow-hidden bg-black shadow-xs border border-slate-200 dark:border-slate-700">
                <iframe
                  src={`https://www.youtube.com/embed/${ytVideoId}?rel=0&modestbranding=1`}
                  title="YouTube video player"
                  className="absolute top-0 left-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-center border border-red-200 dark:border-red-900/50">
                <p className="text-sm font-medium">Unable to resolve YouTube Video ID</p>
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-1 truncate max-w-full">
                  {youtubeUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Facebook Media Embed (Videos, Reels, Posts) */}
        {hasFacebook && (
          <div className="flex flex-col bg-transparent border-0 p-0 shadow-none" id="fb-embed-box">
            
            {/* Header with Facebook branding, media badge, and direct actions */}
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-3">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 fill-[#1877F2]" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                  Facebook {fbData?.mediaType === 'reel' ? 'Reel' : fbData?.mediaType === 'video' ? 'Video' : 'Post'}
                </span>
              </div>

              {fbData && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReloadKey(k => k + 1)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    title="Reload player"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Reload</span>
                  </button>

                  <a 
                    href={fbData.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                    title="Watch directly on Facebook"
                  >
                    <span>Watch on Facebook</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {fbData ? (
              <div className="flex flex-col space-y-3">
                {/* Embed Player Box */}
                <div 
                  key={reloadKey}
                  className={`w-full mx-auto bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs flex items-center justify-center ${
                    fbData.mediaType === 'reel'
                      ? 'max-w-[360px] min-h-[580px] h-[600px] sm:h-[640px]'
                      : fbData.mediaType === 'video'
                        ? 'max-w-2xl aspect-video min-h-[340px] sm:min-h-[400px]'
                        : 'max-w-xl min-h-[420px]'
                  }`}
                >
                  <iframe
                    src={fbData.embedSrc}
                    scrolling="no"
                    frameBorder="0"
                    allowFullScreen={true}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    title="Facebook media embed"
                    className="w-full h-full border-0"
                  />
                </div>

                {/* Direct Action Bar to guarantee playback */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
                    <Play className="h-4 w-4 fill-blue-600 text-blue-600 shrink-0" />
                    <span className="font-medium text-[11px] sm:text-xs">
                      {fbData.mediaType === 'reel' 
                        ? 'Facebook Reel ready to play' 
                        : fbData.mediaType === 'video' 
                          ? 'Facebook Video player active' 
                          : 'Facebook Post connected'}
                    </span>
                  </div>

                  <a
                    href={fbData.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-[#1877F2] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                    id="fb-direct-play-btn"
                  >
                    <Facebook className="h-3.5 w-3.5 fill-white" />
                    <span>Watch Video on Facebook</span>
                    <ExternalLink className="h-3 w-3 ml-0.5" />
                  </a>
                </div>

                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-sans">
                  If the player is blocked by browser privacy or ad-blockers, click <strong className="text-blue-600 dark:text-blue-400">Watch Video on Facebook</strong> above to run directly.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl text-center border border-blue-200 dark:border-blue-900/50">
                <AlertCircle className="h-5 w-5 mb-1.5 text-blue-500" />
                <p className="text-sm font-semibold">Invalid or unrecognized Facebook URL</p>
                <a 
                  href={facebookUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs underline mt-2 truncate max-w-full text-blue-600 dark:text-blue-400 font-mono"
                >
                  {facebookUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Custom Integrations List */}
        {hasCustom && (
          <div className="col-span-1 md:col-span-2 flex flex-col bg-transparent border-0 p-0 shadow-none" id="custom-embeds-box">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
              <Link2 className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">Links &amp; References ({validCustomLinks.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {validCustomLinks.map((link, index) => {
                let domain = 'External Resource';
                try {
                  domain = new URL(link).hostname.replace('www.', '');
                } catch(e) {}

                return (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 py-2 px-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group cursor-pointer"
                  >
                    <Globe className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0 transition-colors" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                        {domain}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-mono truncate" title={link}>
                        {link}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

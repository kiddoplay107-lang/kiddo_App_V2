import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Video, ChevronLeft, ChevronRight, Play, Pause, Loader2, Folder, Search, AlertCircle, RefreshCw, SkipBack, SkipForward, RotateCcw, RotateCw, Maximize, Volume2, VolumeX } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Capacitor } from '@capacitor/core';

// Free-Tier Hybrid Backend Strategy (Vercel & Render)
// Vercel handles super-fast, instantaneous directory navigation (0 cold start)
// Render handles heavy video streaming requests with range and chunk support (unlocked runtime limits)
const VERCEL_URL = 'https://kiddo-app-two.vercel.app'; // Replace with your Vercel URL
const RENDER_URL = 'https://kiddo-app.onrender.com';    // Replace with your Render URL

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DriveFile {
  id: string;
  name: string;
  thumbnailLink?: string;
  webContentLink?: string;
}

type View = 'menu' | 'folders' | 'videos' | 'player' | 'games';

export default function App() {
  const [backendStatus, setBackendStatus] = useState<'loading' | 'online' | 'asleep' | 'waking'>('loading');
  const [vercelStatus, setVercelStatus] = useState<'loading' | 'online' | 'failed'>('loading');

  const RENDER_BASE = Capacitor.getPlatform() === 'web' ? '' : RENDER_URL;

  const [view, setView] = useState<View>('menu');
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [videos, setVideos] = useState<DriveFile[]>([]);
  const [folderStack, setFolderStack] = useState<DriveFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<DriveFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (view === 'player' && selectedVideo && videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(err => {
        console.warn("Autoplay was prevented by the browser:", err);
        setIsPlaying(false);
        });
      }
    }, [selectedVideo, view]);

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') {
      const prefetch = async () => {
        try {
          const res = await fetch('/api/drive/contents');
          if (res.ok) {
            const data = await res.json();
            setFolders(data.folders || []);
            setVideos(data.videos || []);
            setBackendStatus('online');
            setVercelStatus('online');
          }
        } catch (e) {
          console.warn('Web Pre-fetch failed', e);
          setBackendStatus('asleep');
          setVercelStatus('failed');
        }
      };
      prefetch();
      return;
    }

    const prefetchViaVercel = async () => {
      setVercelStatus('loading');
      try {
        console.log('Prefetching directories via instant Vercel...');
        const res = await fetch(`${VERCEL_URL.replace(/\/$/, '')}/api/drive/contents`);
        if (res.ok) {
          const data = await res.json();
          setFolders(data.folders || []);
          setVideos(data.videos || []);
          setVercelStatus('online');
        } else {
          setVercelStatus('failed');
        }
      } catch (err) {
        console.warn('Vercel prefetch failed', err);
        setVercelStatus('failed');
      }
    };

    const wakeUpRender = async () => {
      setBackendStatus('waking');
      try {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 70000); // Allow 70s for Render cold starts
        
        const res = await fetch(`${RENDER_URL.replace(/\/$/, '')}/api/health`, { signal: controller.signal });
        clearTimeout(tId);
        
        if (res.ok) {
          setBackendStatus('online');
          console.log(`Render backend is online!`);
        } else {
          setBackendStatus('asleep');
        }
      } catch (e) {
        console.warn('Wake up check failed', e);
        setBackendStatus('asleep');
      }
    };

    prefetchViaVercel();
    wakeUpRender();
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const fetchContents = async (folder?: DriveFile) => {
    setLoading(true);
    setError(null);
    const isWeb = Capacitor.getPlatform() === 'web';
    const folderId = folder?.id || '';

    // Primary: Vercel (instant), Fallback: Render (handles streams and full runtime)
    const primaryUrl = isWeb 
      ? `/api/drive/contents${folderId ? `/${folderId}` : ''}` 
      : `${VERCEL_URL.replace(/\/$/, '')}/api/drive/contents${folderId ? `/${folderId}` : ''}`;
    
    const fallbackUrl = isWeb 
      ? `/api/drive/contents${folderId ? `/${folderId}` : ''}` 
      : `${RENDER_URL.replace(/\/$/, '')}/api/drive/contents${folderId ? `/${folderId}` : ''}`;

    const makeRequest = async (targetUrl: string, timeoutMs: number) => {
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(tId);
        return res;
      } catch (err) {
        clearTimeout(tId);
        throw err;
      }
    };

    try {
      let res;
      console.log(`Fetching contents from primary URL: ${primaryUrl}`);
      try {
        // Fast 15s timeout for Vercel since it should be hot and instant
        res = await makeRequest(primaryUrl, 15000);
      } catch (primaryErr: any) {
        console.warn(`Primary Vercel fetch failed: ${primaryErr.message}. Trying Render fallback...`);
        // Fallback to Render with extra time (65s) in case it is booting cold
        res = await makeRequest(fallbackUrl, isWeb ? 15000 : 65000);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => 'No response body');
        let errorMsg = `Server error: ${res.status} ${res.statusText}`;
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg += ` - ${text.substring(0, 50)}`;
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setFolders(data.folders || []);
      setVideos(data.videos || []);
      
      if (folder) {
        setFolderStack(prev => {
          if (prev.length > 0 && prev[prev.length - 1].id === folder.id) return prev;
          return [...prev, folder];
        });
      } else {
        setFolderStack([]);
      }
      
      setView('folders');
    } catch (err: any) {
      const msg = err.name === 'AbortError' ? 'Connection timed out (Check your internet or URL)' : err.message;
      setError(`${msg}\nPrimary Vercel: ${primaryUrl}\nFallback Render: ${fallbackUrl}`);
      console.error('Failed to fetch contents', err);
    } finally {
      setLoading(false);
    }
  };

  const playVideo = (video: DriveFile) => {
    setSelectedVideo(video);
    setView('player');
  };

  const playNext = () => {
    if (!selectedVideo || videos.length === 0) return;
    const currentIndex = videos.findIndex(v => v.id === selectedVideo.id);
    const nextIndex = (currentIndex + 1) % videos.length;
    setSelectedVideo(videos[nextIndex]);
  };

  const playPrevious = () => {
    if (!selectedVideo || videos.length === 0) return;
    const currentIndex = videos.findIndex(v => v.id === selectedVideo.id);
    const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
    setSelectedVideo(videos[prevIndex]);
  };

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 10;
    }
  };

  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime -= 10;
    }
  };

  const filteredVideos = videos.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setDuration(video.duration);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if ((videoRef.current as any).webkitRequestFullscreen) {
        (videoRef.current as any).webkitRequestFullscreen();
      }
    }
  };

  const goBack = () => {
    if (view === 'player') {
      setView('folders');
    } else if (view === 'folders') {
      if (folderStack.length > 0) {
        const newStack = [...folderStack];
        newStack.pop(); // Remove current folder
        const parentFolder = newStack[newStack.length - 1];
        setFolderStack(newStack);
        fetchContents(parentFolder);
      } else {
        setView('menu');
      }
    } else if (view === 'games') {
      setView('menu');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFAF0] font-sans text-[#4A4A4A] overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between bg-white shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          {view !== 'menu' && (
            <button 
              onClick={goBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-8 h-8 text-[#FF6B6B]" />
            </button>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-[#FF6B6B]">
            Kiddo<span className="text-[#4ECDC4]">Play</span>
          </h1>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full overflow-y-auto relative">
        {/* Global Loader Overlay */}
        <AnimatePresence>
          {loading && view === 'menu' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-[#FFFAF0]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center px-6"
            >
              <Loader2 className="w-16 h-16 animate-spin text-[#4ECDC4]" />
              <p className="text-xl font-black text-[#4ECDC4] animate-pulse">
                {Capacitor.getPlatform() === 'web' 
                  ? 'Connecting...' 
                  : vercelStatus === 'online' 
                    ? 'Loading Videos...' 
                    : 'Opening Galleries...'}
              </p>
              {Capacitor.getPlatform() !== 'web' && vercelStatus !== 'online' && (
                <div className="text-xs text-gray-500 max-w-xs space-y-2 animate-fade-in leading-relaxed">
                  <p>Connecting to our fast directory server (Vercel) to load your folders instantly.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-3xl flex items-center gap-4 text-red-700"
            >
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div className="flex-1 font-bold">{error}</div>
              <button 
                onClick={() => {
                  if (view === 'folders') {
                    const currentFolder = folderStack[folderStack.length - 1];
                    fetchContents(currentFolder);
                  } else fetchContents();
                }}
                className="p-2 hover:bg-red-100 rounded-full transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {view === 'menu' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12"
            >
              <MenuButton 
                icon={<Gamepad2 className="w-24 h-24" />}
                label="Games"
                color="bg-[#FF6B6B]"
                onClick={() => setView('games')}
              />
              <MenuButton 
                icon={<Video className="w-24 h-24" />}
                label="Videos"
                color="bg-[#4ECDC4]"
                onClick={() => fetchContents()}
              />
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="col-span-full mt-4 text-xs text-gray-400 hover:text-[#FF6B6B] transition-colors"
              >
                Reset App Cache
              </button>
            </motion.div>
          )}

          {view === 'folders' && (
            <motion.div 
              key="folders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex flex-col items-start">
                  <h2 className="text-3xl font-black text-[#4A4A4A]">
                    {folderStack.length > 0 ? folderStack[folderStack.length - 1].name : 'Choose a Playlist!'}
                  </h2>
                  {folderStack.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                      <span>Root</span>
                      {folderStack.map((f, i) => (
                        <React.Fragment key={f.id}>
                          <ChevronRight className="w-3 h-3" />
                          <span className={i === folderStack.length - 1 ? "text-[#4ECDC4]" : ""}>{f.name}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#4ECDC4] transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 pl-12 pr-4 py-3 bg-white border-2 border-gray-100 rounded-2xl focus:border-[#4ECDC4] outline-none transition-all font-bold text-gray-600 shadow-sm"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center p-24 gap-4">
                  <Loader2 className="w-16 h-16 animate-spin text-[#4ECDC4]" />
                  <p className="text-xl font-black text-gray-400 animate-pulse">Loading Contents...</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Folders Section */}
                  {folders.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      {folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((folder: DriveFile) => (
                        <PlaylistCard 
                          key={folder.id} 
                          folder={folder} 
                          onClick={() => fetchContents(folder)} 
                        />
                      ))}
                    </div>
                  )}

                  {/* Videos Section */}
                  {videos.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {videos.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase())).map((video: DriveFile) => (
                        <VideoCard 
                          key={video.id} 
                          video={video} 
                          onClick={() => playVideo(video)} 
                        />
                      ))}
                    </div>
                  )}

                  {folders.length === 0 && videos.length === 0 && (
                    <div className="col-span-full text-center p-12 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                      <p className="text-xl text-gray-400">This folder is empty.</p>
                    </div>
                  )}
                  
                  {searchQuery && folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && videos.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="col-span-full text-center p-12 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                      <p className="text-xl text-gray-400">No matches found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {view === 'player' && selectedVideo && (
            <motion.div 
              key="player"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-6 w-full"
            >
              <div 
                className="w-full max-h-[80vh] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 md:border-8 border-white relative group flex items-center justify-center"
                onMouseMove={handleMouseMove}
                onClick={togglePlay}
              >
                <video 
                  ref={videoRef}
                  key={selectedVideo.id}
                  src={`${RENDER_BASE.replace(/\/$/, '')}/api/drive/stream/${selectedVideo.id}`}
                  autoPlay
                  onTimeUpdate={handleVideoTimeUpdate}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onEnded={playNext}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="max-w-full max-h-full cursor-pointer"
                  playsInline
                />
                
                {/* Custom Controls Overlay */}
                <AnimatePresence>
                  {showControls && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 flex flex-col justify-between p-4 md:p-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Top Bar */}
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={goBack}
                          className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md transition-colors"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <h4 className="text-white font-bold truncate max-w-[60%] drop-shadow-md">{selectedVideo.name}</h4>
                        <div className="w-10" /> {/* Spacer */}
                      </div>

                      {/* Bottom Bar */}
                      <div className="space-y-4">
                        {/* Scrubber */}
                        <div className="flex items-center gap-3">
                          <span className="text-white text-xs font-mono w-10">{formatTime(currentTime)}</span>
                          <input 
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className="flex-1 h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#4ECDC4]"
                          />
                          <span className="text-white text-xs font-mono w-10">{formatTime(duration)}</span>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 md:gap-8">
                            <button onClick={playPrevious} className="text-white hover:text-[#4ECDC4] transition-colors">
                              <SkipBack className="w-6 h-6 md:w-8 md:h-8 fill-current" />
                            </button>
                            <button onClick={skipBackward} className="text-white hover:text-[#FF6B6B] transition-colors">
                              <RotateCcw className="w-6 h-6 md:w-8 md:h-8" />
                            </button>
                            <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                              {isPlaying ? <Pause className="w-8 h-8 md:w-10 md:h-10 fill-current" /> : <Play className="w-8 h-8 md:w-10 md:h-10 fill-current" />}
                            </button>
                            <button onClick={skipForward} className="text-white hover:text-[#FF6B6B] transition-colors">
                              <RotateCw className="w-6 h-6 md:w-8 md:h-8" />
                            </button>
                            <button onClick={playNext} className="text-white hover:text-[#4ECDC4] transition-colors">
                              <SkipForward className="w-6 h-6 md:w-8 md:h-8 fill-current" />
                            </button>
                          </div>

                          <div className="flex items-center gap-4">
                            <button onClick={toggleMute} className="text-white hover:text-[#4ECDC4] transition-colors">
                              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                            </button>
                            <button onClick={toggleFullscreen} className="text-white hover:text-[#4ECDC4] transition-colors">
                              <Maximize className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-full flex flex-col items-center gap-2 px-4">
                <div className="px-6 py-2 bg-white shadow-sm rounded-full border-2 border-[#4ECDC4]/20">
                  <span className="font-black text-[#4ECDC4]">
                    Video {videos.findIndex(v => v.id === selectedVideo.id) + 1} of {videos.length}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-black text-center text-[#4A4A4A] mt-2">{selectedVideo.name}</h3>
              </div>
            </motion.div>
          )}

          {view === 'games' && (
            <motion.div 
              key="games"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center h-full gap-8 pt-12"
            >
              <div className="text-center space-y-4">
                <div className="relative">
                  <Gamepad2 className="w-48 h-48 mx-auto text-[#FF6B6B]" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-4 border-dashed border-[#FF6B6B]/20 rounded-full"
                  />
                </div>
                <h2 className="text-4xl font-black text-[#FF6B6B]">Games Coming Soon!</h2>
                <p className="text-xl text-gray-500 max-w-md mx-auto">
                  We are building some super fun puzzles and coloring games for you. Stay tuned!
                </p>
              </div>
              <button 
                onClick={() => setView('menu')}
                className="px-12 py-4 bg-[#FF6B6B] text-white rounded-full font-black text-2xl shadow-xl hover:bg-[#FF5252] transition-all active:scale-95"
              >
                Go Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Version Info & Dual-Server Tracker */}
      <div className="p-2 pb-4 text-[10px] text-gray-400 text-center font-mono space-y-1">
        <div>v1.4 | Platform: {Capacitor.getPlatform()}</div>
        {Capacitor.getPlatform() !== 'web' && (
          <div className="flex flex-col items-center gap-1 text-[9px] text-gray-500">
            <div className="flex justify-center gap-x-3">
              <span>Directories (Vercel): <span className={vercelStatus === 'online' ? 'text-[#4ECDC4] font-bold' : vercelStatus === 'loading' ? 'text-yellow-400 font-bold' : 'text-[#FF6B6B] font-bold'}>{vercelStatus.toUpperCase()}</span></span>
              <span>•</span>
              <span>Streaming (Render): <span className={
                backendStatus === 'online' 
                  ? 'text-[#4ECDC4] font-bold' 
                  : backendStatus === 'waking' 
                    ? 'text-yellow-400 animate-pulse font-bold' 
                    : 'text-[#FF6B6B] font-bold'
              }>{backendStatus.toUpperCase()}</span></span>
            </div>
            {backendStatus === 'waking' && (
              <p className="text-[#FF6B6B] animate-pulse">Render Server is waking up in background... (40-50s) Folders are fully active!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const MenuButton: React.FC<{ icon: React.ReactNode, label: string, color: string, onClick: () => void }> = ({ icon, label, color, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-12 rounded-[60px] text-white transition-all shadow-2xl hover:scale-105 active:scale-95 border-b-8 border-black/20",
        color
      )}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {icon}
      </motion.div>
      <span className="mt-8 text-5xl font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

const PlaylistCard: React.FC<{ folder: DriveFile, onClick: () => void }> = ({ folder, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-4 p-6 bg-white rounded-[40px] shadow-lg hover:shadow-xl transition-all hover:-translate-y-2 border-b-4 border-gray-100 w-full"
    >
      <div className="w-full aspect-square bg-[#FFE66D] rounded-[30px] flex items-center justify-center shadow-inner overflow-hidden">
        <Folder className="w-16 h-16 text-white" />
      </div>
      <span className="font-black text-xl text-center line-clamp-2 text-[#4A4A4A] h-14 flex items-center justify-center">{folder.name}</span>
    </button>
  );
}

const VideoCard: React.FC<{ video: DriveFile, onClick: () => void }> = ({ video, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col bg-white rounded-[40px] shadow-lg hover:shadow-xl transition-all text-left w-full group border-b-4 border-gray-100 overflow-hidden"
    >
      <div className="relative w-full aspect-video bg-gray-100 flex-shrink-0 shadow-inner overflow-hidden">
        {video.thumbnailLink ? (
          <img 
            src={video.thumbnailLink.replace('=s220', '=s600')} 
            alt="" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#4ECDC4] to-[#45B7AF]">
            <Play className="w-16 h-16 text-white/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
      </div>
      <div className="p-6">
        <span className="font-black text-xl line-clamp-2 text-[#4A4A4A] leading-tight group-hover:text-[#4ECDC4] transition-colors h-14 flex items-start">{video.name}</span>
        <div className="mt-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4ECDC4]" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cartoon Movie</span>
        </div>
      </div>
    </button>
  );
}

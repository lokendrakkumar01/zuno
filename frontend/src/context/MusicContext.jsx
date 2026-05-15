import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const MusicContext = createContext();

export const MusicProvider = ({ children }) => {
      const [currentTrack, setCurrentTrack] = useState(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [progress, setProgress] = useState(0);
      const [duration, setDuration] = useState(0);
      const [queue, setQueue] = useState([]);
      const [queueIndex, setQueueIndex] = useState(-1);
      const [repeat, setRepeat] = useState(false);
      const [shuffle, setShuffle] = useState(false);
      const audioRef = useRef(new Audio());
      const queueRef = useRef([]);
      const queueIndexRef = useRef(-1);
      const repeatRef = useRef(false);
      const shuffleRef = useRef(false);
      const currentTrackRef = useRef(null);

      useEffect(() => { queueRef.current = queue; }, [queue]);
      useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
      useEffect(() => { repeatRef.current = repeat; }, [repeat]);
      useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);

      useEffect(() => {
            const audio = audioRef.current;

            const handlePlay = () => setIsPlaying(true);
            const handlePause = () => setIsPlaying(false);
            const handleTimeUpdate = () => setProgress(audio.currentTime || 0);
            const handleLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
            const handleEnded = () => {
                  setIsPlaying(false);
                  if (repeatRef.current) {
                        audio.currentTime = 0;
                        audio.play().catch(() => setIsPlaying(false));
                        return;
                  }

                  const nextQueue = queueRef.current;
                  if (nextQueue.length > 1) {
                        const nextIndex = shuffleRef.current
                              ? Math.floor(Math.random() * nextQueue.length)
                              : (queueIndexRef.current + 1) % nextQueue.length;
                        const nextTrack = nextQueue[nextIndex];
                        setQueueIndex(nextIndex);
                        currentTrackRef.current = nextTrack;
                        setCurrentTrack(nextTrack);
                        audio.src = nextTrack.previewUrl;
                        audio.currentTime = 0;
                        audio.play().catch(() => setIsPlaying(false));
                        return;
                  }

                  setCurrentTrack(null);
                  currentTrackRef.current = null;
            };
            const handleError = (e) => {
                  console.error("Audio playback error:", e);
                  setIsPlaying(false);
                  setCurrentTrack(null);
            };

            audio.addEventListener('play', handlePlay);
            audio.addEventListener('pause', handlePause);
            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('error', handleError);

            return () => {
                  audio.removeEventListener('play', handlePlay);
                  audio.removeEventListener('pause', handlePause);
                  audio.removeEventListener('timeupdate', handleTimeUpdate);
                  audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
                  audio.removeEventListener('ended', handleEnded);
                  audio.removeEventListener('error', handleError);
            };
      }, []);

      const playTrack = useCallback((track, nextQueue = []) => {
            if (!track?.previewUrl) {
                  import('react-toastify').then(({ toast }) => {
                        toast.info('No audio preview available for this track', {
                              position: "bottom-center",
                              autoClose: 2000,
                              hideProgressBar: true,
                        });
                  });
                  return;
            }

            const audio = audioRef.current;
            const normalizedQueue = Array.isArray(nextQueue) && nextQueue.length > 0 ? nextQueue : [track];
            const nextIndex = Math.max(0, normalizedQueue.findIndex((item) => item.trackId === track.trackId));
            setQueue(normalizedQueue);
            setQueueIndex(nextIndex);

            // Toggle play/pause for same track
            if (currentTrackRef.current?.trackId === track.trackId) {
                  if (!audio.paused) {
                        audio.pause();
                  } else {
                        audio.play().catch((err) => {
                              console.warn('Resume failed:', err.message);
                              setIsPlaying(false);
                        });
                  }
                  return;
            }

            // Stop current track cleanly - NO setTimeout (breaks browser gesture policy)
            audio.pause();

            // Set new source and play SYNCHRONOUSLY within the user gesture
            audio.src = track.previewUrl;
            audio.volume = 0.85;
            audio.currentTime = 0;
            setProgress(0);
            setDuration(0);

            // Update track state immediately so UI reflects change
            currentTrackRef.current = track;
            setCurrentTrack(track);

            // play() must be called synchronously here - no delay
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                  playPromise.catch((err) => {
                        console.warn('Playback error:', err.name, err.message);
                        setIsPlaying(false);
                  });
            }
      }, []);

      const stopTrack = useCallback(() => {
            audioRef.current.pause();
            audioRef.current.src = "";
            currentTrackRef.current = null;
            setCurrentTrack(null);
            setIsPlaying(false);
            setProgress(0);
            setDuration(0);
      }, []);

      const togglePlay = useCallback(() => {
            if (audioRef.current.paused) {
                  audioRef.current.play().catch(() => setIsPlaying(false));
            } else {
                  audioRef.current.pause();
            }
      }, []);

      const seekTo = useCallback((value) => {
            const nextTime = Number(value) || 0;
            audioRef.current.currentTime = nextTime;
            setProgress(nextTime);
      }, []);

      const playByIndex = useCallback((nextIndex) => {
            const nextTrack = queueRef.current[nextIndex];
            if (!nextTrack?.previewUrl) return;
            setQueueIndex(nextIndex);
            currentTrackRef.current = nextTrack;
            setCurrentTrack(nextTrack);
            audioRef.current.pause();
            audioRef.current.src = nextTrack.previewUrl;
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => setIsPlaying(false));
      }, []);

      const playNext = useCallback(() => {
            if (!queueRef.current.length) return;
            const nextIndex = shuffleRef.current
                  ? Math.floor(Math.random() * queueRef.current.length)
                  : (queueIndexRef.current + 1) % queueRef.current.length;
            playByIndex(nextIndex);
      }, [playByIndex]);

      const playPrevious = useCallback(() => {
            if (!queueRef.current.length) return;
            const nextIndex = queueIndexRef.current <= 0
                  ? queueRef.current.length - 1
                  : queueIndexRef.current - 1;
            playByIndex(nextIndex);
      }, [playByIndex]);

      // Cleanup on unmount
      useEffect(() => {
            return () => {
                  audioRef.current.pause();
                  audioRef.current.src = "";
            };
      }, []);

      return (
            <MusicContext.Provider value={{
                  currentTrack,
                  playTrack,
                  stopTrack,
                  togglePlay,
                  playNext,
                  playPrevious,
                  seekTo,
                  isPlaying,
                  audioRef,
                  progress,
                  duration,
                  queue,
                  repeat,
                  shuffle,
                  setRepeat,
                  setShuffle
            }}>
                  {children}
                  {currentTrack && (
                        <div className="zuno-mini-player">
                              {currentTrack.albumArt && <img src={currentTrack.albumArt} alt="" />}
                              <div className="zuno-mini-player__meta">
                                    <strong>{currentTrack.name}</strong>
                                    <span>{currentTrack.artist}</span>
                                    <input
                                          type="range"
                                          min="0"
                                          max={duration || 0}
                                          step="0.1"
                                          value={progress}
                                          onChange={(event) => seekTo(event.target.value)}
                                          aria-label="Seek song"
                                    />
                              </div>
                              <div className="zuno-mini-player__controls">
                                    <button type="button" onClick={() => setShuffle((value) => !value)} className={shuffle ? 'active' : ''} aria-label="Shuffle">Shuf</button>
                                    <button type="button" onClick={playPrevious} aria-label="Previous">Prev</button>
                                    <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? 'Pause' : 'Play'}</button>
                                    <button type="button" onClick={playNext} aria-label="Next">Next</button>
                                    <button type="button" onClick={() => setRepeat((value) => !value)} className={repeat ? 'active' : ''} aria-label="Repeat">Rep</button>
                                    <button type="button" onClick={stopTrack} aria-label="Close player">Close</button>
                              </div>
                              <style>{`
                                    .zuno-mini-player {
                                          position: fixed;
                                          left: 50%;
                                          bottom: 14px;
                                          z-index: 1200;
                                          transform: translateX(-50%);
                                          width: min(720px, calc(100vw - 24px));
                                          display: grid;
                                          grid-template-columns: 48px minmax(0, 1fr) auto;
                                          align-items: center;
                                          gap: 12px;
                                          padding: 10px 12px;
                                          border: 1px solid rgba(255,255,255,0.18);
                                          border-radius: 12px;
                                          background: rgba(15, 23, 42, 0.92);
                                          color: white;
                                          box-shadow: 0 16px 44px rgba(0,0,0,0.35);
                                          backdrop-filter: blur(16px);
                                    }
                                    .zuno-mini-player img {
                                          width: 48px;
                                          height: 48px;
                                          border-radius: 8px;
                                          object-fit: cover;
                                    }
                                    .zuno-mini-player__meta {
                                          min-width: 0;
                                          display: grid;
                                          gap: 3px;
                                    }
                                    .zuno-mini-player__meta strong,
                                    .zuno-mini-player__meta span {
                                          overflow: hidden;
                                          text-overflow: ellipsis;
                                          white-space: nowrap;
                                    }
                                    .zuno-mini-player__meta span {
                                          color: rgba(255,255,255,0.72);
                                          font-size: 0.8rem;
                                    }
                                    .zuno-mini-player__meta input {
                                          width: 100%;
                                          accent-color: #8b5cf6;
                                    }
                                    .zuno-mini-player__controls {
                                          display: flex;
                                          gap: 6px;
                                          flex-wrap: wrap;
                                          justify-content: flex-end;
                                    }
                                    .zuno-mini-player__controls button {
                                          border: 1px solid rgba(255,255,255,0.18);
                                          border-radius: 8px;
                                          background: rgba(255,255,255,0.08);
                                          color: white;
                                          padding: 7px 9px;
                                          cursor: pointer;
                                    }
                                    .zuno-mini-player__controls button.active {
                                          background: linear-gradient(135deg, #7c3aed, #2563eb);
                                    }
                                    @media (max-width: 620px) {
                                          .zuno-mini-player {
                                                grid-template-columns: 40px minmax(0, 1fr);
                                          }
                                          .zuno-mini-player img {
                                                width: 40px;
                                                height: 40px;
                                          }
                                          .zuno-mini-player__controls {
                                                grid-column: 1 / -1;
                                                justify-content: stretch;
                                          }
                                          .zuno-mini-player__controls button {
                                                flex: 1;
                                          }
                                    }
                              `}</style>
                        </div>
                  )}
            </MusicContext.Provider>
      );
};

export const useMusic = () => {
      const context = useContext(MusicContext);
      if (!context) {
            throw new Error('useMusic must be used within a MusicProvider');
      }
      return context;
};

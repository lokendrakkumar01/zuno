import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const MusicContext = createContext();

export const MusicProvider = ({ children }) => {
      const [currentTrack, setCurrentTrack] = useState(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const audioRef = useRef(new Audio());

      useEffect(() => {
            const audio = audioRef.current;

            const handlePlay = () => setIsPlaying(true);
            const handlePause = () => setIsPlaying(false);
            const handleEnded = () => {
                  setIsPlaying(false);
                  if (!audio.loop) {
                        setCurrentTrack(null);
                  }
            };
            const handleError = (e) => {
                  console.error("Audio playback error:", e);
                  setIsPlaying(false);
                  setCurrentTrack(null);
            };

            audio.addEventListener('play', handlePlay);
            audio.addEventListener('pause', handlePause);
            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('error', handleError);

            return () => {
                  audio.removeEventListener('play', handlePlay);
                  audio.removeEventListener('pause', handlePause);
                  audio.removeEventListener('ended', handleEnded);
                  audio.removeEventListener('error', handleError);
            };
      }, []);

      const currentTrackRef = useRef(null);

      const playTrack = useCallback((track) => {
            if (!track?.previewUrl) return;

            const audio = audioRef.current;

            // Toggle play/pause for same track
            if (currentTrackRef.current?.trackId === track.trackId) {
                  if (!audio.paused) {
                        audio.pause();
                        return;
                  }
                  // Resume paused track
                  audio.play().catch(() => setIsPlaying(false));
                  return;
            }

            // Stop current and load new
            audio.pause();
            audio.src = '';

            // Small delay to ensure clean state before loading new source
            setTimeout(() => {
                  audio.src = track.previewUrl;
                  audio.loop = false;
                  audio.volume = 0.8;
                  audio.load();

                  const playPromise = audio.play();
                  if (playPromise !== undefined) {
                        playPromise
                              .then(() => {
                                    currentTrackRef.current = track;
                                    setCurrentTrack(track);
                              })
                              .catch((error) => {
                                    console.warn('Autoplay blocked or audio error:', error.name);
                                    // Still set the track so UI updates - user can click again
                                    currentTrackRef.current = track;
                                    setCurrentTrack(track);
                                    setIsPlaying(false);
                              });
                  }
            }, 50);

            currentTrackRef.current = track;
            setCurrentTrack(track);
      }, []);

      const stopTrack = useCallback(() => {
            audioRef.current.pause();
            audioRef.current.src = "";
            currentTrackRef.current = null;
            setCurrentTrack(null);
            setIsPlaying(false);
      }, []);

      const togglePlay = useCallback(() => {
            if (audioRef.current.paused) {
                  audioRef.current.play().catch(() => setIsPlaying(false));
            } else {
                  audioRef.current.pause();
            }
      }, []);

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
                  isPlaying,
                  audioRef
            }}>
                  {children}
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

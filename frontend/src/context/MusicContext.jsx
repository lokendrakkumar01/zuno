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

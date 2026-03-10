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
            if (!track || !track.previewUrl) return;

            // If it's the same track and already playing, do nothing
            if (currentTrackRef.current?.trackId === track.trackId && !audioRef.current.paused) {
                  return;
            }

            // Stop current audio
            audioRef.current.pause();

            // Start new audio
            audioRef.current.src = track.previewUrl;
            audioRef.current.loop = true;

            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                  playPromise.catch(error => {
                        console.log("Autoplay prevented or audio error:", error);
                        setIsPlaying(false);
                  });
            }

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

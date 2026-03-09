import { createContext, useContext, useState, useRef, useEffect } from 'react';

const MusicContext = createContext();

export const MusicProvider = ({ children }) => {
      const [currentTrack, setCurrentTrack] = useState(null);
      const audioRef = useRef(new Audio());

      const playTrack = (track) => {
            if (!track || !track.previewUrl) return;

            // If it's the same track and already playing, do nothing
            if (currentTrack?.trackId === track.trackId && !audioRef.current.paused) {
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
                  });
            }

            setCurrentTrack(track);
      };

      const stopTrack = () => {
            audioRef.current.pause();
            audioRef.current.src = "";
            setCurrentTrack(null);
      };

      const togglePlay = () => {
            if (audioRef.current.paused) {
                  audioRef.current.play();
            } else {
                  audioRef.current.pause();
            }
      };

      const isPlaying = currentTrack !== null && !audioRef.current.paused;

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

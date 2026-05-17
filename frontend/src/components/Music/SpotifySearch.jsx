import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
);

const MusicNoteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
  </svg>
);

const SpotifySearch = ({
  onSelect,
  selectedTrack,
  inputId,
  title = 'Add Music',
  helperText = 'Search a song and attach it to your post.',
  placeholder = 'Search for a song or artist...',
  emptyLabel = 'Type at least 3 letters to search music.',
  compact = false
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasTyped, setHasTyped] = useState(false);
  const [previewTrackId, setPreviewTrackId] = useState('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const { token } = useAuth();
  const previewAudioRef = useRef(null);
  const searchRunRef = useRef(0);

  useEffect(() => {
    if (selectedTrack?.name && !hasTyped) {
      setQuery(`${selectedTrack.name} - ${selectedTrack.artist || ''}`.trim());
    }
  }, [hasTyped, selectedTrack]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setResults([]);
      setError('Login required to search music.');
      return undefined;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      setLoading(false);
      setResults([]);
      setError('');
      return undefined;
    }

    // Show loading state immediately to improve perceived speed
    setLoading(true);

    const controller = new AbortController();
    const searchRun = searchRunRef.current + 1;
    searchRunRef.current = searchRun;
    const timeoutId = window.setTimeout(() => {
      searchTracks(trimmedQuery, controller.signal, searchRun);
    }, 250); // Reduced debounce for faster feel

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query, token]);

  // Cleanup audio on unmount
  useEffect(() => () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
    }
  }, []);

  const searchTracks = async (nextQuery, signal, searchRun) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/spotify/search?q=${encodeURIComponent(nextQuery)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal
      });
      const data = await res.json();

      if (data.success) {
        if (searchRun !== searchRunRef.current) return;
        const seen = new Set();
        const tracks = (data.data?.tracks || []).filter((track) => {
          if (!track?.trackId || seen.has(track.trackId)) return false;
          seen.add(track.trackId);
          return true;
        });
        setResults(tracks);
        if (tracks.length === 0 && nextQuery.length >= 3) {
          setError('No songs found. Try a different search.');
        }
      } else {
        if (searchRun !== searchRunRef.current) return;
        setResults([]);
        setError(data.message || 'Failed to search music.');
      }
    } catch (err) {
      if (err.name !== 'AbortError' && searchRun === searchRunRef.current) {
        setResults([]);
        setError('Connection error. Please try again.');
      }
    } finally {
      if (searchRun === searchRunRef.current) setLoading(false);
    }
  };

  // IMPORTANT: Must be synchronous (no async/await) to preserve browser gesture for audio.play()
  const togglePreview = (track) => {
    if (!track?.previewUrl) {
      setError('This track has no 30s preview available on Spotify. You can still select it.');
      setTimeout(() => setError(''), 4000);
      return;
    }

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.onplay = () => setIsPreviewPlaying(true);
      previewAudioRef.current.onpause = () => setIsPreviewPlaying(false);
      previewAudioRef.current.onended = () => {
        setIsPreviewPlaying(false);
        setPreviewTrackId('');
      };
    }

    const audio = previewAudioRef.current;

    // If same track — toggle pause/play
    if (previewTrackId === track.trackId) {
      if (!audio.paused) {
        audio.pause();
        setPreviewTrackId('');
      } else {
        audio.play().catch(() => setIsPreviewPlaying(false));
      }
      return;
    }

    // New track — stop current, load & play synchronously
    audio.pause();
    audio.src = track.previewUrl;
    audio.volume = 0.85;
    audio.currentTime = 0;
    setPreviewTrackId(track.trackId);

    // play() called synchronously within user click — required for browser autoplay policy
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch((err) => {
        console.warn('Preview blocked:', err.message);
        setPreviewTrackId('');
        setIsPreviewPlaying(false);
        setError('Preview blocked by browser. Try clicking again.');
        setTimeout(() => setError(''), 3000);
      });
    }
  };

  const handleSelect = (track) => {
    onSelect(track);
    setHasTyped(Boolean(track));
    setQuery(track?.name ? `${track.name} - ${track.artist || ''}`.trim() : '');
    setResults([]);
    // Stop preview when selecting
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewTrackId('');
    }
  };

  return (
    <div className={`spotify-shell ${compact ? 'spotify-compact' : ''}`}>
      {/* Header */}
      <div className="spotify-header">
        <div className="spotify-icon-badge">
          <MusicNoteIcon />
        </div>
        <div>
          <label className="spotify-label" htmlFor={inputId}>{title}</label>
          <p className="spotify-helper">{helperText}</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="spotify-input-wrap">
        <span className="spotify-input-prefix">🔍</span>
        <input
          id={inputId}
          type="text"
          className="spotify-input"
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          onChange={(e) => { setHasTyped(true); setQuery(e.target.value); }}
        />
        {loading && <span className="spotify-spinner"></span>}
        {query && (
          <button className="spotify-clear-x" onClick={() => { setQuery(''); setResults([]); setHasTyped(false); }}>✕</button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="spotify-error-msg">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Selected Track */}
      {selectedTrack && (
        <div className="spotify-selected">
          <img src={selectedTrack.albumArt || '/favicon.svg'} alt={selectedTrack.name} className="spotify-sel-art" />
          <div className="spotify-sel-info">
            <span className="spotify-sel-kicker">✅ Selected</span>
            <strong className="spotify-sel-name">{selectedTrack.name}</strong>
            <span className="spotify-sel-artist">{selectedTrack.artist}</span>
          </div>
          {selectedTrack.previewUrl && (
            <button
              type="button"
              className="spotify-mini-play"
              onClick={() => togglePreview(selectedTrack)}
            >
              {previewTrackId === selectedTrack.trackId && isPreviewPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}
          <button type="button" className="spotify-remove-btn" onClick={() => handleSelect(null)}>✕</button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="spotify-results">
          {results.map((track) => {
            const isActive = selectedTrack?.trackId === track.trackId;
            const isPreviewing = previewTrackId === track.trackId && isPreviewPlaying;
            const hasPreview = Boolean(track.previewUrl);

            return (
              <div
                key={track.trackId}
                className={`spotify-track ${isActive ? 'spotify-track-active' : ''}`}
              >
                <img src={track.albumArt || '/favicon.svg'} alt={track.name} className="spotify-track-art" />
                <div className="spotify-track-info">
                  <strong className="spotify-track-name">{track.name}</strong>
                  <span className="spotify-track-artist">{track.artist}</span>
                  {!hasPreview && <span className="spotify-no-preview">No preview</span>}
                </div>
                <div className="spotify-track-actions">
                  <button
                    type="button"
                    className={`spotify-play-btn ${!hasPreview ? 'spotify-play-disabled' : ''} ${isPreviewing ? 'spotify-play-active' : ''}`}
                    title={hasPreview ? (isPreviewing ? 'Pause preview' : 'Play 30s preview') : 'No preview available'}
                    onClick={(e) => { e.stopPropagation(); togglePreview(track); }}
                  >
                    {isPreviewing ? <PauseIcon /> : <PlayIcon />}
                  </button>
                  <button
                    type="button"
                    className={`spotify-select-btn ${isActive ? 'spotify-select-active' : ''}`}
                    onClick={() => handleSelect(isActive ? null : track)}
                  >
                    {isActive ? '✓ Selected' : 'Select'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && hasTyped && query.trim().length >= 3 && (
        <div className="spotify-empty">🎵 No tracks found. Try another search.</div>
      )}
      {!loading && !error && results.length === 0 && !hasTyped && (
        <div className="spotify-empty">{emptyLabel}</div>
      )}

      <style>{`
        .spotify-shell {
          display: flex; flex-direction: column; gap: 12px;
        }
        .spotify-header {
          display: flex; align-items: flex-start; gap: 12px;
        }
        .spotify-icon-badge {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #1db954, #0d7a38);
          display: flex; align-items: center; justify-content: center;
          color: white; flex-shrink: 0;
        }
        .spotify-label {
          display: block; font-size: 0.9rem; font-weight: 700;
          color: var(--color-text-primary); margin-bottom: 2px;
        }
        .spotify-helper {
          margin: 0; font-size: 0.78rem; color: var(--color-text-muted);
        }
        .spotify-input-wrap {
          display: flex; align-items: center; gap: 8px;
          background: var(--color-bg-secondary);
          border: 1.5px solid var(--color-border);
          border-radius: 12px; padding: 4px 12px;
          transition: all 0.2s ease;
        }
        .spotify-input-wrap:focus-within {
          border-color: #1db954;
          box-shadow: 0 0 0 3px rgba(29,185,84,0.12);
          background: var(--color-bg-primary);
        }
        .spotify-input-prefix { font-size: 1rem; flex-shrink: 0; }
        .spotify-input {
          flex: 1; border: none; background: transparent; outline: none;
          font-size: 0.9rem; color: var(--color-text-primary);
          padding: 8px 0; font-family: var(--font-family);
        }
        .spotify-input::placeholder { color: var(--color-text-muted); }
        .spotify-spinner {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid var(--color-border);
          border-top-color: #1db954;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spotify-clear-x {
          background: none; border: none; cursor: pointer;
          color: var(--color-text-muted); font-size: 0.85rem;
          padding: 4px; border-radius: 4px; line-height: 1;
        }
        .spotify-clear-x:hover { color: var(--color-text-primary); }
        .spotify-error-msg {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.8rem; color: #b45309;
          background: #fffbeb; border: 1px solid #fde68a;
          border-radius: 8px; padding: 8px 12px;
        }
        .spotify-selected {
          display: flex; align-items: center; gap: 10px;
          background: rgba(29,185,84,0.08);
          border: 1.5px solid rgba(29,185,84,0.3);
          border-radius: 12px; padding: 10px 12px;
        }
        .spotify-sel-art {
          width: 44px; height: 44px; border-radius: 8px; object-fit: cover;
        }
        .spotify-sel-info { flex: 1; min-width: 0; }
        .spotify-sel-kicker { display: block; font-size: 0.7rem; color: #1db954; font-weight: 700; }
        .spotify-sel-name { display: block; font-size: 0.88rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spotify-sel-artist { display: block; font-size: 0.77rem; color: var(--color-text-muted); }
        .spotify-mini-play, .spotify-remove-btn {
          background: none; border: none; cursor: pointer;
          padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease;
        }
        .spotify-mini-play { background: rgba(29,185,84,0.15); color: #1db954; }
        .spotify-mini-play:hover { background: rgba(29,185,84,0.3); }
        .spotify-remove-btn { color: var(--color-text-muted); font-size: 0.8rem; }
        .spotify-remove-btn:hover { background: #fee2e2; color: #dc2626; }
        .spotify-results {
          display: flex; flex-direction: column; gap: 4px;
          max-height: 320px; overflow-y: auto;
          border-radius: 12px; border: 1px solid var(--color-border-light);
          background: var(--color-bg-card);
        }
        .spotify-track {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--color-border-light);
          transition: background 0.15s ease;
        }
        .spotify-track:last-child { border-bottom: none; }
        .spotify-track:hover { background: var(--color-bg-hover); }
        .spotify-track-active { background: rgba(29,185,84,0.06) !important; }
        .spotify-track-art {
          width: 42px; height: 42px; border-radius: 6px; object-fit: cover; flex-shrink: 0;
        }
        .spotify-track-info { flex: 1; min-width: 0; }
        .spotify-track-name {
          display: block; font-size: 0.87rem; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .spotify-track-artist {
          display: block; font-size: 0.77rem; color: var(--color-text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .spotify-no-preview {
          display: inline-block; font-size: 0.68rem; color: #9ca3af;
          background: #f3f4f6; border-radius: 4px; padding: 1px 5px; margin-top: 2px;
        }
        .spotify-track-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .spotify-play-btn {
          width: 30px; height: 30px; border-radius: 50%; border: none;
          background: rgba(29,185,84,0.12); color: #1db954;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease;
        }
        .spotify-play-btn:hover { background: rgba(29,185,84,0.25); transform: scale(1.08); }
        .spotify-play-active { background: #1db954 !important; color: white !important; }
        .spotify-play-disabled { opacity: 0.35; cursor: not-allowed; }
        .spotify-select-btn {
          font-size: 0.78rem; font-weight: 600; padding: 5px 10px;
          border-radius: 20px; border: 1.5px solid var(--color-border);
          background: var(--color-bg-secondary); color: var(--color-text-primary);
          cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
        }
        .spotify-select-btn:hover { border-color: #1db954; color: #1db954; }
        .spotify-select-active { background: #1db954 !important; color: white !important; border-color: #1db954 !important; }
        .spotify-empty {
          text-align: center; padding: 20px; font-size: 0.85rem;
          color: var(--color-text-muted);
        }
        @media (max-width: 480px) {
          .spotify-select-btn span { display: none; }
        }
      `}</style>
    </div>
  );
};

export default SpotifySearch;

import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';

const SpotifySearch = ({
      onSelect,
      selectedTrack,
      inputId,
      title = 'Add Music',
      helperText = 'Search a song, preview it, then attach it to your profile.',
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
      const { token } = useAuth();
      const previewAudioRef = useRef(null);

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

            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => {
                  searchTracks(trimmedQuery, controller.signal);
            }, 350);

            return () => {
                  controller.abort();
                  window.clearTimeout(timeoutId);
            };
      }, [query, token]);

      useEffect(() => () => {
            if (previewAudioRef.current) {
                  previewAudioRef.current.pause();
                  previewAudioRef.current.src = '';
            }
      }, []);

      const searchTracks = async (nextQuery, signal) => {
            setLoading(true);
            setError('');

            try {
                  const res = await fetch(`${API_URL}/spotify/search?q=${encodeURIComponent(nextQuery)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        signal
                  });
                  const data = await res.json();

                  if (data.success) {
                        setResults(data.data?.tracks || []);
                  } else {
                        setResults([]);
                        setError(data.message || 'Failed to search music.');
                  }
            } catch (err) {
                  if (err.name !== 'AbortError') {
                        setResults([]);
                        setError('Connection error while searching music.');
                  }
            } finally {
                  setLoading(false);
            }
      };

      const togglePreview = async (track) => {
            if (!track?.previewUrl) return;

            if (!previewAudioRef.current) {
                  previewAudioRef.current = new Audio();
            }

            const audio = previewAudioRef.current;

            if (previewTrackId === track.trackId && !audio.paused) {
                  audio.pause();
                  setPreviewTrackId('');
                  return;
            }

            try {
                  audio.pause();
                  audio.src = track.previewUrl;
                  audio.currentTime = 0;
                  await audio.play();
                  setPreviewTrackId(track.trackId);
                  audio.onended = () => setPreviewTrackId('');
            } catch {
                  setPreviewTrackId('');
                  setError('Preview could not be played on this device.');
            }
      };

      const handleSelect = (track) => {
            onSelect(track);
            setHasTyped(Boolean(track));
            setQuery(track?.name ? `${track.name} - ${track.artist || ''}`.trim() : '');
            setResults([]);
      };

      return (
            <div className={`spotify-search-container ${compact ? 'spotify-search-compact' : ''}`}>
                  <div className="input-group mb-md">
                        <label className="input-label spotify-search-label" htmlFor={inputId}>{title}</label>
                        <p className="spotify-search-helper">{helperText}</p>
                        <div className="spotify-search-input-shell">
                              <span className="spotify-search-input-icon">Music</span>
                              <input
                                    id={inputId}
                                    type="text"
                                    className="input spotify-search-input"
                                    placeholder={placeholder}
                                    value={query}
                                    autoComplete="off"
                                    onChange={(event) => {
                                          setHasTyped(true);
                                          setQuery(event.target.value);
                                    }}
                              />
                        </div>
                  </div>

                  {selectedTrack ? (
                        <div className="spotify-selected-track">
                              <div className="spotify-selected-art">
                                    <img src={selectedTrack.albumArt} alt={selectedTrack.name} />
                                    {selectedTrack.previewUrl ? (
                                          <button
                                                type="button"
                                                className="spotify-preview-btn"
                                                onClick={() => togglePreview(selectedTrack)}
                                          >
                                                {previewTrackId === selectedTrack.trackId ? 'Pause' : 'Preview'}
                                          </button>
                                    ) : null}
                              </div>
                              <div className="spotify-selected-copy">
                                    <span className="spotify-selected-kicker">Selected track</span>
                                    <strong>{selectedTrack.name}</strong>
                                    <span>{selectedTrack.artist}</span>
                              </div>
                              <button
                                    type="button"
                                    onClick={() => handleSelect(null)}
                                    className="btn btn-secondary btn-sm spotify-clear-btn"
                              >
                                    Remove
                              </button>
                        </div>
                  ) : null}

                  <div className="spotify-results-shell">
                        {loading ? <div className="text-sm text-muted mb-sm animate-pulse">Searching music...</div> : null}
                        {error ? <div className="text-sm text-red-500 mb-sm">{error}</div> : null}

                        {!loading && !error && results.length === 0 ? (
                              <div className="spotify-empty-state">
                                    {hasTyped && query.trim().length >= 3 ? 'No songs found for this search.' : emptyLabel}
                              </div>
                        ) : null}

                        {results.length > 0 ? (
                              <div className="spotify-results-list">
                                    {results.map((track) => (
                                          <button
                                                key={track.trackId}
                                                type="button"
                                                className={`spotify-result-card ${selectedTrack?.trackId === track.trackId ? 'active' : ''}`}
                                                onClick={() => handleSelect(track)}
                                          >
                                                <img src={track.albumArt} alt={track.name} className="spotify-result-art" />
                                                <div className="spotify-result-copy">
                                                      <strong>{track.name}</strong>
                                                      <span>{track.artist}</span>
                                                      <small>{track.previewUrl ? 'Preview available' : 'No preview clip'}</small>
                                                </div>
                                                <span
                                                      className={`spotify-result-preview ${track.previewUrl ? '' : 'spotify-result-preview-disabled'}`}
                                                      onClick={(event) => {
                                                            if (!track.previewUrl) return;
                                                            event.stopPropagation();
                                                            togglePreview(track);
                                                      }}
                                                >
                                                      {track.previewUrl
                                                            ? (previewTrackId === track.trackId ? 'Pause' : 'Play')
                                                            : 'Select'}
                                                </span>
                                          </button>
                                    ))}
                              </div>
                        ) : null}
                  </div>
            </div>
      );
};

export default SpotifySearch;

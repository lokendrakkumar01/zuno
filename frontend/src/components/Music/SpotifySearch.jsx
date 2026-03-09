import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';

const SpotifySearch = ({ onSelect, selectedTrack }) => {
      const [query, setQuery] = useState('');
      const [results, setResults] = useState([]);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const { token } = useAuth();

      useEffect(() => {
            const delayDebounceFn = setTimeout(() => {
                  if (query.length > 2) {
                        searchTracks();
                  } else {
                        setResults([]);
                  }
            }, 500);

            return () => clearTimeout(delayDebounceFn);
      }, [query]);

      const searchTracks = async () => {
            setLoading(true);
            setError('');
            try {
                  const res = await fetch(`${API_URL}/spotify/search?q=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.success) {
                        setResults(data.data.tracks);
                  } else {
                        setError(data.message || 'Failed to search');
                  }
            } catch (err) {
                  setError('Connection error');
            }
            setLoading(false);
      };

      return (
            <div className="spotify-search-container">
                  <div className="input-group mb-md">
                        <label className="input-label">🎵 Add Music (Spotify)</label>
                        <div style={{ position: 'relative' }}>
                              <input
                                    type="text"
                                    className="input"
                                    placeholder="Search for a song or artist..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    style={{ paddingLeft: '2.5rem' }}
                              />
                              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
                        </div>
                  </div>

                  {loading && <div className="text-sm text-muted mb-sm animate-pulse">Searching Spotify...</div>}
                  {error && <div className="text-sm text-red-500 mb-sm">{error}</div>}

                  {selectedTrack && (
                        <div className="card p-sm mb-md flex items-center gap-sm bg-primary/5 border-primary/20 relative">
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <img src={selectedTrack.albumArt} alt="" style={{ width: '48px', height: '48px', borderRadius: '4px' }} />
                                    {selectedTrack.previewUrl && (
                                          <button
                                                className="absolute inset-0 flex items-center justify-center bg-black/30 text-white rounded-4px"
                                                onClick={() => {
                                                      const audio = document.getElementById('selected-track-audio');
                                                      if (audio.paused) {
                                                            audio.play();
                                                      } else {
                                                            audio.pause();
                                                      }
                                                }}
                                          >
                                                🎵
                                          </button>
                                    )}
                              </div>
                              <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{selectedTrack.name}</div>
                                    <div className="text-xs text-muted truncate">{selectedTrack.artist}</div>
                              </div>
                              {selectedTrack.previewUrl && (
                                    <audio
                                          id="selected-track-audio"
                                          src={selectedTrack.previewUrl}
                                          autoPlay
                                          loop
                                    />
                              )}
                              <button
                                    onClick={() => onSelect(null)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 8px', zIndex: 10 }}
                              >
                                    ✕
                              </button>
                        </div>
                  )}

                  {!selectedTrack && results.length > 0 && (
                        <div className="card max-h-60 overflow-y-auto mb-md" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                              {results.map(track => (
                                    <div
                                          key={track.trackId}
                                          className="p-sm flex items-center gap-sm hover:bg-gray-50 cursor-pointer border-b last:border-0 group"
                                          onClick={() => {
                                                onSelect(track);
                                                setResults([]);
                                                setQuery('');
                                          }}
                                    >
                                          <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <img src={track.albumArt} alt="" style={{ width: '44px', height: '44px', borderRadius: '6px' }} />
                                                {track.previewUrl && (
                                                      <button
                                                            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-6px text-white"
                                                            onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  const audio = new Audio(track.previewUrl);
                                                                  audio.play();
                                                                  // Stop after 5 seconds for preview
                                                                  setTimeout(() => audio.pause(), 5000);
                                                            }}
                                                      >
                                                            ▶️
                                                      </button>
                                                )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm truncate">{track.name}</div>
                                                <div className="text-xs text-muted truncate">{track.artist}</div>
                                          </div>
                                          <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">Select</div>
                                    </div>
                              ))}
                        </div>
                  )}
            </div>
      );
};

export default SpotifySearch;

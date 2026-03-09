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
                        <div className="card p-sm mb-md flex items-center gap-sm bg-primary/5 border-primary/20">
                              <img src={selectedTrack.albumArt} alt="" style={{ width: '48px', height: '48px', borderRadius: '4px' }} />
                              <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{selectedTrack.name}</div>
                                    <div className="text-xs text-muted truncate">{selectedTrack.artist}</div>
                              </div>
                              <button
                                    onClick={() => onSelect(null)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '4px 8px' }}
                              >
                                    ✕
                              </button>
                        </div>
                  )}

                  {!selectedTrack && results.length > 0 && (
                        <div className="card max-h-60 overflow-y-auto mb-md">
                              {results.map(track => (
                                    <div
                                          key={track.trackId}
                                          onClick={() => {
                                                onSelect(track);
                                                setResults([]);
                                                setQuery('');
                                          }}
                                          className="p-sm flex items-center gap-sm hover:bg-gray-50 cursor-pointer border-b last:border-0"
                                    >
                                          <img src={track.albumArt} alt="" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
                                          <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{track.name}</div>
                                                <div className="text-xs text-muted truncate">{track.artist}</div>
                                          </div>
                                    </div>
                              ))}
                        </div>
                  )}
            </div>
      );
};

export default SpotifySearch;

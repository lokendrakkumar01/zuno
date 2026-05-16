import { useMemo, useRef, useState } from 'react';
import SpotifySearch from '../components/Music/SpotifySearch';

const TRENDING = [
  { name: 'Focus Flow', artist: 'ZUNO Picks', albumArt: '', previewUrl: '', trackId: 'focus-flow' },
  { name: 'Evening Chill', artist: 'ZUNO Picks', albumArt: '', previewUrl: '', trackId: 'evening-chill' },
  { name: 'Workout Pulse', artist: 'ZUNO Picks', albumArt: '', previewUrl: '', trackId: 'workout-pulse' }
];

const PLAYLISTS = [
  { title: 'Study Mode', desc: 'Soft tracks for deep work', query: 'lofi study' },
  { title: 'Trending Reels', desc: 'High energy music for short videos', query: 'viral pop' },
  { title: 'Calm Stories', desc: 'Warm background music for statuses', query: 'acoustic chill' }
];

export default function Music() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [activePlaylist, setActivePlaylist] = useState(PLAYLISTS[0]);
  const audioRef = useRef(null);

  const heroTitle = useMemo(() => selectedTrack?.name || activePlaylist.title, [activePlaylist.title, selectedTrack]);

  const playSelected = () => {
    if (!selectedTrack?.previewUrl) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = selectedTrack.previewUrl;
    audioRef.current.volume = 0.8;
    audioRef.current.play().catch(() => undefined);
  };

  const pauseSelected = () => {
    audioRef.current?.pause();
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 110 }}>
      <section className="card" style={{ display: 'grid', gap: 18, overflow: 'hidden', background: 'linear-gradient(135deg,#0f172a,#2563eb)', color: 'white' }}>
        <span style={{ opacity: 0.75, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Enjoy Free Songs</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 4rem)' }}>{heroTitle}</h1>
        <p style={{ maxWidth: 640, opacity: 0.84 }}>Search tracks, preview music, and reuse songs in stories, status updates, profiles, and creative posts.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" type="button" onClick={playSelected} disabled={!selectedTrack?.previewUrl}>Play Preview</button>
          <button className="btn btn-secondary" type="button" onClick={pauseSelected}>Pause</button>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="grid grid-3" style={{ gap: 16 }}>
          {PLAYLISTS.map((playlist) => (
            <button
              type="button"
              key={playlist.title}
              className="card"
              onClick={() => setActivePlaylist(playlist)}
              style={{ textAlign: 'left', borderColor: activePlaylist.title === playlist.title ? '#2563eb' : undefined }}
            >
              <strong>{playlist.title}</strong>
              <p className="text-muted" style={{ margin: '6px 0 0' }}>{playlist.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <SpotifySearch
          inputId="music-page-search"
          selectedTrack={selectedTrack}
          onSelect={setSelectedTrack}
          title="Search songs"
          helperText={`Try "${activePlaylist.query}" or any artist, song, or soundtrack.`}
          placeholder={`Search ${activePlaylist.query}...`}
          emptyLabel="Search songs and preview tracks here."
        />
      </section>

      <section className="section" style={{ paddingTop: 24 }}>
        <div className="search-section-head">
          <div>
            <span className="search-section-kicker">Trending now</span>
            <h2>Quick moods</h2>
          </div>
        </div>
        <div className="grid grid-3" style={{ gap: 16 }}>
          {TRENDING.map((track) => (
            <button key={track.trackId} type="button" className="card" onClick={() => setSelectedTrack(track)} style={{ textAlign: 'left' }}>
              <strong>{track.name}</strong>
              <p className="text-muted" style={{ margin: '6px 0 0' }}>{track.artist}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

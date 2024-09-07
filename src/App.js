import React, { useState, useEffect } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import './App.css';

const spotifyApi = new SpotifyWebApi();

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [error, setError] = useState(null);
  const [searchFilters, setSearchFilters] = useState({
    song: true,
    artist: true,
    album: true
  });
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [playlistAnalysis, setPlaylistAnalysis] = useState([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [playlistsToAnalyze, setPlaylistsToAnalyze] = useState([]);
  const [showAnalysisSelection, setShowAnalysisSelection] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  useEffect(() => {
    document.title = "Playlist Index";
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      spotifyApi.setAccessToken(token);
      setLoggedIn(true);
      fetchPlaylists();
    }
  }, []);

  const handleLogin = () => {
    const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
    const redirectUri = 'https://Aditya-Agarwal2006.github.io/playlist-index/';
    const scopes = [
      'user-read-private',
      'playlist-read-private',
      'playlist-read-collaborative'
    ];
    const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&response_type=token&show_dialog=true`;
    window.location = url;
  };

  const analyzePlaylist = async (playlist) => {
    try {
      let allTracks = [];
      let offset = 0;
      const limit = 100;
      let totalTracks = 0;

      do {
        const response = await spotifyApi.getPlaylistTracks(playlist.id, { offset, limit });
        allTracks = allTracks.concat(response.items);
        offset += limit;
        totalTracks = response.total;
      } while (allTracks.length < totalTracks);

      const analysis = {
        id: playlist.id,
        name: playlist.name,
        trackCount: allTracks.length,
        totalDuration: allTracks.reduce((sum, item) => sum + (item.track ? item.track.duration_ms : 0), 0),
        averagePopularity: allTracks.reduce((sum, item) => sum + (item.track ? item.track.popularity : 0), 0) / allTracks.length,
        recentlyAdded: allTracks
          .filter(item => item.track)
          .sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
          .slice(0, 5)
          .map(item => ({
            name: item.track.name,
            artist: item.track.artists[0].name,
            addedAt: new Date(item.added_at).toLocaleDateString()
          })),
        uniqueArtists: new Set(allTracks.flatMap(item => item.track ? item.track.artists.map(artist => artist.name) : [])).size,
        genres: await getPlaylistGenres(allTracks)
      };
      return analysis;
    } catch (error) {
      console.error(`Error analyzing playlist ${playlist.name}:`, error);
      return null;
    }
  };

  const getPlaylistGenres = async (tracks) => {
    const artistIds = [...new Set(tracks.flatMap(item => item.track.artists.map(artist => artist.id)))];
    const artistsData = await Promise.all(
      artistIds.map(id => spotifyApi.getArtist(id))
    );
    const genres = artistsData.flatMap(artist => artist.genres);
    const genreCounts = genres.reduce((acc, genre) => {
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));
  };

  const fetchPlaylists = async () => {
    try {
      const data = await spotifyApi.getUserPlaylists();
      console.log('Fetched playlists:', data);
      setPlaylists(data.items);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      if (error.status === 401) {
        setError('Authentication failed. Please try logging in again.');
      } else {
        setError(`Failed to fetch playlists: ${error.message}`);
      }
    }
  };

  const analyzeSelectedPlaylists = async () => {
    const analysisResults = [];
    for (let i = 0; i < playlistsToAnalyze.length; i++) {
      try {
        const playlist = playlists.find(p => p.id === playlistsToAnalyze[i]);
        if (!playlist) {
          console.error(`Playlist with id ${playlistsToAnalyze[i]} not found`);
          continue;
        }
        const analysis = await analyzePlaylist(playlist);
        if (analysis) {
          analysisResults.push(analysis);
          setPlaylistAnalysis([...analysisResults]);
        }
        console.log(`Analyzed playlist: ${playlist.name}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error analyzing playlist:`, error);
      }
    }
    console.log('Playlist analysis completed:', analysisResults);
  };

  const handleSearch = async () => {
    if (searchQuery) {
      try {
        const allTracks = new Map();
        
        await Promise.all(playlists.map(async (playlist) => {
          try {
            const tracks = await spotifyApi.getPlaylistTracks(playlist.id);
            tracks.items
              .filter(item => item.track && item.track.name)
              .filter(item => {
                const songMatch = searchFilters.song && item.track.name.toLowerCase().includes(searchQuery.toLowerCase());
                const artistMatch = searchFilters.artist && item.track.artists.some(artist => 
                  artist.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
                const albumMatch = searchFilters.album && item.track.album.name.toLowerCase().includes(searchQuery.toLowerCase());
                return songMatch || artistMatch || albumMatch;
              })
              .forEach(item => {
                const track = item.track;
                if (!allTracks.has(track.id)) {
                  allTracks.set(track.id, {
                    id: track.id,
                    name: track.name,
                    artists: track.artists.map(artist => artist.name).join(', '),
                    album: track.album.name,
                    popularity: track.popularity,
                    playlists: []
                  });
                }
                allTracks.get(track.id).playlists.push({
                  name: playlist.name,
                  addedAt: item.added_at,
                  owner: playlist.owner.display_name
                });
              });
          } catch (error) {
            console.error(`Error fetching tracks for playlist ${playlist.name}:`, error);
          }
        }));
        
        setSearchResults(Array.from(allTracks.values()));
      } catch (error) {
        console.error('Error during search:', error);
        setError('An error occurred during the search. Please try again.');
      }
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleFilterChange = (filter) => {
    setSearchFilters(prevFilters => ({
      ...prevFilters,
      [filter]: !prevFilters[filter]
    }));
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  const PlaylistAnalysis = ({ analysis, totalPlaylists }) => (
    <div className="analysis-container">
      <h2>Playlist Analysis</h2>
      <p>Analyzed {analysis.filter(Boolean).length} out of {totalPlaylists} playlists</p>
      {analysis.length === 0 ? (
        <p>Loading playlist analysis...</p>
      ) : (
        analysis.map((playlist, index) => (
          <div key={index} className="playlist-analysis">
            {playlist ? (
              <>
                <h3>{playlist.name}</h3>
                <p>Tracks: {playlist.trackCount}</p>
                <p>Total Duration: {formatDuration(playlist.totalDuration)}</p>
                <p>Average Popularity: {playlist.averagePopularity.toFixed(2)}%</p>
                <p>Unique Artists: {playlist.uniqueArtists}</p>
                <div>
                  <h4>Top Genres:</h4>
                  <ul>
                    {playlist.genres.map((genre, index) => (
                      <li key={index}>{genre.genre} ({genre.count} tracks)</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Recently Added Tracks:</h4>
                  <ul>
                    {playlist.recentlyAdded.map((track, index) => (
                      <li key={index}>{track.name} by {track.artist} (Added: {track.addedAt})</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p>Analyzing...</p>
            )}
          </div>
        ))
      )}
    </div>
  );

  const PlaylistSelectionModal = ({ playlists, onSelect, onClose }) => (
    <div className="modal">
      <div className="modal-content">
        <h2>Select Playlists to Analyze</h2>
        {playlists.map(playlist => (
          <label key={playlist.id} className="playlist-checkbox">
            <input
              type="checkbox"
              onChange={(e) => onSelect(playlist.id, e.target.checked)}
            />
            {playlist.name}
          </label>
        ))}
        <button onClick={onClose}>Analyze Selected Playlists</button>
      </div>
    </div>
  );

  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <header className="app-header">
        <h1>Playlist Index</h1>
      </header>
      <button className="theme-toggle" onClick={toggleTheme}>
        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      <button className="analysis-toggle" onClick={() => setShowAnalysisSelection(true)}>
        Analyze Playlists
      </button>
      {showAnalysisSelection && (
        <PlaylistSelectionModal
          playlists={playlists}
          onSelect={(id, isSelected) => {
            setPlaylistsToAnalyze(prev => 
              isSelected ? [...prev, id] : prev.filter(playlistId => playlistId !== id)
            );
          }}
          onClose={() => {
            setShowAnalysisSelection(false);
            analyzeSelectedPlaylists();
            setShowAnalysis(true);
          }}
        />
      )}
      {!loggedIn ? (
        <div className="login-container">
          <button className="login-button" onClick={handleLogin}>Login with Spotify</button>
        </div>
      ) : (
        <div className="main-content">
          <div className="search-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter a song, artist, or album name"
              className="search-input"
            />
            <button className="search-button" onClick={handleSearch}>Search</button>
          </div>
          <div className="filter-container">
            <label className="filter-label">
              <input
                type="checkbox"
                checked={searchFilters.song}
                onChange={() => handleFilterChange('song')}
              />
              Song
            </label>
            <label className="filter-label">
              <input
                type="checkbox"
                checked={searchFilters.artist}
                onChange={() => handleFilterChange('artist')}
              />
              Artist
            </label>
            <label className="filter-label">
              <input
                type="checkbox"
                checked={searchFilters.album}
                onChange={() => handleFilterChange('album')}
              />
              Album
            </label>
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="results-container">
            {searchResults && searchResults.length > 0 ? (
              <>
                <p className="popularity-explanation">Popularity Score: This score is calculated by Spotify based on the total number of plays the track has had and how recent those plays are. The higher the percentage, the more popular the song is on Spotify.</p>
                {searchResults.map((track) => (
                  <div key={track.id} className="track-card">
                    <h3 className="track-title">{track.name}</h3>
                    <p className="track-artist">by {track.artists}</p>
                    <p className="track-album">Album: {track.album}</p>
                    <p className="track-popularity">Popularity: {track.popularity}%</p>
                    <h4 className="playlist-header">Appears in these playlists:</h4>
                    <ul className="playlist-list">
                      {track.playlists.map((playlist, index) => (
                        <li key={index} className="playlist-item">
                          <span className="playlist-name">{playlist.name}</span>
                          <span className="playlist-details">
                            {' '}  {/* This adds a space */}
                            Added on: {new Date(playlist.addedAt).toLocaleDateString()} | Created by: {playlist.owner}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            ) : (
              <p className="no-results">No results found</p>
            )}
          </div>
          {showAnalysis && <PlaylistAnalysis analysis={playlistAnalysis} totalPlaylists={playlists.length} />}
        </div>
      )}
    </div>
  );
}

export default App;
import React, { useState, useEffect } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import './App.css'; // Make sure to create this file

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

  useEffect(() => {
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
    const redirectUri = 'https://Aditya-Agarwal2006.github.io/playlist-index/callback/';
    const scopes = [
      'user-read-private',
      'playlist-read-private',
      'playlist-read-collaborative'
    ];
    const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&response_type=token&show_dialog=true`;
    window.location = url;
  };

  const fetchPlaylists = async () => {
    try {
      const data = await spotifyApi.getUserPlaylists();
      setPlaylists(data.items);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      setError('Failed to fetch playlists. Please try logging in again.');
    }
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>Playlist Index</h1>
      </header>
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
        </div>
      )}
    </div>
  );
}

export default App;

// K_M 6PNTR
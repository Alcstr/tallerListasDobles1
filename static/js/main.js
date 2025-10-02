let youtubePlayer;
let localPlayer;
let currentUser = null;

function onYouTubeIframeAPIReady() {
    youtubePlayer = new YT.Player('youtube-player', {
        height: '100%', width: '100%', videoId: '',
        playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1 },
        events: { 'onStateChange': onPlayerStateChange, 'onError': onPlayerError }
    });
}

function onPlayerStateChange(event) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (event.data === YT.PlayerState.PLAYING) {
        playPauseBtn.textContent = '⏸';
    } else {
        playPauseBtn.textContent = '▶️';
    }
}

function onPlayerError(event) {
    console.error("YouTube Player Error:", event.data);
    alert("This video is unavailable. Please try another one.");
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results-container');
    const queueListElement = document.getElementById('queue-list');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const currentTitle = document.getElementById('current-song-title');
    const currentArtist = document.getElementById('current-song-artist');
    const playlistList = document.getElementById('playlist-list');
    const createPlaylistBtn = document.getElementById('create-playlist-btn');
    const newPlaylistModal = document.getElementById('new-playlist-modal');
    const savePlaylistBtn = document.getElementById('save-playlist-btn');
    const cancelPlaylistBtn = document.getElementById('cancel-playlist-btn');
    const newPlaylistNameInput = document.getElementById('new-playlist-name');
    localPlayer = document.getElementById('local-player');

    const loadLanguage = async (lang) => {
        const response = await fetch(`/static/lang/${lang}.json`);
        const langStrings = await response.json();
        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.getAttribute('data-lang-key');
            if (langStrings[key]) {
                if (element.placeholder !== undefined) {
                    element.placeholder = langStrings[key];
                } else {
                    element.textContent = langStrings[key];
                }
            }
        });
        localStorage.setItem('preferredLanguage', lang);
    };

    const searchSongs = async () => {
        const query = searchInput.value;
        if (!query) {
            searchResultsContainer.innerHTML = '';
            return;
        };
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
        const results = await response.json();
        
        searchResultsContainer.innerHTML = '<h3>Search Results</h3>';
        if (results.length === 0) {
            searchResultsContainer.innerHTML += '<p>No results found.</p>';
        }

        results.forEach(song => {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.innerHTML = `<img src="${song.thumbnail}" alt="thumb"><div><h3>${song.title}</h3><p>${song.artist}</p></div>`;
            item.onclick = () => { playSong(song); addSongToQueue(song); };
            searchResultsContainer.appendChild(item);
        });
    };

    const addSongToQueue = async (songData) => {
        await fetch('/api/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(songData)
        });
        fetchAndDisplayQueue();
    };

    const fetchAndDisplayQueue = async () => {
        const response = await fetch('/api/queue');
        const queue = await response.json();
        queueListElement.innerHTML = '';
        queue.forEach(song => {
            const item = document.createElement('div');
            item.className = 'song-item';
            if(song.thumbnail) {
                item.innerHTML = `<img src="${song.thumbnail}" alt="thumb"><div><h3>${song.title}</h3><p>${song.artist}</p></div>`;
            } else {
                item.innerHTML = `<div><h3>${song.title}</h3><p>${song.artist}</p></div>`;
            }
            item.onclick = () => playSong(song);
            queueListElement.appendChild(item);
        });
    };

    const fetchAndDisplayPlaylists = async () => {
        const response = await fetch('/api/playlists');
        const playlists = await response.json();
        playlistList.innerHTML = '';
        playlists.forEach(playlist => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.innerHTML = `<img src="${playlist.cover_art}" alt="cover"><div><h3>${playlist.name}</h3></div>`;
            item.onclick = () => {
                queueListElement.innerHTML = ''; 
                playlist.songs.forEach(song => addSongToQueue(song));
                if (playlist.songs.length > 0) playSong(playlist.songs[0]);
            };
            playlistList.appendChild(item);
        });
    };

    const playSong = (songData) => {
        const youtubePlayerWrapper = document.getElementById('youtube-player');
        
        currentTitle.textContent = songData.title;
        currentArtist.textContent = songData.artist;

        if (songData.videoId) {
            localPlayer.style.display = 'none';
            youtubePlayerWrapper.style.display = 'block';
            localPlayer.pause();
            if (youtubePlayer && typeof youtubePlayer.loadVideoById === 'function') {
                youtubePlayer.loadVideoById(songData.videoId);
                youtubePlayer.playVideo();
            }
        } else if (songData.file) {
            youtubePlayerWrapper.style.display = 'none';
            localPlayer.style.display = 'block';
            if(youtubePlayer && typeof youtubePlayer.stopVideo === 'function') youtubePlayer.stopVideo();
            localPlayer.src = songData.file;
            localPlayer.play();
        }
    };

    const togglePlayPause = () => {
        const youtubePlayerIsActive = document.getElementById('youtube-player').style.display !== 'none';
        if (youtubePlayerIsActive) {
            if (youtubePlayer && typeof youtubePlayer.getPlayerState === 'function') {
                const state = youtubePlayer.getPlayerState();
                if (state === YT.PlayerState.PLAYING) youtubePlayer.pauseVideo();
                else youtubePlayer.playVideo();
            }
        } else {
            if (localPlayer.paused) localPlayer.play();
            else localPlayer.pause();
        }
    };

    const logout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        localStorage.removeItem('user');
        currentUser = null;
        updateUserUI();
    };

    const updateUserUI = () => {
        const accountSection = document.getElementById('account-section');
        if (currentUser) {
            accountSection.innerHTML = `<div class="user-info"><span>Welcome, <strong>${currentUser.username}</strong>!</span><a href="/account_page" class="account-button">My Account</a><button id="logout-btn" class="logout-button">Logout</button></div>`;
            document.getElementById('logout-btn').addEventListener('click', logout);
            document.getElementById('subscription-ad').style.display = currentUser.is_subscribed ? 'none' : 'block';
        } else {
            accountSection.innerHTML = `<a href="/login_page" data-lang-key="account_login">Login / Sign Up</a>`;
            document.getElementById('subscription-ad').style.display = 'block';
        }
    };

    searchInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') searchSongs(); });
    playPauseBtn.addEventListener('click', togglePlayPause);
    document.getElementById('lang-en').addEventListener('click', () => loadLanguage('en'));
    document.getElementById('lang-es').addEventListener('click', () => loadLanguage('es'));

    createPlaylistBtn.addEventListener('click', () => { newPlaylistModal.style.display = 'flex'; });
    cancelPlaylistBtn.addEventListener('click', () => { newPlaylistModal.style.display = 'none'; });
    savePlaylistBtn.addEventListener('click', async () => {
        const name = newPlaylistNameInput.value;
        if (name) {
            await fetch('/api/playlists/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
            newPlaylistNameInput.value = '';
            newPlaylistModal.style.display = 'none';
            fetchAndDisplayPlaylists();
        }
    });

    new Sortable(queueListElement, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
            fetch('/api/queue/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromIndex: evt.oldIndex, toIndex: evt.newIndex })
            });
        }
    });

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
    }

    updateUserUI();
    fetchAndDisplayPlaylists();
    fetchAndDisplayQueue();
    const preferredLanguage = localStorage.getItem('preferredLanguage') || 'en';
    loadLanguage(preferredLanguage);
});
// Game state
let currentStage = 1;
const maxStages = 4;
const points = [0, 4, 3, 2, 1]; // Index 0 unused, used for correct detection
let score = 0;
let gameOver = false;
let correctMovie = ''; // Fetched dynamically
let movieList = []; // Array for all movies
let currentImageSrc = ''; // Track current image for modal
let mediaElements = []; // Track all media for volume control
let currentAudio = null; // Track current audio for custom player
let availableDates = []; // Array for random selection
let manifestLoaded = false; // Track if manifest is ready
let currentPuzzleId = ''; // YYYYMMDD string for media
let lives = 5;
let currentStreak = 0;
let maxStreak = parseInt(localStorage.getItem('maxStreak')) || 0; // Load from localStorage or default to 0

// Dropdown debounce timeout
let dropdownTimeout = null;

// Stage media placeholders (puzzle-id based path)
function getMediaPath() {
  return `https://pub-41e14c99425c4404ac527c1af1f562cf.r2.dev/media/${currentPuzzleId}/`;
}

function refreshStageMedia() {
  const path = getMediaPath();
  stageMedia[1].src = `${path}audio_clip.mp3`;
  stageMedia[2].srcs = [`${path}frame_1.jpg`, `${path}frame_2.jpg`, `${path}frame_3.jpg`, `${path}frame_4.jpg`, `${path}frame_5.jpg`];
  stageMedia[3].src = `${path}8s.mp4`;
  stageMedia[4].src = `${path}30s.mp4`;
  console.log('Stage media refreshed for path:', path);
}

const stageMedia = {
  1: { type: 'audio', src: `${getMediaPath()}audio_clip.mp3`, duration: 30 }, // 30s audio for Stage 1
  2: { type: 'image', srcs: [`${getMediaPath()}frame_1.jpg`, `${getMediaPath()}frame_2.jpg`, `${getMediaPath()}frame_3.jpg`, `${getMediaPath()}frame_4.jpg`, `${getMediaPath()}frame_5.jpg`] }, // 5 frames for gallery
  3: { type: 'video', src: `${getMediaPath()}8s.mp4`, duration: 8 }, // 8s video
  4: { type: 'video', src: `${getMediaPath()}30s.mp4`, duration: 30 } // 30s video
};

// Stages labels (updated for 30s audio in Stage 1)
const stageLabels = [
  '', 
  'Very Hard: 20-second audio clip', 
  'Hard: 5 random still frames', 
  'Medium: 8-second video clip', 
  'Easy: 30-second video clip'
];

const guessInput = document.getElementById('guess-input');
const submitBtn = document.getElementById('submit-btn');
const previousGuesses = document.getElementById('previous-guesses');
const scoreEl = document.getElementById('score');
const revealEl = document.getElementById('reveal');
const stageIndicator = document.getElementById('stage-indicator');
const mediaPlayer = document.getElementById('media-player');
let loadingIndicator = document.getElementById('loading-indicator');
const shareBtn = document.getElementById('share-btn');
const dropdown = document.getElementById('dropdown');
const inputContainer = document.getElementById('input-container');
const globalVolume = document.getElementById('global-volume');
const startScreen = document.getElementById('start-screen');
const playStartBtn = document.getElementById('play-start-btn');
const gameContainer = document.getElementById('game-container');
const livesEl = document.getElementById('lives');
const currentStreakEl = document.getElementById('current-streak');
const maxStreakEl = document.getElementById('max-streak');

// Guard against null DOM elements
if (!guessInput || !submitBtn || !revealEl /* add others as needed */) {
  console.error('Critical DOM elements missing. Check HTML.');
}

// New: Load manifest for available dates (as array)
async function loadAvailableDates() {
  try {
    const response = await fetch('./available_dates.json');
    if (!response.ok) throw new Error('Manifest not found');
    availableDates = await response.json();
    manifestLoaded = true;
    console.log(`Loaded ${availableDates.length} available dates from manifest`);
  } catch (error) {
    console.warn('Failed to load manifest:', error);
    manifestLoaded = false;
    // Fallback: You could generate dates here if needed, but for now, assume manifest works
  }
}

function pickRandomPuzzle() {
  if (!manifestLoaded || availableDates.length === 0) {
    console.error('No available dates loaded.');
    return '20250101'; // Fallback to a known date
  }
  const randomIndex = Math.floor(Math.random() * availableDates.length);
  return availableDates[randomIndex];
}

async function preloadAllMedia() {
  console.log('Preloading all media for puzzle...');
  const path = getMediaPath();
  const promises = [];
  const preloadVolume = globalVolume ? parseFloat(globalVolume.value) : 0.5; // Default 0.5 if no slider

  // Audio
  const audioPromise = new Promise((resolve, reject) => {
    const audio = new Audio(`${path}audio_clip.mp3`);
    audio.preload = 'auto';
    audio.volume = preloadVolume; // Sync volume early
    audio.addEventListener('loadeddata', () => {
      mediaElements.push(audio); // Add for global sync
      resolve();
    });
    audio.addEventListener('error', reject);
  });
  promises.push(audioPromise);

  // Videos (create but don't append to DOM to avoid accumulation)
  [3, 4].forEach(stage => {
    const videoPromise = new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = `${path}${stage === 3 ? '8s.mp4' : '30s.mp4'}`;
      video.preload = 'auto';
      video.volume = preloadVolume;
      video.addEventListener('loadeddata', () => {
        mediaElements.push(video); // Add for global sync
        resolve();
      });
      video.addEventListener('error', reject);
      // Don't append to body
    });
    promises.push(videoPromise);
  });

  // Images
  stageMedia[2].srcs.forEach(src => {
    const imagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = resolve;
      img.onerror = reject;
    });
    promises.push(imagePromise);
  });

  try {
    await Promise.all(promises);
    console.log('All media preloaded successfully');
  } catch (error) {
    console.error('Media preload error:', error);
    // Proceed even on partial failure, but could add UI warning here
  }
}

// Create modal for image maximize
const modal = document.createElement('div');
modal.id = 'image-modal';
modal.innerHTML = `
  <span class="close-modal">&times;</span>
  <img class="modal-image" src="" alt="Full size image" />
  <div class="modal-buttons">
    <button class="modal-prev">Prev</button>
    <button class="modal-next">Next</button>
  </div>
  <div class="modal-counter">1 / 5</div>
`;
document.body.appendChild(modal);

const closeModal = modal.querySelector('.close-modal');
const modalImage = modal.querySelector('.modal-image');
const modalPrev = modal.querySelector('.modal-prev');
const modalNext = modal.querySelector('.modal-next');
const modalCounter = modal.querySelector('.modal-counter');

// Global volume handler - immediately update all media
globalVolume.addEventListener('input', (e) => {
  const volume = parseFloat(e.target.value);
  mediaElements.forEach(el => {
    if (el.volume !== undefined) {
      el.volume = volume;
    }
  });
  if (currentAudio) {
    currentAudio.volume = volume;
  }
  // Save to localStorage
  localStorage.setItem('globalVolume', volume);
});

// Load saved volume on init
const savedVolume = localStorage.getItem('globalVolume');
if (savedVolume !== null && globalVolume) {
  globalVolume.value = savedVolume;
}

// Fetch correct movie from .txt filename (assume single .txt in folder)
async function fetchCorrectMovie() {
  try {
    const response = await fetch(`${getMediaPath()}movie.txt`);
    correctMovie = await response.text();
    correctMovie = correctMovie.trim();
    await preloadAllMedia(); // Preload media after fetching movie
  } catch (error) {
    console.error('Error fetching movie.txt:', error);
    correctMovie = 'Default Movie (Error)';
    await preloadAllMedia();
  }
}

// Load movies from CSV for autocomplete (now async)
async function loadMovies() {
  try {
    const response = await fetch('./data/movies.csv');
    const text = await response.text();
    const lines = text.split('\n').slice(1); // Skip header
    movieList = lines
      .map(line => {
        const title = line.split(',')[0]?.trim().replace(/"/g, '') || ''; // Safe split
        return title;
      })
      .filter(title => title.length > 0); // Remove empty lines
  } catch (error) {
    console.error('Error loading movies.csv:', error);
    // Fallback: empty array
  }
}

// Filter and show dropdown (debounced)
function updateDropdown() {
  if (dropdownTimeout) clearTimeout(dropdownTimeout);
  dropdownTimeout = setTimeout(() => {
    const query = guessInput.value.toLowerCase().trim();
    if (query.length < 1) {
      dropdown.classList.remove('show');
      return;
    }

    const filtered = movieList
      .filter(movie => movie.toLowerCase().includes(query))
      .slice(0, 10); // Limit to 10 for performance

    dropdown.innerHTML = '';
    if (filtered.length === 0) {
      dropdown.classList.remove('show');
      return;
    }

    const ul = document.createElement('ul');
    filtered.forEach(movie => {
      const li = document.createElement('li');
      li.textContent = movie;
      li.onclick = () => {
        guessInput.value = movie;
        dropdown.classList.remove('show');
      };
      ul.appendChild(li);
    });
    dropdown.appendChild(ul);
    dropdown.classList.add('show');
  }, 150); // Debounce 150ms
}

// Hide dropdown on outside click
document.addEventListener('click', (e) => {
  if (!inputContainer.contains(e.target)) {
    dropdown.classList.remove('show');
  }
});

// Modal handlers
closeModal.onclick = () => {
  modal.style.display = 'none';
};
window.onclick = (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    modal.style.display = 'none';
  }
});

// Load media for current stage
function loadMedia(stage) {
  mediaPlayer.innerHTML = '<div id="loading-indicator">Loading media...</div>';
  loadingIndicator = document.getElementById('loading-indicator');
  loadingIndicator.style.display = 'flex';
  const media = stageMedia[stage];
  let mediaElement = null;
  const currentVolume = globalVolume ? parseFloat(globalVolume.value) : 0.5;

  if (media.type === 'audio') {
    // Custom audio player
    const customPlayer = document.createElement('div');
    customPlayer.className = 'custom-audio';
    const playPauseBtn = document.createElement('button');
    playPauseBtn.className = 'custom-play-pause';
    playPauseBtn.textContent = '▶';
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.className = 'custom-progress';
    progress.min = 0;
    progress.max = 1;
    progress.value = 0;
    progress.step = 0.01;
    const timeDisplay = document.createElement('span');
    timeDisplay.className = 'custom-time';
    timeDisplay.textContent = '0:00 / 0:00'; // Dynamic

    // Create hidden audio element
    const audioEl = new Audio(media.src);
    audioEl.preload = 'auto';
    audioEl.volume = currentVolume; // Set initial volume
    mediaElements.push(audioEl);
    currentAudio = audioEl;

    // Events
    playPauseBtn.onclick = () => {
      if (audioEl.paused) {
        audioEl.play();
        playPauseBtn.textContent = '⏸';
      } else {
        audioEl.pause();
        playPauseBtn.textContent = '▶';
      }
    };

    audioEl.addEventListener('timeupdate', () => {
      progress.value = audioEl.currentTime / audioEl.duration;
      const totalMin = Math.floor(audioEl.duration / 60);
      const totalSec = Math.floor(audioEl.duration % 60).toString().padStart(2, '0');
      timeDisplay.textContent = `${Math.floor(audioEl.currentTime / 60)}:${Math.floor(audioEl.currentTime % 60).toString().padStart(2, '0')} / ${totalMin}:${totalSec}`;
    });

    progress.addEventListener('input', (e) => {
      audioEl.currentTime = e.target.value * audioEl.duration;
    });

    audioEl.addEventListener('loadedmetadata', () => {
      const totalMin = Math.floor(audioEl.duration / 60);
      const totalSec = Math.floor(audioEl.duration % 60).toString().padStart(2, '0');
      timeDisplay.textContent = `0:00 / ${totalMin}:${totalSec}`;
      loadingIndicator.style.display = 'none';
      customPlayer.appendChild(playPauseBtn);
      customPlayer.appendChild(progress);
      customPlayer.appendChild(timeDisplay);
      mediaPlayer.appendChild(customPlayer);
      console.log(`Audio loaded with volume: ${audioEl.volume}`); // Verify volume
    });

    // Handle end of media
    audioEl.addEventListener('ended', () => {
      playPauseBtn.textContent = '▶';
      progress.value = 0;
      audioEl.currentTime = 0;
    });

    audioEl.addEventListener('error', (e) => {
      console.error('Audio load error:', e);
      loadingIndicator.textContent = 'Error loading audio.';
    });
  } else if (media.type === 'video') {
    mediaElement = document.createElement('video');
    mediaElement.src = media.src;
    mediaElement.controls = true;
    mediaElement.volume = currentVolume; // Set initial volume
    mediaElement.style.display = 'none';
    mediaPlayer.appendChild(mediaElement);
    mediaElements.push(mediaElement); // Add immediately for volume sync
    mediaElement.addEventListener('canplaythrough', () => {
      loadingIndicator.style.display = 'none';
      mediaElement.style.display = 'block';
      console.log(`Video loaded with volume: ${mediaElement.volume}`); // Verify volume
    });
    mediaElement.addEventListener('error', (e) => {
      console.error('Video load error:', e);
      loadingIndicator.textContent = 'Error loading video. Check file path.';
    });
  } else if (media.type === 'image') {
    loadingIndicator.style.display = 'none'; // Hide immediately for images
    const gallery = document.createElement('div');
    gallery.id = 'image-gallery';
    let currentIndex = 0;
    const img = document.createElement('img');
    img.src = media.srcs[currentIndex];
    currentImageSrc = img.src;
    gallery.appendChild(img);

    // Maximize button (fixed ID)
    const maximizeBtn = document.createElement('button');
    maximizeBtn.id = 'max-btn';
    maximizeBtn.textContent = '⛶';
    maximizeBtn.onclick = () => {
      let modalIndex = currentIndex; // Start from current gallery index
      modalImage.src = media.srcs[modalIndex];
      updateModalCounter(modalIndex, media.srcs.length);
      modal.style.display = 'block';

      // Modal navigation handlers (one-time per open)
      const handlePrev = () => {
        modalIndex = (modalIndex > 0) ? modalIndex - 1 : media.srcs.length - 1;
        modalImage.src = media.srcs[modalIndex];
        updateModalCounter(modalIndex, media.srcs.length);
      };

      const handleNext = () => {
        modalIndex = (modalIndex < media.srcs.length - 1) ? modalIndex + 1 : 0;
        modalImage.src = media.srcs[modalIndex];
        updateModalCounter(modalIndex, media.srcs.length);
      };

      modalPrev.onclick = handlePrev;
      modalNext.onclick = handleNext;

      // Optional: Keyboard navigation in modal
      const keyHandler = (e) => {
        if (modal.style.display === 'block') {
          if (e.key === 'ArrowLeft') handlePrev();
          if (e.key === 'ArrowRight') handleNext();
        }
      };
      document.addEventListener('keydown', keyHandler);

      // Clean up on close
      const cleanup = () => {
        modalPrev.onclick = null;
        modalNext.onclick = null;
        document.removeEventListener('keydown', keyHandler);
      };
      closeModal.addEventListener('click', cleanup, { once: true });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) cleanup();
      }, { once: true });
    };
    gallery.appendChild(maximizeBtn);

    // Buttons wrapper
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.className = 'gallery-buttons';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Prev';
    prevBtn.onclick = () => {
      if (currentIndex > 0) {
        currentIndex--;
        img.src = media.srcs[currentIndex];
        currentImageSrc = img.src;
        updateCounter();
      }
    };

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.onclick = () => {
      if (currentIndex < media.srcs.length - 1) {
        currentIndex++;
        img.src = media.srcs[currentIndex];
        currentImageSrc = img.src;
        updateCounter();
      }
    };

    buttonsWrapper.appendChild(prevBtn);
    buttonsWrapper.appendChild(nextBtn);
    gallery.appendChild(buttonsWrapper);

    const counter = document.createElement('div');
    counter.id = 'frame-counter';
    function updateCounter() {
      counter.textContent = `${currentIndex + 1} / ${media.srcs.length}`;
    }
    updateCounter();
    gallery.appendChild(counter);
    mediaPlayer.appendChild(gallery);
  }
}

function updateModalCounter(index, total) {
  modalCounter.textContent = `${index + 1} / ${total}`;
}

// Update stage display
function updateStage() {
  // Pause and reset all existing media to prevent continued playback
  mediaElements.forEach(el => {
    if (el.pause) {
      el.pause();
      el.currentTime = 0; // Reset playback position
    }
  });
  mediaElements = []; // Clear for new stage
  currentAudio = null;
  console.log(`Updating to stage ${currentStage}`);
  stageIndicator.textContent = `Stage ${currentStage}: ${stageLabels[currentStage]}`;
  loadMedia(currentStage);
  guessInput.value = ''; // Clear input on stage change
  guessInput.focus();
}

// Add guess to history
function addGuess(guess, isCorrect) {
  const guessDiv = document.createElement('div');
  guessDiv.className = 'guess-item';
  guessDiv.textContent = `${guess} ${isCorrect ? '✅' : '❌'}`;
  if (isCorrect) {
    guessDiv.style.color = '#00FF00';
  }
  previousGuesses.appendChild(guessDiv);
}

// Add skip to history
function addSkip() {
  const skipDiv = document.createElement('div');
  skipDiv.className = 'skip-item';
  skipDiv.textContent = 'Skipped ⏭️';
  previousGuesses.appendChild(skipDiv);
}

// Check guess
function checkGuess(guess) {
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedMovie = correctMovie.toLowerCase();
  // Optional fuzzy: Use Levenshtein distance < 2 for typos (implement if needed)
  // For now, exact match
  return normalizedGuess === normalizedMovie;
}

// Update status displays and save maxStreak to localStorage
function updateStatus() {
  livesEl.textContent = `Lives: ${'❤️'.repeat(lives)}`;
  currentStreakEl.textContent = `Current Streak: ${currentStreak}`;
  maxStreakEl.textContent = `Max Streak: ${maxStreak}`;
  localStorage.setItem('maxStreak', maxStreak); // Save maxStreak to localStorage
}

// End puzzle (not full game)
function endPuzzle(isCorrect) {
  gameOver = true; // Temporary for this puzzle
  submitBtn.style.display = 'none';
  guessInput.disabled = true;
  stageIndicator.style.display = 'none';
  inputContainer.style.display = 'none';
  
  // Pause all media before showing reveal
  mediaElements.forEach(el => {
    if (el.pause) {
      el.pause();
      el.currentTime = 0; // Reset playback position
    }
  });
  
  // Swap sections: Hide media, show reveal
  mediaPlayer.style.display = 'none';
  revealEl.style.display = 'block';
  
  // Clear and prepare reveal container
  revealEl.innerHTML = '';
  
  // Create message
  const messageEl = document.createElement('div');
  messageEl.className = 'celebration-message';
  if (isCorrect) {
    const stageDesc = stageLabels[currentStage].split(': ')[1];
    messageEl.innerHTML = `🎉 Correct! You got it on the ${stageDesc}! +1 Streak! 🏆`;
    messageEl.style.color = '#00FF00';
    messageEl.style.fontSize = '24px';
    messageEl.style.fontWeight = 'bold';
    // Simple animation: pulse
    messageEl.style.animation = 'pulse 1s infinite';
  } else {
    messageEl.innerHTML = `😔 Failed this one... -1 Life. ${lives > 0 ? 'Keep going!' : 'Game Over!'} 💪`;
    messageEl.style.color = '#FF6B6B';
    messageEl.style.fontSize = '20px';
    messageEl.style.fontWeight = 'bold';
  }
  
  // Create movie name element
  const movieNameEl = document.createElement('strong');
  movieNameEl.textContent = `The movie was: ${correctMovie}`;
  
  // Create poster image
  const posterContainer = document.createElement('div');
  const posterImg = document.createElement('img');
  posterImg.src = `${getMediaPath()}Poster.png`;
  posterImg.alt = `${correctMovie} poster`;
  posterImg.className = 'movie-poster';
  posterContainer.appendChild(posterImg);
  
  // Fallback if poster fails (insert after poster)
  const fallback = document.createElement('p');
  fallback.textContent = 'Poster not available';
  fallback.style.color = '#999';
  fallback.style.fontStyle = 'italic';
  fallback.style.display = 'none'; // Hidden initially
  posterContainer.appendChild(fallback);
  
  posterImg.onerror = () => {
    posterImg.style.display = 'none';
    fallback.style.display = 'block';
  };
  
  // Append to reveal
  revealEl.appendChild(messageEl);
  revealEl.appendChild(posterContainer);
  revealEl.appendChild(movieNameEl);

  // Add next/restart button
  const button = document.createElement('button');
  if (lives > 0) {
    button.id = 'next-btn';
    button.textContent = 'Next Movie';
    button.onclick = loadNewPuzzle;
  } else {
    button.id = 'restart-btn';
    button.textContent = 'Restart Game';
    button.onclick = restartGame;
    // Show share on game over
    shareBtn.style.display = 'block';
    const shareText = `🎬 **FilmIQ Endless Mode** 🎉 Achieved a max streak of ${maxStreak}! 🔥 Beat my score? Play here: https://filmiq.app/endless.html`;
    shareBtn.onclick = () => {
      if (navigator.share) {
        navigator.share({ text: shareText });
      } else {
        navigator.clipboard.writeText(shareText);
        alert('Score copied to clipboard!');
      }
    };
  }
  revealEl.appendChild(button);
}

// Skip logic (shared for empty submit)
function skipStage() {
  addSkip(); // Always add new skip entry
  guessInput.value = '';
  if (currentStage < maxStages) {
    currentStage++;
    updateStage();
  } else {
    score = 0; // No points if failed all
    lives--;
    if (lives === 0) {
      currentStreak = 0; // Reset streak only when lives hit 0
    }
    updateStatus();
    endPuzzle(false);
  }
}

// Submit handler (handles guess or skip if empty)
submitBtn.onclick = () => {
  if (gameOver) return;

  const guess = guessInput.value.trim();
  if (!guess) {
    skipStage();
    return;
  }

  const isCorrect = checkGuess(guess);
  addGuess(guess, isCorrect);

  if (isCorrect) {
    score = points[currentStage];
    currentStreak++;
    maxStreak = Math.max(maxStreak, currentStreak);
    updateStatus();
    endPuzzle(true);
    return;
  }

  // For incorrect, clear and advance
  guessInput.value = '';
  if (currentStage < maxStages) {
    currentStage++;
    updateStage();
  } else {
    score = 0; // No points if failed all
    lives--;
    if (lives === 0) {
      currentStreak = 0; // Reset streak only when lives hit 0
    }
    updateStatus();
    endPuzzle(false);
  }
};

// Enter key submit
guessInput.onkeypress = (e) => {
  if (e.key === 'Enter') submitBtn.click();
};

// Input event for dropdown (now debounced in updateDropdown)
guessInput.addEventListener('input', updateDropdown);

playStartBtn.onclick = async () => {
  startScreen.style.display = 'none';
  gameContainer.style.display = 'block';
  document.getElementById('start-loading').style.display = 'block';
  await loadNewPuzzle(); // Load first puzzle
  updateStatus();
  updateStage();
};

function loadNewPuzzle() {
  currentPuzzleId = pickRandomPuzzle();
  currentStage = 1;
  score = 0;
  gameOver = false;
  previousGuesses.innerHTML = '';
  scoreEl.textContent = '';
  revealEl.innerHTML = '';
  submitBtn.style.display = 'block';
  shareBtn.style.display = 'none';
  guessInput.disabled = false;
  refreshStageMedia(); // Update media paths for new puzzle
  mediaPlayer.style.display = 'flex';  // Restore flex
  revealEl.style.display = 'none'; // Hide reveal
  stageIndicator.style.display = 'block'; // Show stage indicator
  inputContainer.style.display = 'flex';  // Restore flex
  fetchCorrectMovie().then(() => updateStage()); // Wait for load
}

function restartGame() {
  lives = 5;
  currentStreak = 0; // Reset current streak on game restart
  updateStatus();
  loadNewPuzzle();
}

// Init
console.log('Initializing game...');
loadMovies(); // Load movie list on start
loadAvailableDates().then(() => {
  // Ensure dates loaded before play
  updateStatus(); // Initialize UI with loaded maxStreak
});
startScreen.style.display = 'flex';
gameContainer.style.display = 'none'; // Hide game until play
revealEl.style.display = 'none'; // Ensure reveal is hidden at start
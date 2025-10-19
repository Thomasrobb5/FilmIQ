// Game state
let currentStage = 1;
const maxStages = 4;
const points = [0, 4, 3, 2, 1]; // Index 0 unused
let score = 0;
let gameOver = false;
let correctMovie = ''; // Fetched dynamically
let movieList = []; // Array for all movies
let currentImageSrc = ''; // Track current image for modal
let mediaElements = []; // Track all media for volume control
let currentAudio = null; // Track current audio for custom player
let currentDate = new Date(); // For daily logic (playing date)
let today = new Date(); // Fixed today for restrictions
let availableDates = new Set(); // New: Fast lookup for available dates
let manifestLoaded = false; // Track if manifest is ready
let fallbackDates = new Set(); // Cache for fallback fetches

// Timer for next puzzle
let timerInterval = null;
let nextPuzzleEl = null;

// Dropdown debounce timeout
let dropdownTimeout = null;

// Stage media placeholders (date-based path)
function getMediaPath() {
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  return `https://pub-41e14c99425c4404ac527c1af1f562cf.r2.dev/media/${year}${month}${day}/`;
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
  'Very Hard: 30-second audio clip', 
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
const dateEl = document.getElementById('date');
const dropdown = document.getElementById('dropdown');
const inputContainer = document.getElementById('input-container');
const globalVolume = document.getElementById('global-volume');
const startScreen = document.getElementById('start-screen');
const playStartBtn = document.getElementById('play-start-btn');
const gameContainer = document.getElementById('game-container');
const calendarBtn = document.getElementById('calendar-btn');
const calendarModal = document.getElementById('calendar-modal');
const closeCalendarBtn = document.getElementById('close-calendar-btn');
const calendarDates = document.getElementById('calendar-dates');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const monthYear = document.getElementById('month-year');
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();

// Guard against null DOM elements
if (!guessInput || !submitBtn || !revealEl /* add others as needed */) {
  console.error('Critical DOM elements missing. Check HTML.');
}

// Timer functions
function updateTimer() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const diff = tomorrow - now;
  if (diff <= 0) {
    // If somehow past midnight, reset to today +1
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (nextPuzzleEl) {
    nextPuzzleEl.textContent = `Next puzzle in: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer(); // Initial call
}

// New: Load manifest for available dates
async function loadAvailableDates() {
  try {
    const response = await fetch('./available_dates.json');
    if (!response.ok) throw new Error('Manifest not found');
    const dates = await response.json();
    availableDates = new Set(dates);
    manifestLoaded = true;
    console.log(`Loaded ${availableDates.size} available dates from manifest`);
  } catch (error) {
    console.warn('Failed to load manifest, falling back to fetches:', error);
    manifestLoaded = false;
  }
}

async function preloadAllMedia() {
  console.log('Preloading all media for date...');
  const path = getMediaPath();
  const promises = [];
  let preloadVolume = globalVolume ? parseFloat(globalVolume.value) : 0.5; // Default 0.5 if no slider

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
`;
document.body.appendChild(modal);

const closeModal = modal.querySelector('.close-modal');
const modalImage = modal.querySelector('.modal-image');

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
});

// Set current date dynamically
dateEl.textContent = currentDate.toDateString();

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
    const response = fetch('./data/movies.csv');
    const text = await (await response).text();
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
    });

    // New: Handle end of media
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
    mediaElement.style.display = 'none';
    mediaPlayer.appendChild(mediaElement);
    mediaElements.push(mediaElement); // Add immediately for volume sync
    mediaElement.addEventListener('canplaythrough', () => {
      loadingIndicator.style.display = 'none';
      mediaElement.style.display = 'block';
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
      modalImage.src = currentImageSrc;
      modal.style.display = 'block';
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

// Update stage display
function updateStage() {
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

// End game
function endGame() {
  gameOver = true;
  submitBtn.style.display = 'none';
  guessInput.disabled = true;
  stageIndicator.style.display = 'none';
  inputContainer.style.display = 'none';
  
  // Swap sections: Hide media, show reveal
  mediaPlayer.style.display = 'none';
  revealEl.style.display = 'block';
  
  // Clear and prepare reveal container
  revealEl.innerHTML = '';
  
  // Create celebration message
  const celebrationEl = document.createElement('div');
  celebrationEl.className = 'celebration-message';
  if (score > 0) {
    const stageDesc = stageLabels[currentStage].split(': ')[1];
    celebrationEl.innerHTML = `🎉 Amazing! You nailed it on the ${stageDesc} (${score}/4 points)! 🏆`;
    celebrationEl.style.color = '#00FF00';
    celebrationEl.style.fontSize = '24px';
    celebrationEl.style.fontWeight = 'bold';
    // Simple animation: pulse
    celebrationEl.style.animation = 'pulse 1s infinite';
  } else {
    celebrationEl.innerHTML = `😔 Tough one today... 0/4 points. Don't worry, tomorrow's a new movie! 💪`;
    celebrationEl.style.color = '#FF6B6B';
    celebrationEl.style.fontSize = '20px';
    celebrationEl.style.fontWeight = 'bold';
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
  revealEl.appendChild(celebrationEl);
  revealEl.appendChild(posterContainer);
  revealEl.appendChild(movieNameEl);
  
  shareBtn.style.display = 'block';
  // Dynamic date formatting for share text (DD/MM/YYYY)
  const day = String(currentDate.getDate()).padStart(2, '0');
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const year = currentDate.getFullYear();
  const dateStr = `${day}/${month}/${year}`;

  let shareText;
  if (score > 0) {
    // Solved on currentStage
    const stageDesc = stageLabels[currentStage].split(': ')[1]; // e.g., "30-second audio clip"
    shareText = `🎬 **FilmIQ - ${dateStr}** 🎉 Got it on the ${stageDesc}! ${score}/4 points! 🔥 Beat my score? Play here: https://filmiq.app`;
  } else {
    // Failed all stages
    shareText = `🎬 **FilmIQ - ${dateStr}** 😩 Couldn't get it today... 0/4 points. 🔒 Movie hidden! 🔥 Think you can do better? 👉 Play here: https://filmiq.app`;
  }

  shareBtn.onclick = () => {
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Score copied to clipboard!');
    }
  };
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
    scoreEl.textContent = `Score: ${score}/4 points. Better luck tomorrow!`;
    endGame();
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
    scoreEl.textContent = `Score: ${score}/4 points! 🎉`;
    endGame();
    return;
  }

  // For incorrect, clear and advance
  guessInput.value = '';
  if (currentStage < maxStages) {
    currentStage++;
    updateStage();
  } else {
    score = 0; // No points if failed all
    scoreEl.textContent = `Score: ${score}/4 points. Better luck tomorrow!`;
    endGame();
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
  await fetchCorrectMovie(); // Fetches movie and preloads media
  updateStage();
};

// Calendar handler
calendarBtn.onclick = () => {
  calendarModal.style.display = 'flex';
  showCalendar();
};

prevMonthBtn.onclick = () => {
  if (currentMonth === 0) {
    currentMonth = 11;
    currentYear--;
  } else {
    currentMonth--;
  }
  showCalendar();
};

nextMonthBtn.onclick = () => {
  if (currentMonth === 11) {
    currentMonth = 0;
    currentYear++;
  } else {
    currentMonth++;
  }
  showCalendar();
};

closeCalendarBtn.onclick = () => {
  calendarModal.style.display = 'none';
};

async function showCalendar() {
  calendarDates.innerHTML = '';
  const year = currentYear;
  const month = currentMonth;
  monthYear.textContent = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Weekday headers
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
    const header = document.createElement('div');
    header.textContent = day;
    header.style.fontWeight = 'bold';
    calendarDates.appendChild(header);
  });

  // Empty cells for first week
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    calendarDates.appendChild(empty);
  }

  // Collect fallback promises if needed
  const fallbackPromises = [];

  // No more promises—use manifest or fallback
  for (let d = 1; d <= daysInMonth; d++) {
    const pastDate = new Date(year, month, d);
    // Use local date components for consistency with getMediaPath()
    const localYear = pastDate.getFullYear();
    const localMonth = String(pastDate.getMonth() + 1).padStart(2, '0');
    const localDay = String(pastDate.getDate()).padStart(2, '0');
    const dateStr = `${localYear}${localMonth}${localDay}`;
    const dateDiv = document.createElement('div');
    dateDiv.className = 'calendar-day';
    dateDiv.textContent = d;
    dateDiv.classList.add('inactive'); // Start inactive to avoid flicker/race
    calendarDates.appendChild(dateDiv); // Append first, update class later

    // Highlight current date if it matches (regardless of active/inactive)
    if (pastDate.getFullYear() === currentDate.getFullYear() &&
        pastDate.getMonth() === currentDate.getMonth() &&
        pastDate.getDate() === currentDate.getDate()) {
      dateDiv.classList.add('current');
      console.log(`Date ${d}/${month + 1}/${year} is current (playing)`);
    }

    // Check availability: Use manifest first, fallback to fetch if not loaded
    const isAvailable = manifestLoaded ? availableDates.has(dateStr) : fallbackDates.has(dateStr);
    if (isAvailable && pastDate <= today) {
      // Available and not future: highlight and make clickable
      dateDiv.classList.remove('inactive');
      dateDiv.classList.add('active');
      dateDiv.onclick = () => {
        currentDate = pastDate;
        resetGame();
        calendarModal.style.display = 'none';
      };
      console.log(`Date ${d}/${month + 1}/${year} is active (from cache/manifest)`);
    } else if (!manifestLoaded && !fallbackDates.has(dateStr)) {
      // Fallback: Original fetch logic if manifest failed (cache results)
      const checkPromise = fetch(`./media/${dateStr}/movie.txt`, { method: 'HEAD' })
        .then((response) => {
          if (response.ok && pastDate <= today) {
            fallbackDates.add(dateStr); // Cache
            dateDiv.classList.remove('inactive');
            dateDiv.classList.add('active');
            dateDiv.onclick = () => {
              currentDate = pastDate;
              resetGame();
              calendarModal.style.display = 'none';
            };
            console.log(`Date ${d}/${month + 1}/${year} is active (fallback fetch)`);
          } else {
            // Already inactive
            if (pastDate > today) {
              console.log(`Date ${d}/${month + 1}/${year} is future (not playable)`);
            } else {
              console.log(`Date ${d}/${month + 1}/${year} is inactive (HTTP ${response.status})`);
            }
          }
        })
        .catch((error) => {
          // Already inactive
          console.error(`Network error checking date ${d}/${month + 1}/${year}:`, error);
        });
      fallbackPromises.push(checkPromise); // Collect for optional await if needed
    } else {
      // Inactive via manifest, cache, or future
      if (pastDate > today) {
        console.log(`Date ${d}/${month + 1}/${year} is future (not playable)`);
      } else {
        console.log(`Date ${d}/${month + 1}/${year} is inactive (not in manifest)`);
      }
    }
  }

  // Optional: Await all fallbacks for no flicker (uncomment if perf ok)
  // if (fallbackPromises.length > 0) await Promise.all(fallbackPromises);
}

function resetGame() {
  currentStage = 1;
  score = 0;
  gameOver = false;
  previousGuesses.innerHTML = '';
  scoreEl.textContent = '';
  revealEl.innerHTML = '';
  submitBtn.style.display = 'block';
  shareBtn.style.display = 'none';
  guessInput.disabled = false;
  dateEl.textContent = currentDate.toDateString();
  refreshStageMedia(); // Update media paths for new date
  mediaPlayer.style.display = 'flex';  // Restore flex
  revealEl.style.display = 'none'; // Hide reveal
  stageIndicator.style.display = 'block'; // Show stage indicator
  inputContainer.style.display = 'flex';  // Restore flex
  fetchCorrectMovie().then(() => updateStage()); // Wait for load
}

// Init
console.log('Initializing game...');
loadMovies(); // Load movie list on start
refreshStageMedia(); // Ensure initial load
startScreen.style.display = 'flex';
gameContainer.style.display = 'none'; // Hide game until play
nextPuzzleEl = document.getElementById('next-puzzle-timer');
revealEl.style.display = 'none'; // Ensure reveal is hidden at start
loadAvailableDates(); // New: Load manifest early
startTimer(); // Start the countdown timer
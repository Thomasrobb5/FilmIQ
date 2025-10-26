// Game state
let currentStage = 1;
const maxStages = 5;
const points = [0, 5, 4, 3, 2, 1]; // Points for stages 0-5
let score = 0;
let gameOver = false;
let correctMovie = '';
let movieList = [];
let availableMovies = [];
let currentStreak = parseInt(localStorage.getItem('currentStreak') || '0', 10);
let bestStreak = parseInt(localStorage.getItem('bestStreak') || '0', 10);
let dropdownTimeout = null;
let gridSquares = [];
let revealOrder = [];
const gridSize = 400;
const cumulativeReveals = [20, 35, 50, 100, 200];

// DOM elements
const guessInput = document.getElementById('guess-input');
const submitBtn = document.getElementById('submit-btn');
const previousGuesses = document.getElementById('previous-guesses');
const scoreEl = document.getElementById('score');
const revealEl = document.getElementById('reveal');
const stageIndicator = document.getElementById('stage-indicator');
const posterContainer = document.getElementById('poster-container');
const posterImage = document.getElementById('poster-image');
const loadingIndicator = document.getElementById('loading-indicator');
const shareBtn = document.getElementById('share-btn');
const currentStreakEl = document.getElementById('current-streak');
const bestStreakEl = document.getElementById('best-streak');
const dropdown = document.getElementById('dropdown');
const inputContainer = document.getElementById('input-container');
const startScreen = document.getElementById('start-screen');
const playStartBtn = document.getElementById('play-start-btn');
const gameContainer = document.getElementById('game-container');

// Error checking
if (!guessInput || !submitBtn || !revealEl || !posterContainer || !posterImage) {
  console.error('Critical DOM elements missing. Check HTML.');
}

// Update streak display
function updateStreaks() {
  currentStreakEl.textContent = currentStreak;
  bestStreakEl.textContent = bestStreak;
  localStorage.setItem('currentStreak', currentStreak);
  if (currentStreak > bestStreak) {
    bestStreak = currentStreak;
    localStorage.setItem('bestStreak', bestStreak);
  }
}

// Load available movies
async function loadAvailableMovies() {
  try {
    const response = await fetch('./available_dates.json');
    if (!response.ok) throw new Error('Manifest not found');
    availableMovies = await response.json();
    console.log(`Loaded ${availableMovies.length} available movies`);
  } catch (error) {
    console.error('Failed to load movie manifest:', error);
    availableMovies = [];
  }
}

// Get random movie path
function getRandomMediaPath() {
  if (availableMovies.length === 0) {
    console.warn('No movies available, using fallback path');
    return 'https://pub-41e14c99425c4404ac527c1af1f562cf.r2.dev/media/20250101/';
  }
  const randomIndex = Math.floor(Math.random() * availableMovies.length);
  return `https://pub-41e14c99425c4404ac527c1af1f562cf.r2.dev/media/${availableMovies[randomIndex]}/`;
}

// Fetch correct movie
async function fetchCorrectMovie() {
  const path = getRandomMediaPath();
  try {
    const response = await fetch(`${path}movie.txt`);
    correctMovie = await response.text();
    correctMovie = correctMovie.trim();
    await preloadPoster(path);
  } catch (error) {
    console.error('Error fetching movie.txt:', error);
    correctMovie = 'Default Movie (Error)';
    await preloadPoster(path);
  }
}

// Preload poster and set up grid
async function preloadPoster(path) {
  loadingIndicator.style.display = 'flex';
  posterImage.src = `${path}Poster.png`;
  posterImage.onload = () => {
    loadingIndicator.style.display = 'none';
    posterImage.style.display = 'block';
    createGrid();
    shuffleRevealOrder();
    updateStage();
  };
  posterImage.onerror = () => {
    loadingIndicator.textContent = 'Error loading poster.';
    posterImage.style.display = 'none';
  };
}

// Create 20x20 grid squares
function createGrid() {
  const grid = document.getElementById('poster-grid');
  grid.innerHTML = '';
  gridSquares = [];
  for (let i = 0; i < gridSize; i++) {
    const square = document.createElement('div');
    square.className = 'grid-square';
    grid.appendChild(square);
    gridSquares.push(square);
  }
}

// Shuffle the order of squares to reveal
function shuffleRevealOrder() {
  revealOrder = Array.from({ length: gridSize }, (_, i) => i);
  for (let i = revealOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [revealOrder[i], revealOrder[j]] = [revealOrder[j], revealOrder[i]];
  }
}

// Reveal squares up to the specified number
function revealSquares(count) {
  for (let i = 0; i < count; i++) {
    const index = revealOrder[i];
    gridSquares[index].classList.add('revealed');
  }
}

// Load movies for autocomplete
async function loadMovies() {
  try {
    const response = await fetch('./data/movies.csv');
    const text = await response.text();
    const lines = text.split('\n').slice(1);
    movieList = lines
      .map(line => line.split(',')[0]?.trim().replace(/"/g, '') || '')
      .filter(title => title.length > 0);
  } catch (error) {
    console.error('Error loading movies.csv:', error);
    movieList = [];
  }
}

// Dropdown for autocomplete
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
      .slice(0, 10);
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
  }, 150);
}

// Hide dropdown on outside click
document.addEventListener('click', (e) => {
  if (!inputContainer.contains(e.target)) {
    dropdown.classList.remove('show');
  }
});

// Update stage
function updateStage() {
  console.log(`Updating to stage ${currentStage}`);
  if (currentStage <= maxStages) {
    const revealedCount = cumulativeReveals[currentStage - 1];
    revealSquares(revealedCount);
    stageIndicator.textContent = `Stage ${currentStage}: ${revealedCount}/${gridSize} squares revealed`;
    guessInput.focus();
  } else {
    endGame(false);
  }
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
  return normalizedGuess === normalizedMovie;
}

// End game
function endGame(isCorrect) {
  gameOver = true;
  submitBtn.style.display = 'none';
  guessInput.disabled = true;
  guessInput.value = '';
  stageIndicator.style.display = 'none';
  inputContainer.style.display = 'none';
  posterContainer.style.display = 'none';
  revealEl.style.display = 'block';

  revealEl.innerHTML = '';
  const celebrationEl = document.createElement('div');
  celebrationEl.className = 'celebration-message';
  if (isCorrect) {
    score = points[currentStage];
    currentStreak++;
    celebrationEl.innerHTML = `🎉 Amazing! You got it in Stage ${currentStage}! ${score}/5 points! 🏆 Streak: ${currentStreak}`;
    celebrationEl.style.color = '#00FF00';
  } else {
    score = 0;
    currentStreak = 0;
    celebrationEl.innerHTML = `😔 Tough one! 0/5 points. Streak reset. 💪 Try again!`;
    celebrationEl.style.color = '#FF6B6B';
  }
  celebrationEl.style.fontSize = isCorrect ? '24px' : '20px';
  celebrationEl.style.fontWeight = 'bold';
  celebrationEl.style.animation = 'pulse 1s infinite';

  updateStreaks();

  const movieNameEl = document.createElement('strong');
  movieNameEl.textContent = `The movie was: ${correctMovie}`;
  const posterRevealContainer = document.createElement('div');
  const posterImg = document.createElement('img');
  posterImg.src = posterImage.src;
  posterImg.alt = `${correctMovie} poster`;
  posterImg.className = 'movie-poster';
  posterRevealContainer.appendChild(posterImg);
  const fallback = document.createElement('p');
  fallback.textContent = 'Poster not available';
  fallback.style.color = '#999';
  fallback.style.fontStyle = 'italic';
  fallback.style.display = 'none';
  posterRevealContainer.appendChild(fallback);
  posterImg.onerror = () => {
    posterImg.style.display = 'none';
    fallback.style.display = 'block';
  };
  revealEl.appendChild(celebrationEl);
  revealEl.appendChild(posterRevealContainer);
  revealEl.appendChild(movieNameEl);
  shareBtn.style.display = 'block';

  const shareText = isCorrect
    ? `🎬 **FilmIQ Poster** 🎉 Got "${correctMovie}" in Stage ${currentStage}! ${score}/5 points! 🔥 Streak: ${currentStreak} 👉 Try it: https://filmiq.app`
    : `🎬 **FilmIQ Poster** 😩 Missed "${correctMovie}"! 0/5 points. Streak reset. 💪 Try it: https://filmiq.app`;

  shareBtn.onclick = () => {
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Score copied to clipboard!');
    }
  };

  const nextBtn = document.createElement('button');
  nextBtn.id = 'next-btn';
  nextBtn.textContent = 'Next Movie';
  nextBtn.onclick = () => resetGame();
  revealEl.appendChild(nextBtn);
}

// Skip stage
function skipStage() {
  addSkip();
  guessInput.value = '';
  if (currentStage < maxStages) {
    currentStage++;
    updateStage();
  } else {
    endGame(false);
  }
}

// Submit handler
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
    endGame(true);
    return;
  }
  guessInput.value = '';
  if (currentStage < maxStages) {
    currentStage++;
    updateStage();
  } else {
    endGame(false);
  }
};

// Enter key submit
guessInput.onkeypress = (e) => {
  if (e.key === 'Enter') submitBtn.click();
};

// Input event for dropdown
guessInput.addEventListener('input', updateDropdown);

// Start button
playStartBtn.onclick = async () => {
  startScreen.style.display = 'none';
  gameContainer.style.display = 'block';
  document.getElementById('start-loading').style.display = 'block';
  await fetchCorrectMovie();
};

// Reset game for next movie
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
  guessInput.value = '';
  revealEl.style.display = 'none';
  stageIndicator.style.display = 'block';
  inputContainer.style.display = 'flex';
  posterContainer.style.display = 'flex';
  fetchCorrectMovie();
}

// Initialize
console.log('Initializing poster game...');
loadMovies();
loadAvailableMovies();
updateStreaks();
startScreen.style.display = 'flex';
gameContainer.style.display = 'none';
revealEl.style.display = 'none';
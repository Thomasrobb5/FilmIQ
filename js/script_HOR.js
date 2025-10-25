// Cached DOM elements
const DOM = {
  gameContainer: document.getElementById('game-container'),
  modeIndicator: document.getElementById('mode-indicator'),
  currentStreakEl: document.getElementById('current-streak'),
  maxStreakEl: document.getElementById('max-streak'),
  topPanel: document.getElementById('top-panel'),
  bottomPanel: document.getElementById('bottom-panel'),
  posterA: document.getElementById('poster-a'),
  posterB: document.getElementById('poster-b'),
  movieAInfo: document.getElementById('movie-a-info'),
  movieBInfo: document.getElementById('movie-b-info'),
  resultOverlay: document.getElementById('result-overlay'),
  resultMessage: document.getElementById('result-message'),
  continueBtn: document.getElementById('continue-btn'),
  gameOverScreen: document.getElementById('game-over-screen'),
  gameOverMessage: document.getElementById('game-over-message'),
  previousGuesses: document.getElementById('previous-guesses'),
  shareBtn: document.getElementById('share-btn'),
  restartBtn: document.getElementById('restart-btn'),
  startScreen: document.getElementById('start-screen'),
  loadingScreen: document.getElementById('loading-screen'),
  openingModeBtn: document.getElementById('opening-mode-btn'),
  grossModeBtn: document.getElementById('gross-mode-btn'),
  statusContainer: document.querySelector('.status-container'),
};

// Game state
let movies = [];
let mode = null;
let currentA = null;
let currentB = null;
let currentStreak = 0;
let maxStreak = parseInt(localStorage.getItem('maxStreakHigherLower')) || 0;
let gameOver = false;
let isGuessing = false;
let guessHistory = [];
const API_KEY = '5aa575a9c26ba83afe8d98db4011c102';
const PLACEHOLDER_IMAGE = '/data/placeholder.jpg';

// Toggle overlay
function toggleOverlay(overlay, show) {
  overlay.classList.toggle('show', show);
}

// Show loading state
function showLoading() {
  toggleOverlay(DOM.loadingScreen, true);
}

// Hide loading state
function hideLoading() {
  toggleOverlay(DOM.loadingScreen, false);
}

// Load movie data from CSV
async function loadMovies() {
  showLoading();
  try {
    const response = await fetch('/data/movieboxofficefull_clean.csv');
    if (!response.ok) throw new Error('Failed to load CSV');
    const text = await response.text();
    const lines = text.split('\n').slice(1);
    movies = lines
      .map(line => {
        const parts = line.split(',').map(s => s.trim().replace(/"/g, ''));
        if (parts.length < 9) return null;
        const [rank, title, opening, total_gross, , , , , year] = parts;
        const openingNum = parseFloat(opening.replace(/[$,]/g, ''));
        const grossNum = parseFloat(total_gross.replace(/[$,]/g, ''));
        return {
          rank: parseInt(rank),
          title,
          opening: openingNum,
          gross: grossNum,
          year: parseInt(year),
        };
      })
      .filter(m => m && !isNaN(m.opening) && !isNaN(m.gross) && m.title && m.year);
    console.log(`Loaded ${movies.length} movies`);
  } catch (error) {
    console.error('Error loading CSV:', error);
    DOM.gameContainer.innerHTML = '<div>Error loading movies. Please try again later.</div>';
  } finally {
    hideLoading();
  }
}

// Get random movie
function getRandomMovie() {
  return movies[Math.floor(Math.random() * movies.length)];
}

// Get value based on mode
function getValue(movie) {
  return mode === 'opening' ? movie.opening : movie.gross;
}

// Format value as currency
function formatValue(value) {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Fetch poster URL from TMDB
async function getPoster(title, year) {
  const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}&year=${year}&include_adult=false`;
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) throw new Error('Failed to fetch poster');
    const data = await response.json();
    return data.results?.[0]?.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`
      : PLACEHOLDER_IMAGE;
  } catch (error) {
    console.error('Error fetching poster:', error);
    return PLACEHOLDER_IMAGE;
  }
}

// Update UI with current movies
async function updateMovieDisplay() {
  DOM.topPanel.classList.add('loading');
  DOM.bottomPanel.classList.add('loading');
  DOM.posterA.classList.add('loading');
  DOM.posterB.classList.add('loading');
  DOM.movieAInfo.classList.add('loading');
  DOM.movieBInfo.classList.add('loading');

  DOM.modeIndicator.textContent = `Mode: ${mode === 'opening' ? 'Opening Weekend' : 'Lifetime Gross'}`;
  const [posterAUrl, posterBUrl] = await Promise.all([
    getPoster(currentA.title, currentA.year),
    getPoster(currentB.title, currentB.year),
  ]);

  DOM.posterA.src = posterAUrl;
  DOM.posterA.alt = `Poster for ${currentA.title} (${currentA.year})`;
  DOM.movieAInfo.textContent = `${currentA.title} (${currentA.year})`;
  DOM.posterB.src = posterBUrl;
  DOM.posterB.alt = `Poster for ${currentB.title} (${currentB.year})`;
  DOM.movieBInfo.textContent = `${currentB.title} (${currentB.year})`;

  setTimeout(() => {
    DOM.topPanel.classList.remove('loading');
    DOM.bottomPanel.classList.remove('loading');
    DOM.posterA.classList.remove('loading');
    DOM.posterB.classList.remove('loading');
    DOM.movieAInfo.classList.remove('loading');
    DOM.movieBInfo.classList.remove('loading');
  }, 300);
}

// Add guess to history
function addGuess(guess, isCorrect, aValue, bValue) {
  guessHistory.push({
    aTitle: currentA.title,
    bTitle: currentB.title,
    guess,
    isCorrect,
    aValue: formatValue(aValue),
    bValue: formatValue(bValue),
  });
}
// Handle guess
async function handleGuess(thinkBHigher) {
  if (!isGuessing || gameOver) return;
  isGuessing = false;
  const aValue = getValue(currentA);
  const bValue = getValue(currentB);
  const isCorrect = thinkBHigher ? bValue > aValue : aValue > bValue;
  const guessText = thinkBHigher ? 'Bottom' : 'Top';
  addGuess(guessText, isCorrect, aValue, bValue);

  // Highlight panels
  if (isCorrect) {
    DOM[thinkBHigher ? 'bottomPanel' : 'topPanel'].classList.add('correct');
    DOM[thinkBHigher ? 'topPanel' : 'bottomPanel'].classList.add('incorrect');
  } else {
    DOM[thinkBHigher ? 'bottomPanel' : 'topPanel'].classList.add('incorrect');
    DOM[thinkBHigher ? 'topPanel' : 'bottomPanel'].classList.add('correct');
  }

  const label = mode === 'opening' ? 'Opening Weekend' : 'Lifetime Gross';
  DOM.resultMessage.innerHTML = `${isCorrect ? '🎉 Correct!' : '😔 Wrong!'}<br>${currentA.title}'s ${label}: ${formatValue(aValue)}<br>${currentB.title}'s ${label}: ${formatValue(bValue)}`;
  DOM.resultMessage.style.color = isCorrect ? '#00FF00' : '#FF6B6B';
  DOM.continueBtn.textContent = isCorrect ? 'Next' : 'See Results';
  DOM.continueBtn.disabled = true;

  setTimeout(() => {
    DOM.continueBtn.disabled = false;
    DOM.continueBtn.focus();
  }, 300);

  DOM.continueBtn.onclick = async () => {
    DOM.topPanel.classList.remove('correct', 'incorrect');
    DOM.bottomPanel.classList.remove('correct', 'incorrect');
    toggleOverlay(DOM.resultOverlay, false);
    if (isCorrect) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
      updateStatus();
      await startNewPair();
      isGuessing = true;
    } else {
      showGameOver();
    }
  };
  toggleOverlay(DOM.resultOverlay, true);
  updateStatus();
}

// Show game over screen
function showGameOver() {
  gameOver = true;
  toggleOverlay(DOM.gameOverScreen, true);
  DOM.gameOverMessage.innerHTML = `Game Over! Streak: ${currentStreak}`;
  DOM.previousGuesses.innerHTML = '';
  guessHistory.forEach(guess => {
    const div = document.createElement('div');
    div.className = 'guess-item';
    div.textContent = `${guess.aTitle} (${guess.aValue}) vs ${guess.bTitle} (${guess.bValue}): Guessed ${guess.guess} ${guess.isCorrect ? '✅' : '❌'}`;
    div.style.color = guess.isCorrect ? '#00FF00' : '#FF0000';
    DOM.previousGuesses.appendChild(div);
  });
  const shareText = `🎬 FilmIQ Higher or Lower (${mode === 'opening' ? 'Opening' : 'Gross'}) 🎉 Streak: ${currentStreak}! 🔥 Beat my score? Play at https://filmiq.app/higherlower.html`;
  DOM.shareBtn.onclick = () => {
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Score copied to clipboard!');
    }
  };
  DOM.statusContainer.style.display = 'none'; // Hide status on game over
}

// Update status
function updateStatus() {
  DOM.currentStreakEl.textContent = `Current Streak: ${currentStreak}`;
  DOM.maxStreakEl.textContent = `Max Streak: ${maxStreak}`;
  localStorage.setItem('maxStreakHigherLower', maxStreak);
}

// Start new pair
async function startNewPair() {
  do {
    currentA = getRandomMovie();
    currentB = getRandomMovie();
  } while (currentB.title === currentA.title || getValue(currentB) === getValue(currentA));
  await updateMovieDisplay();
}

// Start game after mode selection
async function startGame(selectedMode) {
  mode = selectedMode;
  guessHistory = [];
  currentStreak = 0;
  gameOver = false;
  isGuessing = true;
  toggleOverlay(DOM.startScreen, false);
  toggleOverlay(DOM.gameContainer, true);
  DOM.statusContainer.style.display = 'flex'; // Show status in header
  await startNewPair();
  updateStatus();
}

// Restart game
function restartGame() {
  currentStreak = 0;
  gameOver = false;
  isGuessing = false;
  DOM.topPanel.classList.remove('correct', 'incorrect');
  DOM.bottomPanel.classList.remove('correct', 'incorrect');
  DOM.posterA.src = PLACEHOLDER_IMAGE;
  DOM.posterB.src = PLACEHOLDER_IMAGE;
  DOM.movieAInfo.textContent = '';
  DOM.movieBInfo.textContent = '';
  toggleOverlay(DOM.gameOverScreen, false);
  toggleOverlay(DOM.startScreen, true);
  toggleOverlay(DOM.gameContainer, false);
  DOM.statusContainer.style.display = 'none'; // Hide status on start screen
}

// Event listeners
DOM.topPanel.onclick = () => handleGuess(false);
DOM.bottomPanel.onclick = () => handleGuess(true);
DOM.topPanel.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && handleGuess(false);
DOM.bottomPanel.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && handleGuess(true);
DOM.openingModeBtn.onclick = () => startGame('opening');
DOM.grossModeBtn.onclick = () => startGame('gross');
DOM.restartBtn.onclick = restartGame;

// Initialize
loadMovies().then(() => {
  updateStatus();
});
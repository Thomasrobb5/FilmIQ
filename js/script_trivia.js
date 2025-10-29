// Placeholder for questions - load from external JSON or database
// Example: fetch('questions.json').then(response => response.json()).then(data => { questions = data; init(); });
let questions = {
  Marvel: {
    easy: [
      { question: "Sample easy Marvel question?", options: ["A", "B", "C", "D"], answer: "A" }
    ],
    medium: [
      { question: "Sample medium Marvel question?", options: ["A", "B", "C", "D"], answer: "B" }
    ],
    hard: [
      { question: "Sample hard Marvel question?", options: ["A", "B", "C", "D"], answer: "C" }
    ]
  },
  // Add more franchises similarly, or load dynamically
};

// Franchise color themes (update as needed based on loaded questions)
const franchiseColors = {
  Marvel: { primary: '#ED1D24', secondary: '#FFD700' }, // Red/Gold
  // Add more...
};

// Game constants
const TARGET_SCORE = 100;
const TIME_LIMIT = 10; // seconds
const SCORING = { easy: 10, medium: 20, hard: 30 };
const PENALTY = 10;
const BONUS_CHANCE = 0.2; // 20% chance for double points

// Global variables (single-player only)
let myScore = 0;
let currentFranchise = '';
let currentDifficulty = '';
let currentQuestion = null;
let timerInterval = null;
let multiplier = 1; // For bonus rounds

const container = document.querySelector('.trivia-container');

// Helper to render content
function render(html) {
  container.innerHTML = html;
}

// Apply theme colors
function applyTheme(franchise) {
  const colors = franchiseColors[franchise] || { primary: '#fff', secondary: '#000' };
  document.documentElement.style.setProperty('--primary-color', colors.primary);
  document.documentElement.style.setProperty('--secondary-color', colors.secondary);
}

// Get random question
function getRandomQuestion(franchise, difficulty) {
  const pool = questions[franchise][difficulty];
  if (!pool || pool.length === 0) {
    return { question: "No questions available for this category.", options: [], answer: "" };
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// Start timer
function startTimer(callback) {
  let timeLeft = TIME_LIMIT;
  const timerEl = document.getElementById('timer');
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.textContent = `Time left: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      callback(null); // No answer
    }
  }, 1000);
}

// Single-player mode (only mode now)
function startSinglePlayer() {
  myScore = 0;
  renderSinglePlayerChooser();
}

function renderSinglePlayerChooser() {
  const franchises = Object.keys(questions);
  const difficulties = ['easy', 'medium', 'hard'];
  let html = `
    <h2>Choose Franchise and Difficulty</h2>
    <select id="franchise">
      ${franchises.map(f => `<option value="${f}">${f}</option>`).join('')}
    </select>
    <select id="difficulty">
      ${difficulties.map(d => `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
    </select>
    <button class="button" onclick="playSingleRound()">Start Round</button>
    <div id="score">Score: ${myScore} / ${TARGET_SCORE}</div>
  `;
  render(html);
}

function playSingleRound() {
  currentFranchise = document.getElementById('franchise').value;
  currentDifficulty = document.getElementById('difficulty').value;
  applyTheme(currentFranchise);
  currentQuestion = getRandomQuestion(currentFranchise, currentDifficulty);
  const isBonus = Math.random() < BONUS_CHANCE;
  multiplier = isBonus ? 2 : 1;
  let html = `
    <h2>${currentFranchise} - ${currentDifficulty.toUpperCase()} ${isBonus ? '(Double Points!)' : ''}</h2>
    <p>${currentQuestion.question}</p>
    ${currentQuestion.options.map((opt, i) => `<button class="button option-button" onclick="submitAnswer(${i})">${opt}</button>`).join('')}
    <div id="timer">Time left: ${TIME_LIMIT}s</div>
    <div id="score">Score: ${myScore} / ${TARGET_SCORE}</div>
  `;
  render(html);
  startTimer(handleSingleAnswer);
}

function submitAnswer(index) {
  clearInterval(timerInterval);
  const answer = currentQuestion.options[index];
  handleSingleAnswer(answer);
}

function handleSingleAnswer(answer) {
  const correct = answer === currentQuestion.answer;
  const points = SCORING[currentDifficulty] * multiplier;
  myScore += correct ? points : -PENALTY * multiplier;
  myScore = Math.max(0, myScore); // No negative scores
  const feedback = correct ? 'correct' : 'incorrect';
  render(`
    <h2 class="${feedback}">${correct ? 'Correct!' : 'Incorrect!'}</h2>
    <p>Answer: ${currentQuestion.answer}</p>
    <p>Points: ${correct ? '+' + points : '-' + PENALTY * multiplier}</p>
    <div id="score">Score: ${myScore} / ${TARGET_SCORE}</div>
    <button class="button" onclick="${myScore >= TARGET_SCORE ? 'endGame()' : 'renderSinglePlayerChooser()'}">Next</button>
  `);
}

function endGame() {
  let html = `
    <h2>Game Over!</h2>
    <p>You reached ${TARGET_SCORE} points!</p>
    <p>Your score: ${myScore}</p>
    <button class="button" onclick="location.reload()">Play Again</button>
  `;
  render(html);
}

// Initial screen (single-player only)
function init() {
  let html = `
    <h2>Welcome to FilmIQ Trivia</h2>
    <button class="button" onclick="startSinglePlayer()">Start Single Player</button>
  `;
  render(html);
}

init();
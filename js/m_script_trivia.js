let currentQuestion = 0;
let score = 0;
let currentThemeQuestions = [];
let allQuestions = [];
let timerInterval;
let timeLeft;
let sounds;
let volume = 0.3;
let currentRound = 0;


const themes = [
  { name: 'Marvel', img: 'marvel_logo.png' },
  { name: 'Star Wars', img: 'starwars_logo.png' },
  { name: 'Harry Potter', img: 'harrypotter_logo.png' },
  { name: 'Lord of the Rings', img: 'lordoftherings_logo.png' },
  { name: 'Game of Thrones WIP', img: 'gameofthrones_logo.png' },
  { name: 'Breaking Bad WIP', img: 'breakingbad_logo.png' },
  { name: 'DC Universe WIP', img: 'dcuniverse_logo.png' },
  { name: 'Pirates of the Caribbean WIP', img: 'piratesofthecaribbean_logo.png' },
  { name: 'Jurassic Park WIP', img: 'jurassicpark_logo.png' }
];

// Shuffle array helper
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

async function loadQuestions() {
  try {
    const response = await fetch('./data/questions.csv');
    if (!response.ok) throw new Error('Failed to fetch CSV');
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('windows-1252');
    const text = decoder.decode(buffer);
    
    // Normalize curly quotes to straight apostrophes (prevents future issues)
    const normalizedText = text.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
                               .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
    
    const lines = normalizedText.split('\n').slice(1); // Skip header
    allQuestions = [];
    lines
      .filter(line => line.trim())
      .forEach(line => {
        const parts = parseCSVLine(line);
        if (parts.length >= 8) {
          const [theme, question, option_a, option_b, option_c, option_d, correct, levelStr] = parts.slice(0, 8);
          const level = parseInt(levelStr.trim());
          const correctIndex = correct.charCodeAt(0) - 65; 
          if (!isNaN(level) && level >= 1 && level <= 3 && !isNaN(correctIndex) && correctIndex >= 0 && correctIndex <= 3) {
            allQuestions.push({
              theme: theme.trim(),
              question: question.trim(),
              options: [option_a.trim(), option_b.trim(), option_c.trim(), option_d.trim()],
              correct: correctIndex,
              level: level
            });
          }
        }
      });
    console.log(`Loaded ${allQuestions.length} questions across ${[...new Set(allQuestions.map(q => q.theme))].length} themes.`);
  } catch (e) {
    console.error('Failed to load CSV:', e);
    alert('Error loading questions. Please check the CSV file.');
    // Fallback: Use empty array or sample data if needed
    allQuestions = [];
  }
}

// Preload sounds
function initSounds() {
  sounds = {
    correct: new Audio('./data/sounds/correct.mp3'),
    wrong: new Audio('./data/sounds/wrong.mp3'),
    timer: new Audio('./data/sounds/timer.mp3'),
    hover: new Audio('./data/sounds/button_hover.mp3')
  };
  Object.values(sounds).forEach(sound => {
    sound.volume = volume;
    sound.preload = 'auto';
  });
  sounds.timer.loop = true; // Timer loops during countdown
}

function playSound(soundName) {
  if (sounds && sounds[soundName]) {
    sounds[soundName].currentTime = 0; // Reset to start for short sounds
    sounds[soundName].play().catch(e => console.log('Audio play failed:', e));
  }
}

function startTimer() {
  timeLeft = 20; // 20 seconds per question (mobile: same as desktop)
  document.getElementById('timerDisplay').textContent = timeLeft;
  sounds.timer.play().catch(e => console.log('Timer audio play failed:', e));
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timerDisplay').textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      sounds.timer.pause();
      sounds.timer.currentTime = 0;
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  sounds.timer.pause();
  sounds.timer.currentTime = 0;
}

function handleTimeout() {
  // Treat as wrong: play wrong sound, highlight correct
  playSound('wrong');
  const options = document.querySelectorAll('.option');
  options.forEach(opt => opt.style.pointerEvents = 'none');
  options[currentThemeQuestions[currentQuestion].correct].classList.add('correct');
  updateRoundDisplay(); // Update after "completion"
  setTimeout(() => nextQuestion(), 2500); // Slightly longer delay for mobile
}

function initRoundDisplay() {
  const squaresContainer = document.getElementById('roundSquares');
  squaresContainer.innerHTML = ''; // Clear
  
  // Create 15 squares: first 7 easy (green), next 5 medium (orange), last 3 hard (red)
  for (let i = 0; i < 15; i++) {
    const square = document.createElement('div');
    square.className = `round-square ${i < 7 ? 'easy' : i < 12 ? 'medium' : 'hard'}`;
    squaresContainer.appendChild(square);
  }
  
  document.getElementById('roundDisplay').style.display = 'flex'; // Show on game start
}

function updateRoundDisplay() {
  currentRound++; // Increment (1-15)
  const squares = document.querySelectorAll('#roundSquares .round-square');
  
  // Clear all active
  squares.forEach(sq => sq.classList.remove('active'));
  
  // Activate up to currentRound (1-based index, 0-based array)
  if (currentRound > 0 && currentRound <= 15) {
    for (let i = 0; i < currentRound; i++) {
      squares[i].classList.add('active');
    }
  }
}

function startGame() {
  document.getElementById('startScreen').classList.remove('active');
  document.getElementById('themeScreen').classList.add('active');
  populateThemes();
}

function populateThemes() {
  const grid = document.getElementById('themeGrid');
  grid.innerHTML = '';
  themes.forEach(theme => {
    const item = document.createElement('div');
    item.className = 'theme-item';
    item.onclick = () => selectTheme(theme.name);
    // Add touchstart for mobile feedback
    item.ontouchstart = () => playSound('hover');
    item.innerHTML = `
      <img src="./data/theme_logos/${theme.img}" alt="${theme.name} Logo">
      <p>${theme.name}</p>
    `;
    grid.appendChild(item);
  });
}

function selectTheme(themeName) {
  // Filter by theme
  const themeQuestions = allQuestions.filter(q => q.theme === themeName);
  
  // Group by level
  const easy = themeQuestions.filter(q => q.level === 1);
  const medium = themeQuestions.filter(q => q.level === 2);
  const hard = themeQuestions.filter(q => q.level === 3);
  
  // Shuffle each group
  shuffle(easy);
  shuffle(medium);
  shuffle(hard);
  
  // Select required numbers (no dups, random within level)
  const selectedEasy = easy.slice(0, 7);
  const selectedMedium = medium.slice(0, 5);
  const selectedHard = hard.slice(0, 3);
  
  if (selectedEasy.length < 7 || selectedMedium.length < 5 || selectedHard.length < 3) {
    alert(`Not enough questions for ${themeName}! Need 7 easy, 5 medium, 3 hard.`);
    return;
  }
  
  // Concat in order: easy -> medium -> hard
  currentThemeQuestions = [...selectedEasy, ...selectedMedium, ...selectedHard];
  
  document.getElementById('themeScreen').classList.remove('active');
  document.getElementById('questionScreen').classList.add('active');
  currentQuestion = 0;
  currentRound = 0;
  score = 0;
  initRoundDisplay(); // Setup 15 squares
  loadQuestion();
}

function loadQuestion() {
  if (currentQuestion < currentThemeQuestions.length) {
    document.getElementById('questionText').textContent = currentThemeQuestions[currentQuestion].question;
    const options = document.querySelectorAll('.option');
    currentThemeQuestions[currentQuestion].options.forEach((opt, idx) => {
      options[idx].textContent = opt;
      options[idx].dataset.answer = idx;
      options[idx].classList.remove('selected', 'correct', 'wrong');
      options[idx].style.pointerEvents = 'auto'; // Re-enable
    });
    startTimer(); // Start 20s timer
  } else {
    endGame();
  }
}

function selectAnswer(selected) {
  stopTimer(); // Stop timer on answer
  const selectedIndex = parseInt(selected.dataset.answer);
  const options = document.querySelectorAll('.option');
  options.forEach(opt => opt.style.pointerEvents = 'none');
  
  if (selectedIndex === currentThemeQuestions[currentQuestion].correct) {
    selected.classList.add('correct');
    score++;
    playSound('correct');
    updateRoundDisplay(); // Light up current round (progressive fill)
    setTimeout(() => nextQuestion(), 2500); // Longer delay for mobile
  } else {
    selected.classList.add('wrong');
    options[currentThemeQuestions[currentQuestion].correct].classList.add('correct');
    playSound('wrong');
    updateRoundDisplay(); // Still advance round
    setTimeout(() => nextQuestion(), 2500);
  }
}

function nextQuestion() {
  currentQuestion++;
  loadQuestion();
}

function endGame() {
  stopTimer();
  updateRoundDisplay(); // Finalize display (all 15 active if completed)
  document.getElementById('questionScreen').innerHTML = `
    <div style="text-align:center; padding:40px; z-index:5; position:relative; background: rgba(0,0,0,0.5); border-radius: 20px; margin: 20px;">
      <h2 style="color: #fff; text-shadow: 2px 2px 0 #000;">Game Over! Score: ${score}/15</h2>
      <button onclick="location.reload()" class="pixel-btn" style="margin-top: 20px;">Play Again</button>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuestions();
  initSounds();
  document.getElementById('roundDisplay').style.display = 'none'; // Hide initially
});
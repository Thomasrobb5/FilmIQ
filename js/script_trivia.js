let currentQuestion = 0;
let score = 0;
let currentThemeQuestions = [];
let allQuestions = [];
let timerInterval;
let timeLeft;
let sounds;
let volume = 0.3;
let currentRound = 0;
let roundResults = [];
let currentTheme = null;
let fiftyFiftyAvailable = true;
let skipAvailable = true;
let usedQuestions = new Set();
let gameStarted = false;
let currentSlideIndex = 0;

const themes = [
  { name: 'Marvel', img: 'marvel_logo.png' },
  { name: 'Star Wars', img: 'starwars_logo.png' },
  { name: 'Harry Potter', img: 'harrypotter_logo.png' },
  { name: 'Lord of the Rings', img: 'lordoftherings_logo.png' },
  { name: 'Game of Thrones', img: 'gameofthrones_logo.png' },
  { name: 'Breaking Bad', img: 'breakingbad_logo.png' },
  { name: 'DC Universe', img: 'dcuniverse_logo.png' },
  { name: 'Pirates of the Caribbean', img: 'piratesofthecaribbean_logo.png' },
  { name: 'Jurassic Park', img: 'jurassicpark_logo.png' }
];

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
    
    const normalizedText = text.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
                               .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
    
    const lines = normalizedText.split('\n').slice(1);
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
    console.log(`Loaded ${allQuestions.length} questions.`);
  } catch (e) {
    console.error('Failed to load CSV:', e);
    alert('Error loading questions. Please check the CSV file.');
    allQuestions = [];
  }
}

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
  sounds.timer.loop = true;
}

function playSound(soundName) {
  if (sounds && sounds[soundName]) {
    sounds[soundName].currentTime = 0;
    sounds[soundName].play().catch(e => console.log('Audio play failed:', e));
  }
}

function startTimer() {
  timeLeft = 20;
  document.getElementById('timerDisplay').textContent = timeLeft;
  sounds.timer.play().catch(() => {});
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
  playSound('wrong');
  roundResults.push(false);
  const options = document.querySelectorAll('.option');
  options.forEach(opt => opt.style.pointerEvents = 'none');
  options[currentThemeQuestions[currentQuestion].correct].classList.add('correct');
  updateRoundDisplay();
  setTimeout(() => nextQuestion(), 2000);
}

function initRoundDisplay() {
  const squaresContainer = document.getElementById('roundSquares');
  squaresContainer.innerHTML = '';
  for (let i = 0; i < 15; i++) {
    const square = document.createElement('div');
    square.className = `round-square ${i < 7 ? 'easy' : i < 12 ? 'medium' : 'hard'}`;
    squaresContainer.appendChild(square);
  }
  document.getElementById('roundDisplay').style.display = 'flex';
}

function updateRoundDisplay() {
  currentRound++;
  const squares = document.querySelectorAll('#roundSquares .round-square');
  squares.forEach(sq => {
    sq.classList.remove('active', 'success', 'fail');
  });
  if (currentRound > 0 && currentRound <= 15) {
    for (let i = 0; i < currentRound; i++) {
      squares[i].classList.add('active');
      if (roundResults[i]) squares[i].classList.add('success');
      else squares[i].classList.add('fail');
    }
  }
}

function startGame() {
  document.getElementById('startScreen').classList.remove('active');
  document.getElementById('themeScreen').classList.add('active');
  populateCarousel();
}

function getBackingImageName(themeName) {
  return themeName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') + '_backing.png';
}

function populateCarousel() {
  const track = document.getElementById('carouselTrack');
  track.innerHTML = '';
  themes.forEach((theme, index) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.onclick = () => selectTheme(theme.name);
    const backing = getBackingImageName(theme.name);
    slide.style.backgroundImage = `url('./data/triv_game/${backing}')`;
    slide.innerHTML = `
      <div class="carousel-slide-content">
        <img src="./data/theme_logos/${theme.img}" alt="${theme.name} Logo" class="carousel-logo">
        <p>${theme.name}</p>
      </div>
    `;
    track.appendChild(slide);
  });

  // Populate quick select bar
  const quickBar = document.getElementById('quickSelectBar');
  quickBar.innerHTML = '';
  themes.forEach((theme, index) => {
    const btn = document.createElement('button');
    btn.className = 'quick-select-btn';
    btn.innerHTML = `<img src="./data/theme_logos/${theme.img}" alt="${theme.name}" class="quick-logo">`;
    btn.onclick = (e) => {
      e.stopPropagation();
      scrollToSlide(index);
    };
    quickBar.appendChild(btn);
  });

  // Initialize carousel navigation
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  prevBtn.onclick = () => scrollToSlide(currentSlideIndex - 1);
  nextBtn.onclick = () => scrollToSlide(currentSlideIndex + 1);

  // Optional: Add touch/swipe support if needed, but CSS scroll-snap handles flicking
  scrollToSlide(0); // Start at first slide
}

function scrollToSlide(index) {
  const track = document.getElementById('carouselTrack');
  const slideWidth = track.clientWidth;
  currentSlideIndex = Math.max(0, Math.min(index, themes.length - 1));
  track.scrollTo({
    left: currentSlideIndex * slideWidth,
    behavior: 'smooth'
  });

  // Update active quick select button
  document.querySelectorAll('.quick-select-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === currentSlideIndex);
  });
}

function selectTheme(themeName) {
  currentTheme = themes.find(t => t.name === themeName);
  const themeQuestions = allQuestions.filter(q => q.theme === themeName);
  const easy = themeQuestions.filter(q => q.level === 1);
  const medium = themeQuestions.filter(q => q.level === 2);
  const hard = themeQuestions.filter(q => q.level === 3);
  shuffle(easy); shuffle(medium); shuffle(hard);
  const selectedEasy = easy.slice(0, 7);
  const selectedMedium = medium.slice(0, 5);
  const selectedHard = hard.slice(0, 3);
  if (selectedEasy.length < 7 || selectedMedium.length < 5 || selectedHard.length < 3) {
    alert(`Not enough questions for ${themeName}!`);
    return;
  }
  currentThemeQuestions = [...selectedEasy, ...selectedMedium, ...selectedHard];
  document.getElementById('themeScreen').classList.remove('active');
  document.getElementById('themeIntroScreen').classList.add('active');
  populateThemeIntro();
  document.getElementById('powerUpsDisplay').style.display = 'flex';
}

function populateThemeIntro() {
  document.getElementById('themeIntroLogo').src = `./data/theme_logos/${currentTheme.img}`;
  document.getElementById('themeNameInInstructions').textContent = currentTheme.name;
}

function goBackToThemes() {
  document.getElementById('themeIntroScreen').classList.remove('active');
  document.getElementById('themeScreen').classList.add('active');
  document.getElementById('powerUpsDisplay').style.display = 'none';
  currentSlideIndex = 0; // Reset carousel
  scrollToSlide(0);
}

function startThemeGame() {
  document.getElementById('themeIntroScreen').classList.remove('active');
  document.getElementById('questionScreen').classList.add('active');
  currentQuestion = 0;
  currentRound = 0;
  score = 0;
  roundResults = [];
  fiftyFiftyAvailable = true;
  skipAvailable = true;
  usedQuestions.clear();
  gameStarted = true;
  initRoundDisplay();
  loadQuestion();
}

function loadQuestion() {
  stopTimer();
  if (currentQuestion >= currentThemeQuestions.length) {
    endGame();
    return;
  }
  const q = currentThemeQuestions[currentQuestion];
  usedQuestions.add(q.question);
  document.getElementById('questionText').textContent = q.question;
  const options = document.querySelectorAll('.option');
  q.options.forEach((opt, idx) => {
    options[idx].textContent = opt;
    options[idx].dataset.answer = idx;
    options[idx].classList.remove('selected', 'correct', 'wrong', 'hidden');
    options[idx].style.display = 'block';
    options[idx].style.pointerEvents = 'auto';
  });
  startTimer();
}

function useFiftyFifty() {
  if (!gameStarted || !fiftyFiftyAvailable) return;
  fiftyFiftyAvailable = false;
  const box = document.getElementById('fiftyFiftyBox');
  box.classList.add('activating');
  playSound('hover');
  setTimeout(() => {
    box.style.display = 'none';
    checkAndHidePowersDisplay();
  }, 800);

  const correctIdx = currentThemeQuestions[currentQuestion].correct;
  const wrong = [0,1,2,3].filter(i => i !== correctIdx);
  const toHide = shuffle([...wrong]).slice(0, 2);
  toHide.forEach(idx => {
    const opt = document.querySelector(`.option[data-answer="${idx}"]`);
    opt.classList.add('hidden');
    opt.style.display = 'none';
    opt.style.pointerEvents = 'none';
  });
}

function useSkip() {
  if (!gameStarted || !skipAvailable) return;
  skipAvailable = false;
  const box = document.getElementById('skipBox');
  box.classList.add('activating');
  playSound('hover');
  setTimeout(() => {
    box.style.display = 'none';
    checkAndHidePowersDisplay();
  }, 800);

  const currentLevel = currentThemeQuestions[currentQuestion].level;
  const available = allQuestions
    .filter(q => q.theme === currentTheme.name && q.level === currentLevel && !usedQuestions.has(q.question))
    .filter(q => !currentThemeQuestions.includes(q));

  if (available.length === 0) {
    alert('No more questions for this level! Moving to next.');
    nextQuestion();
    return;
  }

  const newQ = shuffle(available)[0];
  usedQuestions.add(newQ.question);
  currentThemeQuestions[currentQuestion] = newQ;

  loadQuestion();
}

function checkAndHidePowersDisplay() {
  if (!fiftyFiftyAvailable && !skipAvailable) {
    document.getElementById('powerUpsDisplay').style.display = 'none';
  }
}

function selectAnswer(selected) {
  stopTimer();
  const selectedIndex = parseInt(selected.dataset.answer);
  const options = document.querySelectorAll('.option');
  options.forEach(opt => opt.style.pointerEvents = 'none');
  const isCorrect = selectedIndex === currentThemeQuestions[currentQuestion].correct;
  roundResults.push(isCorrect);
  if (isCorrect) {
    selected.classList.add('correct');
    score++;
    playSound('correct');
  } else {
    selected.classList.add('wrong');
    options[currentThemeQuestions[currentQuestion].correct].classList.add('correct');
    playSound('wrong');
  }
  updateRoundDisplay();
  setTimeout(() => nextQuestion(), 2000);
}

function nextQuestion() {
  currentQuestion++;
  loadQuestion();
}

function endGame() {
  stopTimer();
  updateRoundDisplay();
  document.getElementById('powerUpsDisplay').style.display = 'none';
  gameStarted = false;
  document.getElementById('questionScreen').innerHTML = `
    <div style="text-align:center; padding:40px; z-index:5; position:relative;">
      <h2>Game Over! Score: ${score}/15</h2>
      <button onclick="location.reload()" class="pixel-btn">Play Again</button>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuestions();
  initSounds();
  document.getElementById('roundDisplay').style.display = 'none';
  document.getElementById('powerUpsDisplay').style.display = 'none';
});
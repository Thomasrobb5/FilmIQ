const toggle = document.getElementById('theme-toggle');
const body = document.body;

// Check for saved theme, default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';  // 'dark' as fallback
body.setAttribute('data-theme', savedTheme);
toggle.checked = savedTheme === 'dark';  // Toggle starts checked for dark

toggle.addEventListener('change', () => {
    const theme = toggle.checked ? 'dark' : 'light';
    body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
});

// Animate cards on load
const cards = document.querySelectorAll('.game-card');
cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, index * 100);
});

// Generate and position floating icons in an even grid with small random offsets
const iconSources = ['bg_icons/icon1.png', 'bg_icons/icon2.png', 'bg_icons/icon3.png', 'bg_icons/icon4.png', 'bg_icons/icon5.png', 'bg_icons/icon6.png', 'bg_icons/icon7.png', 'bg_icons/icon8.png'];
const numIcons = 40;
const cols = 5; // Fewer cols for better horizontal balance
const rows = 8; // More rows for even vertical spread
const spacingX = 100 / (cols - 1);
const spacingY = 100 / (rows - 1);
const offsetVariance = 8; // Slightly more scatter
const icons = []; // Store for parallax

for (let i = 0; i < numIcons; i++) {
    const icon = document.createElement('img');
    icon.className = 'floating-icon';
    icon.src = iconSources[Math.floor(Math.random() * iconSources.length)];
    icon.alt = `Background Icon ${i + 1}`;

    const col = i % cols;
    const row = Math.floor(i / cols);
    let x = col * spacingX;
    let y = row * spacingY;
    x += (Math.random() - 0.5) * offsetVariance * 2; // +/- offset
    y += (Math.random() - 0.5) * offsetVariance * 2;
    icon.style.left = `${Math.max(0, Math.min(100, x))}%`;
    icon.style.top = `${Math.max(0, Math.min(100, y))}%`;

    const rotation = Math.random() * 360 - 180;
    icon.dataset.baseTransform = `rotate(${rotation}deg)`;
    icon.style.transform = icon.dataset.baseTransform;
    icon.style.setProperty('--hover-rot', `rotate(${rotation + (Math.random() * 30 - 15)}deg)`);

    const sizeVar = 0.8 + Math.random() * 0.4;
    icon.style.width = `${40 * sizeVar}px`;
    icon.style.height = `${40 * sizeVar}px`;

    const baseOpacity = 0.2 + Math.random() * 0.4;
    icon.style.opacity = `${baseOpacity}`;

    // Staggered entrance
    icon.style.opacity = '0';
    icon.style.transform = `${icon.dataset.baseTransform} scale(0)`;
    setTimeout(() => {
        icon.style.transition = 'all 0.8s ease';
        icon.style.opacity = `${baseOpacity}`;
        icon.style.transform = icon.dataset.baseTransform + ' scale(1)';
    }, i * 50);

    body.appendChild(icon);
    icons.push(icon);
}

// Subtle parallax for icons on scroll (using transform to avoid unit issues)
let ticking = false;
function updateParallax() {
    const scrollY = window.scrollY;
    const offsetY = -scrollY * 0.2; // Negative for lagging effect (depth)
    icons.forEach(icon => {
        icon.style.transform = `${icon.dataset.baseTransform} translateY(${offsetY}px)`;
    });
    ticking = false;
}

function requestParallax() {
    if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
    }
}
window.addEventListener('scroll', requestParallax, { passive: true });

// CSV Parser
function parseCSV(text) {
    const lines = text.split('\n');
    const result = [];
    for (let line of lines) {
        if (!line.trim()) continue;
        const fields = [];
        let current = '';
        let inQuote = false;
        for (let char of line) {
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                fields.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        fields.push(current.trim());
        result.push(fields);
    }
    return result;
}

// Daily movie quote loader from CSV
function loadDailyQuote() {
    const today = new Date().toDateString();
    const cacheKey = `dailyQuote_${today}`;
    const quoteContent = document.getElementById('quote-content');
    const quoteAuthor = document.getElementById('quote-author');

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const data = JSON.parse(cached);
        quoteContent.textContent = data.content;
        quoteAuthor.textContent = `— ${data.author}`;
        return;
    }

    const quotesCacheKey = 'movieQuotes';
    let quotes = JSON.parse(localStorage.getItem(quotesCacheKey));

    if (!quotes || quotes.length === 0) {
        fetch('./data/moviequotes.csv')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch CSV');
                }
                return response.text();
            })
            .then(text => {
                const parsed = parseCSV(text);
                if (parsed.length < 2) {
                    throw new Error('Invalid CSV');
                }
                quotes = parsed.slice(1).map(row => ({
                    quote: row[0],
                    author: row[1],
                    year: row[2]
                })).filter(q => q.quote && q.quote.trim());
                localStorage.setItem(quotesCacheKey, JSON.stringify(quotes));
                selectAndSetQuote(quotes, today, cacheKey, quoteContent, quoteAuthor);
            })
            .catch(() => fallbackQuote(quoteContent, quoteAuthor));
    } else {
        selectAndSetQuote(quotes, today, cacheKey, quoteContent, quoteAuthor);
    }
}

function selectAndSetQuote(quotes, todayStr, cacheKey, contentEl, authorEl) {
    const now = new Date(todayStr);
    const start = new Date(now.getFullYear(), 0, 0);
    let dayOfYear = Math.floor((now - start) / 86400000);
    dayOfYear -= 1; // Adjust to make Jan 1 index 0
    const index = dayOfYear % quotes.length;
    const selected = quotes[index];
    contentEl.textContent = selected.quote;
    authorEl.textContent = `— ${selected.author}`;
    const data = { content: selected.quote, author: selected.author };
    localStorage.setItem(cacheKey, JSON.stringify(data));
}

function fallbackQuote(contentEl, authorEl) {
    contentEl.textContent = "May the Force be with you.";
    authorEl.textContent = "— Obi-Wan Kenobi";
}


loadDailyQuote();
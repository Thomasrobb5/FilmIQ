// Mobile Detection and Redirection
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

if (!isMobileDevice()) {
    window.location.href = 'index.html';
}

// Theme Toggle
const toggle = document.getElementById('theme-toggle');
const body = document.body;

const savedTheme = localStorage.getItem('theme') || 'dark';
body.setAttribute('data-theme', savedTheme);
toggle.checked = savedTheme === 'dark';

toggle.addEventListener('change', () => {
    const theme = toggle.checked ? 'dark' : 'light';
    body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
});

// Hamburger Menu
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
        hamburger.setAttribute('aria-expanded', !isExpanded);
        navMenu.classList.toggle('active');
    });
}

// Lazy Load Game Card Images
const gameImages = document.querySelectorAll('.game-card img');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.src = entry.target.dataset.src || entry.target.src;
            observer.unobserve(entry.target);
        }
    });
}, { rootMargin: '50px' });

gameImages.forEach(img => {
    if (img.src) {
        img.dataset.src = img.src;
        img.src = '';
    }
    observer.observe(img);
});

// Animate Cards on Load
const cards = document.querySelectorAll('.game-card');
cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, index * 150);
});

// CSV Parser
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const result = [];
    for (let line of lines) {
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

// Daily Movie Quote Loader
    function loadDailyQuote() {
        const quoteBlock = document.getElementById('daily-quote');
        if (!quoteBlock) return; // Exit early if not on homepage

        const quoteContent = document.getElementById('quote-content');
        const quoteAuthor = document.getElementById('quote-author');
        const quoteSource = document.getElementById('quote-source');

        // Double-check all elements exist
        if (!quoteContent || !quoteAuthor || !quoteSource) return;

        const today = new Date().toDateString();
        const cacheKey = `dailyQuote_${today}`;

        quoteBlock.setAttribute('aria-busy', 'true');

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const data = JSON.parse(cached);
            quoteContent.textContent = data.content;
            quoteAuthor.textContent = `— ${data.author}`;
            quoteSource.textContent = data.source;
            quoteBlock.setAttribute('aria-busy', 'false');
            return;
        }

        const quotesCacheKey = 'movieQuotes';
        let quotes = JSON.parse(localStorage.getItem(quotesCacheKey));

        if (!quotes || quotes.length === 0) {
            fetch('./data/moviequotes2.csv')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch CSV');
                    return response.text();
                })
                .then(text => {
                    const parsed = parseCSV(text);
                    if (parsed.length < 2) throw new Error('Invalid CSV');
                    quotes = parsed.slice(1).map(row => ({
                        quote: row[0],
                        author: row[1],
                        source: row[3]
                    })).filter(q => q.quote && q.quote.trim());
                    localStorage.setItem(quotesCacheKey, JSON.stringify(quotes));
                    selectAndSetQuote(quotes, today, cacheKey, quoteContent, quoteAuthor, quoteSource, quoteBlock);
                })
                .catch(() => {
                    fallbackQuote(quoteContent, quoteAuthor, quoteSource, quoteBlock);
                });
        } else {
            selectAndSetQuote(quotes, today, cacheKey, quoteContent, quoteAuthor, quoteSource, quoteBlock);
        }
    }

function selectAndSetQuote(quotes, todayStr, cacheKey, contentEl, authorEl, sourceEl, quoteBlock) {
    const now = new Date(todayStr);
    const start = new Date(now.getFullYear(), 0, 0);
    let dayOfYear = Math.floor((now - start) / 86400000);
    dayOfYear -= 1;
    const index = dayOfYear % quotes.length;
    const selected = quotes[index];
    contentEl.textContent = selected.quote;
    authorEl.textContent = `— ${selected.author}`;
    sourceEl.textContent = selected.source;
    const data = { content: selected.quote, author: selected.author, source: selected.source };
    localStorage.setItem(cacheKey, JSON.stringify(data));
    quoteBlock.setAttribute('aria-busy', 'false');
}

function fallbackQuote(contentEl, authorEl, sourceEl, quoteBlock) {
    contentEl.textContent = "May the Force be with you.";
    authorEl.textContent = "— Obi-Wan Kenobi";
    sourceEl.textContent = "Star Wars: Episode IV – A New Hope";
    quoteBlock.setAttribute('aria-busy', 'false');
}

loadDailyQuote();
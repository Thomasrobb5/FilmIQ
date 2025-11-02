document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const toggleIcon = themeToggle.querySelector('.toggle-icon');
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        toggleIcon.textContent = '🌞';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        toggleIcon.textContent = '🌙';
    }

    themeToggle.addEventListener('click', () => {
        if (document.documentElement.getAttribute('data-theme') === 'light') {
            document.documentElement.setAttribute('data-theme', 'dark');
            toggleIcon.textContent = '🌞';
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            toggleIcon.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        }
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

    // Floating Icons
    const iconSources = [
        'bg_icons/icon1.png', 'bg_icons/icon2.png', 'bg_icons/icon3.png', 'bg_icons/icon4.png',
        'bg_icons/icon5.png', 'bg_icons/icon6.png', 'bg_icons/icon7.png', 'bg_icons/icon8.png'
    ];
    const numIcons = 20;
    const cols = 5;
    const rows = 4;
    const spacingX = 100 / (cols - 1);
    const spacingY = 100 / (rows - 1);
    const offsetVariance = 6;
    const icons = [];
    const body = document.body;

    for (let i = 0; i < numIcons; i++) {
        const icon = document.createElement('img');
        icon.className = 'floating-icon';
        icon.src = iconSources[Math.floor(Math.random() * iconSources.length)];
        icon.alt = `Background Icon ${i + 1}`;

        const col = i % cols;
        const row = Math.floor(i / cols);
        let x = col * spacingX;
        let y = row * spacingY;
        x += (Math.random() - 0.5) * offsetVariance;
        y += (Math.random() - 0.5) * offsetVariance;
        icon.style.left = `${Math.max(0, Math.min(100, x))}%`;
        icon.style.top = `${Math.max(0, Math.min(100, y))}%`;

        const rotation = Math.random() * 180 - 90;
        icon.dataset.baseTransform = `rotate(${rotation}deg)`;
        icon.style.transform = icon.dataset.baseTransform;
        icon.style.setProperty('--hover-rot', `rotate(${rotation + (Math.random() * 20 - 10)}deg)`);

        const sizeVar = 0.8 + Math.random() * 0.2;
        icon.style.width = `${32 * sizeVar}px`;
        icon.style.height = `${32 * sizeVar}px`;

        icon.style.opacity = '0';
        body.appendChild(icon);
        icons.push(icon);

        setTimeout(() => {
            icon.style.transition = 'all 0.6s ease';
            icon.style.opacity = '0.3';
            icon.style.transform = icon.dataset.baseTransform;
        }, i * 50);
    }

    // Simplified Parallax with throttling
    let lastScrollY = 0;
    let rafPending = false;
    function updateParallax() {
        rafPending = false;
        const scrollY = window.scrollY;
        const delta = scrollY - lastScrollY;
        if (Math.abs(delta) < 1) return; // Throttle small changes
        lastScrollY = scrollY;
        const offsetY = -scrollY * 0.1;
        icons.forEach(icon => {
            icon.style.transform = `${icon.dataset.baseTransform} translateY(${offsetY}px)`;
        });
    }

    function scrollHandler() {
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(updateParallax);
        }
    }

    if (icons.length > 0) {
        window.addEventListener('scroll', scrollHandler, { passive: true });
    }

    // Improved CSV Parser (basic handling for escaped quotes)
    function parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const result = [];
        for (let line of lines) {
            const fields = [];
            let current = '';
            let inQuote = false;
            let i = 0;
            while (i < line.length) {
                const char = line[i];
                if (char === '"') {
                    inQuote = !inQuote;
                    i++; // Skip next char if escaped
                    if (i < line.length && line[i] === '"') {
                        current += '"'; // Escaped quote
                        i++;
                    }
                } else if (char === ',' && !inQuote) {
                    fields.push(current.trim());
                    current = '';
                    i++;
                } else {
                    current += char;
                    i++;
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
        if (!quoteBlock) return;

        const quoteContent = document.getElementById('quote-content');
        const quoteAuthor = document.getElementById('quote-author');
        const quoteSource = document.getElementById('quote-source');

        if (!quoteContent || !quoteAuthor || !quoteSource) return;

        const today = new Date().toDateString();
        const cacheKey = `dailyQuote_v1_${today}`;

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

        const quotesCacheKey = 'movieQuotes_v1';
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
                        source: row[3] || ''
                    })).filter(q => q.quote && q.quote.trim());
                    localStorage.setItem(quotesCacheKey, JSON.stringify(quotes));
                    selectAndSetQuote(quotes, today, cacheKey, quoteContent, quoteAuthor, quoteSource, quoteBlock);
                })
                .catch((err) => {
                    console.warn('Quote fetch failed:', err);
                    fallbackQuote(quoteContent, quoteAuthor, quoteSource, quoteBlock);
                });
        } else {
            selectAndSetQuote(quotes, today, cacheKey, quoteContent, quoteAuthor, quoteSource, quoteBlock);
        }
    }

    const isHomePage = ['index.html', 'm_index.html'].includes(window.location.pathname.split('/').pop());
    if (document.getElementById('daily-quote') && isHomePage) {
        loadDailyQuote();
    }

    function selectAndSetQuote(quotes, todayStr, cacheKey, contentEl, authorEl, sourceEl, quoteBlock) {
        const now = new Date(todayStr);
        const start = new Date(now.getFullYear(), 0, 0);
        let dayOfYear = Math.floor((now - start) / 86400000);
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

    const API_URL = "https://auth-backend.thomasrobb5.workers.dev";

    // JWT Decode Helper (client-side, no verification)
function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.displayName || null;
  } catch (err) {
    console.warn('JWT decode failed:', err);
    return null;
  }
}

    // Header elements
    const signInBtn = document.getElementById('sign-in-btn');
    const signUpBtn = document.getElementById('sign-up-btn');
    const userMenu = document.getElementById('user-menu');
    const userNameSpan = document.getElementById('user-name');
    const userDropdown = document.getElementById('user-dropdown');
    const signOutBtn = document.getElementById('sign-out-btn');

    // Modal elements
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-modal-title');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authDisplayName = document.getElementById('auth-display-name');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authClose = document.getElementById('auth-close');

    let isSignupMode = false;

    // Helper to show user menu
    function showUserMenu(name) {
        if (signInBtn) signInBtn.classList.add('hidden');
        if (signUpBtn) signUpBtn.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        if (userNameSpan) userNameSpan.textContent = name;
    }

    function showAuthButtons() {
        if (signInBtn) signInBtn.classList.remove('hidden');
        if (signUpBtn) signUpBtn.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
    }

    // Check localStorage on load
    const storedToken = localStorage.getItem('authToken');
    const storedName = localStorage.getItem('userName');
    if (storedToken && storedName) {
        showUserMenu(storedName);
    } else {
        showAuthButtons();
    }

    // Toggle dropdown
    const userNameBtn = document.getElementById('user-name-btn');
    if (userNameBtn) {
        userNameBtn.addEventListener('click', () => {
            if (userDropdown) userDropdown.classList.toggle('hidden');
        });
    }

    // Sign out
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userName');
            showAuthButtons();
            if (userDropdown) userDropdown.classList.add('hidden');
        });
    }


// Open modal
if (signInBtn) {
  signInBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isSignupMode = false;
    if (authTitle) authTitle.textContent = "Sign In";
    if (authToggleText) authToggleText.innerHTML = `Don't have an account? <a href="#" id="auth-toggle-link">Sign Up</a>`;
    if (authDisplayName) authDisplayName.style.display = 'none'; // Hide on signin
    if (authModal) authModal.classList.remove('hidden');
  });
}

if (signUpBtn) {
  signUpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isSignupMode = true;
    if (authTitle) authTitle.textContent = "Sign Up";
    if (authToggleText) authToggleText.innerHTML = `Already have an account? <a href="#" id="auth-toggle-link">Sign In</a>`;
    if (authDisplayName) authDisplayName.style.display = 'block'; // Show on signup
    if (authModal) authModal.classList.remove('hidden');
  });
}
    // Close modal
    if (authClose) {
        authClose.addEventListener('click', () => {
            if (authModal) authModal.classList.add('hidden');
        });
    }

// Toggle between Sign In / Sign Up inside modal
if (authToggleText) {
  authToggleText.addEventListener('click', (e) => {
    if (e.target.id === "auth-toggle-link") {
      e.preventDefault();
      isSignupMode = !isSignupMode;
      if (authTitle) authTitle.textContent = isSignupMode ? "Sign Up" : "Sign In";
      if (authToggleText) {
        authToggleText.innerHTML = isSignupMode
          ? `Already have an account? <a href="#" id="auth-toggle-link">Sign In</a>`
          : `Don't have an account? <a href="#" id="auth-toggle-link">Sign Up</a>`;
      }
      if (authDisplayName) {
        authDisplayName.style.display = isSignupMode ? 'block' : 'none';
      }
    }
  });
}

// Submit auth form
if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = (authEmail ? authEmail.value.trim() : '');
    const displayNameInput = (authDisplayName ? authDisplayName.value.trim() : '');
    const password = (authPassword ? authPassword.value.trim() : '');
    if (!email || !password) return;

    // Prepare displayName for signup body (optional, fallback to email prefix if empty)
    const bodyDisplayName = isSignupMode && displayNameInput ? displayNameInput : undefined;

    const endpoint = isSignupMode ? "/signup" : "/signin";
    const body = isSignupMode 
      ? JSON.stringify({ email, password, displayName: bodyDisplayName })
      : JSON.stringify({ email, password });

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
      });

      const data = await res.json();

      if (data.token) {
        // Decode displayName from JWT (backend-provided)
        const decodedDisplayName = decodeJWT(data.token);
        let displayName = decodedDisplayName;
        
        // Fallback if missing (e.g., old user or decode fail)
        if (!displayName) {
          displayName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        }

        // Sanitize for display
        displayName = displayName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);

        // Store credentials locally
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userName', displayName);
        showUserMenu(displayName);
        if (authModal) authModal.classList.add('hidden');
        // Clear form
        if (authEmail) authEmail.value = '';
        if (authDisplayName) authDisplayName.value = '';
        if (authPassword) authPassword.value = '';
      } else {
        alert(data.error || "Authentication failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    }
  });
}

    // Close modal on outside click
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.add('hidden');
            }
        });
    }
});
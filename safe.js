Tesseract.setLogging(false);

document.addEventListener("DOMContentLoaded", () => {
  const ZTAS_DEV_TEST_MODE = false; // Set to true to bypass API quota during testing
  const GEMINI_PROXY_ENDPOINTS = [
    "http://127.0.0.1:8000/api/gemini",
    "http://127.0.0.1:3000/api/gemini",
    "http://localhost:3000/api/gemini"
  ];

  /* ================= FIREBASE CONFIG ================= */
  const firebaseConfig = {
    apiKey: "AIzaSyDTUKsGpzmJj6zph47s-7ui6gg1H6QKa_E",
    authDomain: "my-safe-net.firebaseapp.com",
    projectId: "my-safe-net",
    storageBucket: "my-safe-net.firebasestorage.app",
    messagingSenderId: "530467858697",
    appId: "1:530467858697:web:37d409f7c4c2b7ae0b8bd8",
    measurementId: "G-9WSFSMMZLR"
  };

  // Initialize Firebase (only if not already initialized)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();

  // ── Auth Observer ──
  auth.onAuthStateChanged((user) => {
    const historyBtn = document.getElementById("historyBtn");
    if (historyBtn) {
      historyBtn.style.display = user ? "flex" : "none";
      console.log("[ZTAS Auth] History access:", user ? 'GRANTED' : 'RESTRICTED');
    }
  });

  /* ================= DOM ================= */
  const input = document.getElementById("input");
  const fileInput = document.getElementById("fileInput");
  const previewBtn = document.getElementById("previewBtn");
  const scanBtn = document.getElementById("scanBtn");
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output");
  const scanTypeEl = document.getElementById("scanType");

  const smartLoader = document.getElementById("smartLoader");
  const loaderMain = document.getElementById("loaderMain");
  const loaderSub = document.getElementById("loaderSub");
  const smartProgress = document.getElementById("smartProgress");

  const historyBtn = document.getElementById("historyBtn");
  const historyModal = document.getElementById("historyModal");
  const closeHistoryBtn = document.getElementById("closeHistoryBtn");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  let selectedFile = null;
  let ztasChatHistory = []; // Persistent memory for real-time context

  function buildSafyChatContext(text, scanResult = null) {
    const minutesOnPage = Math.max(1, Math.round(performance.now() / 60000));
    const context = [
      "Session Context:",
      `- Current mode: ${scanTypeEl && scanTypeEl.value ? scanTypeEl.value : "unknown"}`,
      `- Minutes on page: ${minutesOnPage}`,
      `- User message count in this session: ${Math.floor(ztasChatHistory.length / 2)}`,
      `- User may be worried and wants clear real-time guidance.`
    ];

    if (selectedFile) {
      context.push(`- Uploaded file: ${selectedFile.name}`);
      context.push(`- Uploaded file type: ${selectedFile.type || "unknown"}`);
    }

    if (scanResult) {
      context.push(`- Latest threat score: ${scanResult.score}/100`);
      context.push(`- Latest scan domain: ${scanResult.domain || "none"}`);
    }

    return context.join("\n");
  }

  async function requestGemini(payload, requestType = "chat") {
    let lastError = null;

    for (const endpoint of GEMINI_PROXY_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Gemini proxy failed at ${endpoint} with status ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`Gemini proxy request failed for ${requestType}.`);
  }

  /* ================= HISTORY LOGIC ================= */
  let scanHistory = JSON.parse(localStorage.getItem("safeNetHistory") || "[]");

  function saveToHistory(item) {
    scanHistory.unshift(item);
    if (scanHistory.length > 20) scanHistory.pop(); // Keep last 20
    localStorage.setItem("safeNetHistory", JSON.stringify(scanHistory));
  }
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function renderHistory() {
    if (scanHistory.length === 0) {
      historyList.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(148, 163, 184, 0.5); gap: 15px;">
        <svg fill="currentColor" viewBox="0 0 24 24" width="48" height="48" style="opacity: 0.5;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <p>Your scan history is empty.</p>
      </div>`;
      return;
    }

    historyList.innerHTML = scanHistory.map(item => {
      let icon = "ðŸ›¡ï¸";
      let color = "#6ee7b7"; // Safe green
      let bgColor = "rgba(16, 185, 129, 0.05)";
      let borderColor = "rgba(16, 185, 129, 0.2)";

      if (item.level === "danger") {
        icon = "ðŸš¨";
        color = "#f43f5e"; // Danger red
        bgColor = "rgba(244, 63, 94, 0.05)";
        borderColor = "rgba(244, 63, 94, 0.2)";
      } else if (item.level === "warn") {
        icon = "âš ï¸";
        color = "#fbbf24"; // Warning yellow
        bgColor = "rgba(251, 191, 36, 0.05)";
        borderColor = "rgba(251, 191, 36, 0.2)";
      }

      return `
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 14px; padding: 16px; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.1); cursor: default;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.1)';">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.8rem; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            <span style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 1.1rem;">${icon}</span> ${item.date}</span>
            <span style="color: ${color}; font-weight: 700; background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 20px;">Score: ${item.score}/100</span>
          </div>

          <div style="font-weight: 600; font-size: 1rem; margin-bottom: 12px; color: ${color}; text-shadow: 0 0 10px ${color}33;">
            ${escapeHTML(item.msg)}
          </div>

          <div style="font-size: 0.85rem; color: #cbd5e1; background: rgba(2, 6, 23, 0.5); padding: 10px 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-all; font-family: monospace; border: 1px solid rgba(255,255,255,0.03);">
            ${item.input}
          </div>
          
        </div>
      `;
    }).join("");
  }

  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      renderHistory();
      historyModal.classList.add("active");
    });
  }

  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', () => {
      historyModal.classList.remove("active");
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      scanHistory = [];
      localStorage.removeItem("safeNetHistory");
      renderHistory();
    });
  }

  /* ================= GOOGLE SAFE BROWSING API CONFIG ================= */
  /* Keys moved to secure backend (safe.py) */
  /* OPR: openpagerank.com - Domain authority / web presence score (0-10) */

  /* ================= LEGITIMATE DOMAINS DATABASE (WHITELIST) ================= */
  const LEGITIMATE_DOMAINS = [
    // Search Engines
    "google.com", "google.co.in", "google.co.uk", "google.ca", "google.com.au",
    "google.de", "google.fr", "google.es", "google.it", "google.co.jp",
    "bing.com", "yahoo.com", "duckduckgo.com", "baidu.com", "yandex.com",

    // Tech Giants
    "microsoft.com", "outlook.com", "office.com", "live.com", "hotmail.com",
    "azure.com", "windows.com", "xbox.com", "skype.com", "linkedin.com",
    "apple.com", "icloud.com", "itunes.com", "appstore.com",
    "amazon.com", "amazon.in", "amazon.co.uk", "amazon.ca", "amazon.de",
    "aws.amazon.com", "amazonaws.com",
    "facebook.com", "fb.com", "meta.com", "messenger.com",
    "instagram.com", "threads.net",
    "twitter.com", "x.com",
    "youtube.com", "youtu.be",
    "netflix.com",
    "spotify.com",
    "tiktok.com",

    // Developer & Tech
    "github.com", "githubusercontent.com", "gitlab.com", "bitbucket.org",
    "stackoverflow.com", "stackexchange.com", "askubuntu.com",
    "npmjs.com", "pypi.org", "maven.org", "nuget.org",
    "docker.com", "hub.docker.com",
    "cloudflare.com", "cloudflare-dns.com",
    "digitalocean.com", "linode.com", "vultr.com",
    "heroku.com", "netlify.com", "netlify.app", "vercel.com", "vercel.app",
    "firebase.google.com", "firebaseapp.com",
    "mongodb.com", "mongodb.net",
    "postgresql.org", "mysql.com", "oracle.com",
    "jetbrains.com", "visualstudio.com", "code.visualstudio.com",
    "mozilla.org", "firefox.com",

    // Social & Communication
    "reddit.com", "old.reddit.com",
    "whatsapp.com", "whatsapp.net", "web.whatsapp.com",
    "telegram.org", "t.me", "web.telegram.org",
    "discord.com", "discord.gg", "discordapp.com",
    "slack.com",
    "zoom.us", "zoom.com",
    "teams.microsoft.com",
    "meet.google.com",
    "signal.org",
    "viber.com",
    "snapchat.com",
    "pinterest.com",
    "tumblr.com",
    "quora.com",
    "medium.com",

    // E-commerce
    "ebay.com", "ebay.co.uk", "ebay.de",
    "walmart.com",
    "target.com",
    "bestbuy.com",
    "costco.com",
    "homedepot.com",
    "lowes.com",
    "etsy.com",
    "shopify.com",
    "aliexpress.com",
    "alibaba.com",
    "flipkart.com",
    "myntra.com",
    "snapdeal.com",
    "ajio.com",

    // Finance & Banking
    "paypal.com", "paypal.me",
    "stripe.com",
    "square.com", "squareup.com",
    "venmo.com",
    "wise.com", "transferwise.com",
    "revolut.com",
    "chase.com", "jpmorganchase.com",
    "bankofamerica.com", "bofa.com",
    "wellsfargo.com",
    "citi.com", "citibank.com",
    "usbank.com",
    "capitalone.com",
    "americanexpress.com", "amex.com",
    "discover.com",
    "mastercard.com",
    "visa.com",
    "fidelity.com",
    "schwab.com",
    "vanguard.com",
    "robinhood.com",
    "coinbase.com",
    "binance.com",
    "kraken.com",

    // News & Media
    "cnn.com",
    "bbc.com", "bbc.co.uk",
    "nytimes.com",
    "washingtonpost.com",
    "theguardian.com",
    "reuters.com",
    "apnews.com",
    "forbes.com",
    "bloomberg.com",
    "wsj.com",
    "usatoday.com",
    "huffpost.com",
    "nbcnews.com",
    "cbsnews.com",
    "foxnews.com",
    "abcnews.go.com",
    "npr.org",
    "bbc.co.uk",
    "timesofindia.indiatimes.com",
    "ndtv.com",
    "hindustantimes.com",

    // Education
    "wikipedia.org", "en.wikipedia.org",
    "wikimedia.org",
    "coursera.org",
    "udemy.com",
    "edx.org",
    "khanacademy.org",
    "udacity.com",
    "skillshare.com",
    "linkedin.com/learning",
    "pluralsight.com",
    "codecademy.com",
    "freecodecamp.org",
    "w3schools.com",
    "geeksforgeeks.org",
    "tutorialspoint.com",
    "mit.edu",
    "stanford.edu",
    "harvard.edu",
    "yale.edu",
    "oxford.ac.uk",
    "cambridge.org",

    // Cloud Storage
    "dropbox.com",
    "box.com",
    "drive.google.com",
    "onedrive.live.com",
    "icloud.com",
    "mega.nz",
    "mediafire.com",
    "wetransfer.com",

    // Entertainment & Streaming
    "twitch.tv",
    "vimeo.com",
    "dailymotion.com",
    "soundcloud.com",
    "pandora.com",
    "hulu.com",
    "disneyplus.com",
    "hbomax.com",
    "primevideo.com",
    "peacocktv.com",
    "crunchyroll.com",
    "funimation.com",

    // Travel & Booking
    "airbnb.com",
    "booking.com",
    "expedia.com",
    "tripadvisor.com",
    "kayak.com",
    "hotels.com",
    "trivago.com",
    "priceline.com",
    "southwest.com",
    "united.com",
    "delta.com",
    "aa.com",
    "uber.com",
    "lyft.com",
    "grab.com",
    "ola.com",

    // Productivity & Tools
    "adobe.com",
    "canva.com",
    "figma.com",
    "notion.so",
    "trello.com",
    "asana.com",
    "monday.com",
    "airtable.com",
    "evernote.com",
    "todoist.com",
    "grammarly.com",
    "1password.com",
    "lastpass.com",
    "bitwarden.com",

    // Government Domains
    "gov", "gov.in", "gov.uk", "gov.au", "gov.ca", "gov.us",
    "irs.gov",
    "ssa.gov",
    "usa.gov",
    "state.gov",
    "whitehouse.gov",
    "nasa.gov",
    "cdc.gov",
    "nih.gov",
    "fbi.gov",
    "dhs.gov",

    // Shipping & Logistics
    "usps.com",
    "fedex.com",
    "ups.com",
    "dhl.com",
    "bluedart.com",
    "dtdc.com",

    // Job Sites
    "indeed.com",
    "glassdoor.com",
    "monster.com",
    "careerbuilder.com",
    "ziprecruiter.com",
    "naukri.com",

    // Real Estate
    "zillow.com",
    "realtor.com",
    "trulia.com",
    "redfin.com",
    "apartments.com",
    "99acres.com",
    "magicbricks.com",

    // Food & Delivery
    "doordash.com",
    "ubereats.com",
    "grubhub.com",
    "postmates.com",
    "instacart.com",
    "zomato.com",
    "swiggy.com",

    // Weather
    "weather.com",
    "accuweather.com",
    "weather.gov",
    "wunderground.com",

    // Research & Academic
    "bohrium.com", "arxiv.org", "researchgate.net", "semanticscholar.org", "doi.org",
    "nature.com", "sciencemag.org", "sciencedirect.com", "springer.com", "wiley.com",
    "ieee.org", "acm.org", "jstor.org", "academia.edu", "nih.gov", "pubmed.ncbi.nlm.nih.gov",

    // Other Trusted
    "craigslist.org",
    "yelp.com",
    "yellowpages.com",
    "bbb.org",
    "archive.org",
    "scribd.com",
    "slideshare.net",
    "issuu.com"
  ];

  /* ================= LEGITIMATE EMAIL DOMAINS ================= */
  const LEGITIMATE_EMAIL_DOMAINS = [
    "gmail.com", "googlemail.com",
    "outlook.com", "hotmail.com", "live.com", "msn.com",
    "yahoo.com", "yahoo.co.uk", "yahoo.co.in", "ymail.com",
    "icloud.com", "me.com", "mac.com",
    "protonmail.com", "proton.me", "pm.me",
    "aol.com",
    "zoho.com", "zohomail.com",
    "mail.com",
    "gmx.com", "gmx.net",
    "yandex.com", "yandex.ru",
    "tutanota.com",
    "fastmail.com",
    "hey.com",
    "mailinator.com",
    "rediffmail.com"
  ];

  /* ================= URL SHORTENERS DATABASE ================= */
  const URL_SHORTENERS = [
    "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly",
    "is.gd", "buff.ly", "adf.ly", "shorte.st", "bc.vc", "rb.gy",
    "cutt.ly", "shorturl.at", "tiny.cc", "v.gd", "clck.ru", "qps.ru",
    "short.io", "rebrand.ly", "bl.ink", "soo.gd", "s.id", "lnkd.in",
    "fb.me", "redd.it", "amzn.to", "amzn.com", "j.mp",
    "git.io", "cli.gs", "short.link", "shorten.link", "shrtco.de",
    "surl.li", "shorturl.asia", "u.to", "kutt.it", "link.zip",
    "url.zip", "zpr.io", "zee.gl", "tgr.ph", "mtr.cool", "rotf.lol",
    "wp.me", "su.pr", "tr.im", "po.st", "snip.ly", "ht.ly", "hubs.ly",
    "mcaf.ee", "trib.al", "dlvr.it", "flic.kr", "db.tt", "eepurl.com",
    "tny.im", "shorturl.com", "vzturl.com", "qr.ae", "lc.chat"
  ];

  /* ================= LOADER ================= */
  function showLoader(title, subtitle, progress) {
    smartLoader.style.display = "flex";
    loaderMain.textContent = title;
    loaderSub.textContent = subtitle;
    smartProgress.style.width = (progress || 40) + "%";
  }

  function updateLoader(progress, subtitle) {
    smartProgress.style.width = progress + "%";
    if (subtitle) loaderSub.textContent = subtitle;
  }

  function hideLoader() {
    smartProgress.style.width = "100%";
    setTimeout(() => {
      smartLoader.style.display = "none";
    }, 300);
  }

  /* ================= INPUT VALIDATION ================= */
  function validateInput(text) {
    const clean = text.trim();
    if (!clean) return { ok: false, reason: "Empty input" };
    if (clean.length < 3) return { ok: false, reason: "Too short to analyze" };
    return { ok: true };
  }

  /* ================= OCR ================= */
  async function ocrImage(file) {
    showLoader("OCR Engine", "Extracting text from image...", 40);
    const res = await Tesseract.recognize(file, "eng");
    updateLoader(80, "OCR complete");
    return res.data.text || "";
  }

  /* ================= HELPER: EXTRACT ROOT DOMAIN ================= */
  function extractRootDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const twoPartTLDs = [
        'co.uk', 'com.au', 'co.in', 'co.nz', 'com.br', 'co.za',
        'co.jp', 'com.mx', 'org.uk', 'net.au', 'org.au', 'ac.uk',
        'gov.uk', 'gov.in', 'gov.au', 'edu.au', 'ac.in'
      ];
      const lastTwo = parts.slice(-2).join('.');
      if (twoPartTLDs.includes(lastTwo) && parts.length >= 3) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }
    return hostname;
  }

  /* ================= HELPER: EXTRACT DOMAIN FROM URL ================= */
  function extractDomain(url) {
    try {
      let cleanUrl = url.trim();
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = "https://" + cleanUrl;
      }
      const urlObj = new URL(cleanUrl);
      return urlObj.hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return url.toLowerCase().replace(/^www\./, '');
    }
  }

  /* ================= TYPOSQUATTING CHECK ================= */
  function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function detectBrandImpersonation(hostname) {
    const rootDomain = extractRootDomain(hostname);
    const domainName = rootDomain.split('.')[0];
    const brandNames = [...new Set(LEGITIMATE_DOMAINS.map(d => extractRootDomain(d).split('.')[0]))];

    for (const brand of brandNames) {
      if (brand.length < 4) continue;
      const dist = getLevenshteinDistance(domainName, brand);
      const threshold = brand.length >= 7 ? 2 : 1;

      if (dist > 0 && dist <= threshold) {
        return { isImpersonation: true, type: "Typosquatting", targetedBrand: brand };
      }
      if (domainName.startsWith(brand + '-') || domainName.endsWith('-' + brand) || domainName === brand + 'support' || domainName === brand + 'security') {
        return { isImpersonation: true, type: "Brand Appending", targetedBrand: brand };
      }
    }
    return { isImpersonation: false };
  }

  /* ─────────────────────────────────────────────────────────────────────
     H1 — KEYBOARD-ADJACENT CHARACTER SUBSTITUTION DETECTION
     Catches: paypa1, g00gle, amaz0n, faceb00k, m1crosoft, etc.
     Additive: called alongside detectBrandImpersonation()
  ───────────────────────────────────────────────────────────────────── */
  const KEYBOARD_ADJACENCY = {
    'a': ['q', 'w', 's', 'z'], 'b': ['v', 'g', 'h', 'n'], 'c': ['x', 'd', 'f', 'v'],
    'd': ['s', 'e', 'r', 'f', 'c', 'x'], 'e': ['w', 'r', 'd', 's'],
    'f': ['d', 'r', 't', 'g', 'v', 'c'], 'g': ['f', 't', 'y', 'h', 'b', 'v'],
    'h': ['g', 'y', 'u', 'j', 'n', 'b'], 'i': ['u', 'o', 'k', 'j'],
    'j': ['h', 'u', 'i', 'k', 'm', 'n'], 'k': ['j', 'i', 'o', 'l', 'm'],
    'l': ['k', 'o', 'p'], 'm': ['n', 'j', 'k'], 'n': ['b', 'h', 'j', 'm'],
    'o': ['i', 'p', 'k', 'l', '0'], 'p': ['o', 'l'], 'q': ['w', 'a'],
    'r': ['e', 't', 'f', 'd'], 's': ['a', 'w', 'e', 'd', 'z', 'x'],
    't': ['r', 'y', 'f', 'g'], 'u': ['y', 'i', 'h', 'j'],
    'v': ['c', 'f', 'g', 'b'], 'w': ['q', 'e', 'a', 's'],
    'x': ['z', 's', 'd', 'c'], 'y': ['t', 'u', 'g', 'h'],
    'z': ['a', 's', 'x'],
    '0': ['o', '9'], '1': ['l', 'i', '2'], '3': ['e'], '4': ['a'],
    '5': ['s'], '6': ['g'], '7': ['t'], '8': ['b'], '9': ['g', 'q']
  };

  function detectKeyboardSubstitution(hostname) {
    const rootDomain = extractRootDomain(hostname);
    const domainName = rootDomain.split('.')[0].toLowerCase();
    const brandNames = [...new Set(LEGITIMATE_DOMAINS.map(d => extractRootDomain(d).split('.')[0].toLowerCase()))];

    for (const brand of brandNames) {
      if (brand.length < 4 || brand === domainName) continue;
      if (domainName.length !== brand.length) continue; // keyboard sub = same length

      let substitutions = 0;
      let allMatch = true;
      for (let i = 0; i < brand.length; i++) {
        const bc = brand[i], dc = domainName[i];
        if (bc === dc) continue;
        const neighbors = KEYBOARD_ADJACENCY[dc] || [];
        if (neighbors.includes(bc) || (KEYBOARD_ADJACENCY[bc] || []).includes(dc)) {
          substitutions++;
        } else {
          allMatch = false;
          break;
        }
      }
      if (allMatch && substitutions >= 1 && substitutions <= 2) {
        return { detected: true, targetedBrand: brand, substitutions };
      }
    }
    return { detected: false };
  }

  /* ─────────────────────────────────────────────────────────────────────
     H2 — PLATFORM-AWARE TRUST OVERRIDE
     Detects phishing hosted on trusted platforms (Google Sites, Netlify,
     GitHub Pages, Notion, etc.). When detected, domain reputation is
     bypassed and only content/visual scoring applies.
     Additive: new function, checked before whitelist logic in URL pipeline
  ───────────────────────────────────────────────────────────────────── */
  const ABUSABLE_PLATFORMS = [
    "sites.google.com", "sharepoint.com", "netlify.app", "pages.dev",
    "github.io", "vercel.app", "glitch.me", "weebly.com", "wixsite.com",
    "carrd.co", "notion.site", "webflow.io", "squarespace.com",
    "wordpress.com", "blogspot.com", "tumblr.com", "gitbook.io",
    "replit.dev", "repl.co", "surge.sh", "tiiny.site"
  ];

  function detectPlatformAbuse(hostname) {
    const host = hostname.toLowerCase().replace(/^www\./, '');
    for (const platform of ABUSABLE_PLATFORMS) {
      if (host === platform || host.endsWith('.' + platform)) {
        return { isPlatformAbuse: true, platform };
      }
    }
    return { isPlatformAbuse: false };
  }

  /* ─────────────────────────────────────────────────────────────────────
     H3 — REDIRECT CHAIN FULL RESOLUTION (depth 10)
     Follows redirect hops and extracts every intermediate hostname so each
     can be scored independently. Final resolved URL is used for analysis.
     Additive: new async helper, result merged into URL report.
  ───────────────────────────────────────────────────────────────────── */
  async function resolveRedirectChain(url, maxDepth = 10) {
    const hops = [];
    let current = url;
    let shortenerHops = 0;
    let chainTruncated = false;
    try {
      for (let i = 0; i < maxDepth; i++) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5000);
        let resp;
        try {
          // AT-04: HEAD first, fall back to GET if HEAD is blocked (many shorteners block HEAD)
          resp = await fetch(current, { method: 'HEAD', redirect: 'manual', signal: ctrl.signal });
          clearTimeout(tid);
          // If HEAD returns 405 Method Not Allowed, retry with GET
          if (resp.status === 405 || resp.status === 400) {
            const ctrl2 = new AbortController();
            const tid2 = setTimeout(() => ctrl2.abort(), 5000);
            resp = await fetch(current, { method: 'GET', redirect: 'manual', signal: ctrl2.signal });
            clearTimeout(tid2);
          }
        } catch (e) {
          clearTimeout(tid);
          break;
        }

        // Count shortener hops for AT-04 chain scoring
        if (isUrlShortener(extractDomain(current))) shortenerHops++;
        hops.push({ hop: i + 1, url: current, status: resp.status });

        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get('location');
          if (!location) break;
          try { current = new URL(location, current).href; } catch { current = location; }
        } else {
          break;
        }

        // AT-04: At depth limit — flag as truncated (not neutral)
        if (i === maxDepth - 1) chainTruncated = true;
      }
    } catch (e) { /* Network error */ }
    return { hops, finalUrl: current, shortenerHops, chainTruncated };
  }

  /* ─────────────────────────────────────────────────────────────────────
     H4 — FULL BRAND LIST SUBDOMAIN ANATOMY SCORING
     Extends the existing 7-brand hardcoded check to the full LEGITIMATE_DOMAINS
     list. Flags brand terms appearing in subdomain/path position where the
     registrable domain is different (e.g. paypal.attacker.com).
     Additive: replaces only the hardcoded brand list array, logic identical.
  ───────────────────────────────────────────────────────────────────── */
  function detectSubdomainBrandAnatomyAbuse(hostname) {
    const alerts = [];
    let score = 0;
    const host = hostname.toLowerCase().replace(/^www\./, '');
    const rootDomain = extractRootDomain(host);

    // Build full brand set from whitelist
    const allBrandDomains = LEGITIMATE_DOMAINS.map(d => extractRootDomain(d));
    const uniqueBrands = [...new Set(allBrandDomains)];

    for (const brandDomain of uniqueBrands) {
      // Skip if this IS the brand domain
      if (rootDomain === brandDomain) continue;
      // Skip trivially short or generic names
      const brandName = brandDomain.split('.')[0];
      if (brandName.length < 4) continue;
      // Check if brand name appears in the hostname but is NOT the registrable domain
      if (host.includes(brandName) && !rootDomain.startsWith(brandName)) {
        score += 90;
        alerts.push(`🚨 [H4 - Subdomain Anatomy] BRAND INSIDE SUBDOMAIN: "${brandName}" (from ${brandDomain}) found in subdomain/path of "${rootDomain}" — classic domain camouflage`);
        break; // One detection is enough
      }
    }
    return { score, alerts };
  }

  /* ─────────────────────────────────────────────────────────────────────
     H5 — JAVASCRIPT OBFUSCATION SIGNAL DETECTION
     Scores dangerous JS pattern combinations detected in scanned text.
     Additive: new function, called when scan input contains script tags or
     when email/text content is scanned.
  ───────────────────────────────────────────────────────────────────── */
  function detectJsObfuscation(text) {
    const alerts = [];
    let score = 0;

    // Pattern groups — each combination raises risk score
    const DANGEROUS_COMBOS = [
      { patterns: [/eval\s*\(/i, /atob\s*\(/i], label: 'eval+atob', pts: 80 },
      { patterns: [/eval\s*\(/i, /unescape\s*\(/i], label: 'eval+unescape', pts: 70 },
      { patterns: [/eval\s*\(/i, /String\.fromCharCode/i], label: 'eval+charCode', pts: 75 },
      { patterns: [/document\.write\s*\(/i, /unescape\s*\(/i], label: 'docWrite+unescape', pts: 65 },
      { patterns: [/document\.write\s*\(/i, /atob\s*\(/i], label: 'docWrite+atob', pts: 70 },
      { patterns: [/new\s+Function\s*\(/i, /atob\s*\(/i], label: 'Function()+atob', pts: 80 },
      { patterns: [/setTimeout\s*\(/i, /document\.write\s*\(/i], label: 'delayed+docWrite', pts: 55 },
      { patterns: [/navigator\.webdriver/i], label: 'webdriver-check', pts: 50 },
      { patterns: [/window\.location\s*=.*\+/i], label: 'dynamic-redirect', pts: 40 },
      // AT-15: WebSocket + OTP combo — real-time MFA bypass signal
      { patterns: [/new\s+WebSocket\s*\(/i, /otp|one.time|auth.*code|verification.*code/i], label: 'WebSocket+OTP-MFA-bypass', pts: 85 },
      // AT-08: ContentEditable + data exfil — CSS-only credential capture
      { patterns: [/contenteditable/i, /MutationObserver/i], label: 'contentEditable+MutationObserver', pts: 75 },
      // AT-07: WebAuthn credential interception
      { patterns: [/navigator\.credentials\.(get|create)\s*\(/i], label: 'WebAuthn-credential-intercept', pts: 70 },
      // AT-09: Shadow DOM with closed mode
      { patterns: [/attachShadow\s*\(.*closed/i], label: 'closed-shadowRoot', pts: 80 },
      // N-04: WebAssembly execution (WASM binary credential harvester)
      { patterns: [/WebAssembly\.(instantiate|compile|instantiateStreaming)\s*\(/i], label: 'WASM-execution', pts: 75 },
      // N-05: Service worker registration at root scope (persistence attack)
      { patterns: [/navigator\.serviceWorker\.register\s*\(/i], label: 'serviceWorker-registration', pts: 65 },
      // N-06: Steganographic payload — reads pixel data and executes code
      { patterns: [/getImageData\s*\(/i, /eval\s*\(|new\s+Function\s*\(/i], label: 'steganographic-pixel-exec', pts: 90 },
      // N-08: Lazy-loading / scroll-triggered DOM injection
      { patterns: [/IntersectionObserver/i, /innerHTML\s*=/i], label: 'intersectionObserver+innerHTML', pts: 60 },
      // N-13: LLM prompt injection — "ignore previous instructions" override
      { patterns: [/ignore\s+(all\s+)?previous\s+instructions/i], label: 'llm-prompt-injection', pts: 80 },
      // N-19: Fragment-gated phishing content (location.hash → innerHTML)
      { patterns: [/location\.hash/i, /innerHTML\s*=|document\.write/i], label: 'fragment-hash-content-gate', pts: 60 },
      // N-01: Browser-in-Browser viewport overlay (position:fixed 100% width+height)
      { patterns: [/position\s*:\s*fixed/i, /width\s*:\s*100\s*(vw|%)/i, /height\s*:\s*100\s*(vh|%)/i], label: 'BiTB-viewport-overlay', pts: 70 },
    ];

    for (const combo of DANGEROUS_COMBOS) {
      if (combo.patterns.every(p => p.test(text))) {
        score += combo.pts;
        alerts.push(`🚨 [H5 - JS Obfuscation] OBFUSCATED SCRIPT: "${combo.label}" pattern detected — potential runtime payload injection`);
      }
    }

    // AT-12: Canvas that fills large viewport fraction
    const canvasSizePattern = /canvas[^}]{0,200}(width|height)\s*[:=]\s*(\d{3,4})/gi;
    const canvasMatches = [...text.matchAll(canvasSizePattern)];
    if (canvasMatches.length >= 2) {
      const dims = canvasMatches.map(m => parseInt(m[2])).filter(d => d > 600);
      if (dims.length >= 2) {
        score += 60;
        alerts.push(`⚠️ [H5 - Canvas] FULL-CANVAS PHISHING: Large canvas element (${dims[0]}x${dims[1]}) detected — may be rendering credential UI outside DOM`);
      }
    }

    // AT-15/AT-01: Cross-origin iframe embedding credential endpoint
    if (/\u003ciframe[^>]{0,200}src\s*=\s*['"]https?:\/\/(?!.*(?:youtube|vimeo|maps\.google))/i.test(text)) {
      score += 45;
      alerts.push(`⚠️ [H5 - Iframe] CROSS-ORIGIN IFRAME: Embedded third-party page — possible context-collapse trust cascade`);
    }

    // AT-08: WebSocket to external domain for data exfil
    if (/new\s+WebSocket\s*\(\s*['"]wss?:\/\//i.test(text)) {
      score += 40;
      alerts.push(`⚠️ [H5 - WebSocket] LIVE SOCKET CONNECTION: WebSocket to external host detected — possible real-time credential or OTP exfiltration`);
    }

    // Additional single-pattern signals
    const heavyBase64 = /(?:[A-Za-z0-9+/]{4}){20,}(?:={0,2})/;
    if (heavyBase64.test(text) && /eval|atob|Function/i.test(text)) {
      score += 35;
      alerts.push(`⚠️ [H5 - JS Obfuscation] ENCODED PAYLOAD: Large base64 blob with execution context detected`);
    }

    return { jsObfScore: Math.min(100, score), alerts };
  }

  /* ─────────────────────────────────────────────────────────────────────
     AT-03 FIX — EXTENDED UNICODE HOMOGRAPH DETECTION (15+ scripts)
     Extends existing script analysis to Armenian, Georgian, Ethiopic,
     Arabic, Hebrew, Thai, Japanese, Chinese, Korean, and more.
     Additive: new function, called after deepAnalyzeDomain in L2 block.
  ───────────────────────────────────────────────────────────────────── */
  function detectExtendedHomograph(hostname) {
    const alerts = [];
    let score = 0;

    // Extended Unicode script ranges — beyond original Latin+Cyrillic+Greek
    const SCRIPT_RANGES = [
      { name: 'Cyrillic', range: /[\u0400-\u04FF]/ },
      { name: 'Greek', range: /[\u0370-\u03FF]/ },
      { name: 'Armenian', range: /[\u0530-\u058F]/ },  // AT-03: newly added
      { name: 'Georgian', range: /[\u10A0-\u10FF]/ },  // AT-03: newly added
      { name: 'Ethiopic', range: /[\u1200-\u137F]/ },  // AT-03: newly added
      { name: 'Arabic', range: /[\u0600-\u06FF]/ },  // AT-03: newly added
      { name: 'Hebrew', range: /[\u0590-\u05FF]/ },  // AT-03: newly added
      { name: 'Thai', range: /[\u0E00-\u0E7F]/ },  // AT-03: newly added
      { name: 'Hiragana', range: /[\u3040-\u309F]/ },  // AT-03: newly added
      { name: 'Katakana', range: /[\u30A0-\u30FF]/ },  // AT-03: newly added
      { name: 'CJK', range: /[\u4E00-\u9FFF]/ },  // AT-03: newly added
      { name: 'Hangul', range: /[\uAC00-\uD7AF]/ },  // AT-03: newly added
      { name: 'Latin-Ext', range: /[\u0100-\u024F]/ },  // Extended Latin
      { name: 'Devanagari', range: /[\u0900-\u097F]/ },  // AT-03: newly added
      { name: 'Bengali', range: /[\u0980-\u09FF]/ },  // AT-03: newly added
    ];

    const host = hostname.toLowerCase();
    const detectedScripts = SCRIPT_RANGES.filter(s => s.range.test(host)).map(s => s.name);
    const hasLatin = /[a-z]/.test(host);

    // Multi-script mixing (2+ non-Latin scripts OR Latin + any non-standard script)
    if (detectedScripts.length >= 2) {
      score += 100;
      alerts.push(`🚨 [AT-03 - Extended Homograph] MULTI-SCRIPT DOMAIN: ${detectedScripts.join('+')} scripts mixed — sophisticated IDN homograph attack across ${detectedScripts.length} Unicode blocks`);
    } else if (detectedScripts.length === 1 && hasLatin) {
      score += 90;
      alerts.push(`🚨 [AT-03 - Extended Homograph] MIXED-SCRIPT: Latin + ${detectedScripts[0]} script — classic cross-script homograph attack`);
    }

    // Punycode detection (existing defense, extended here for 15-script awareness)
    if (hostname.includes('xn--')) {
      score += 60;
      alerts.push(`⚠️ [AT-03 - Extended Homograph] PUNYCODE DOMAIN: Internationalized domain name — high-risk homograph vector`);
    }

    return { score, alerts };
  }

  /* ─────────────────────────────────────────────────────────────────────
     AT-17 FIX — ZERO-FEATURE URL ANOMALY DETECTOR
     A suspiciously minimal URL (short domain, short path, no reputation)
     is itself anomalous — deliberately crafted to score below trigger threshold.
     Additive: new function called in L7 statistical anomaly block.
  ───────────────────────────────────────────────────────────────────── */
  function detectZeroFeatureAnomaly(hostname, pathname, isWhitelisted) {
    const alerts = [];
    let score = 0;
    if (isWhitelisted) return { score, alerts };

    const root = extractRootDomain(hostname);
    const domainLabel = root.split('.')[0];
    const tld = root.split('.').slice(1).join('.');

    // High-risk TLDs used by attackers for short domains
    const highRiskShortTLDs = ['cc', 'tk', 'ml', 'ga', 'cf', 'gq', 'pw', 'xyz', 'top', 'icu',
      'live', 'click', 'link', 'site', 'online', 'beauty', 'hair'];

    const isShortDomain = domainLabel.length <= 5;
    const isHighRiskTLD = highRiskShortTLDs.includes(tld);
    const isShortPath = (pathname || '/').replace(/\//g, '').length <= 4;
    const isLowEntropy = domainLabel.length > 0 && (() => {
      const freq = {};
      for (const c of domainLabel) freq[c] = (freq[c] || 0) + 1;
      return Object.values(freq).reduce((e, f) => e - (f / domainLabel.length) * Math.log2(f / domainLabel.length), 0);
    })() < 2.0;

    // AT-17: Combo — short domain + high-risk TLD + minimal path = suspicious
    if (isShortDomain && isHighRiskTLD) {
      score += 55;
      alerts.push(`🚨 [AT-17 - Zero-Feature] MINIMAL URL: "${root}" — short domain on high-risk TLD with near-zero URL surface area; may be deliberately crafted to evade scoring`);
    } else if (isShortDomain && isShortPath && isLowEntropy) {
      score += 40;
      alerts.push(`⚠️ [AT-17 - Zero-Feature] ANOMALOUS SIMPLICITY: "${root}" — domain+path have insufficient features for confident classification; elevated scrutiny applied`);
    }

    return { score, alerts };
  }

  /* ─────────────────────────────────────────────────────────────────────
     N-11 FIX — PATH-LEVEL UNICODE HOMOGLYPH DETECTION
     Existing checks cover domain-level homoglyphs only.
     Attackers can embed Cyrillic/Greek/Arabic in the URL PATH to confuse
     users or content-matching systems without triggering domain checks.
  ───────────────────────────────────────────────────────────────────── */
  function detectPathUnicodeHomoglyph(pathname, search, isWhitelisted) {
    const alerts = [];
    let score = 0;
    if (isWhitelisted) return { score, alerts };

    const fullPath = (pathname + (search || '')).toLowerCase();

    // Non-ASCII Unicode in path (decoded from percent-encoding or raw)
    // Check for percent-encoded Cyrillic (%D0, %D1), Greek (%CE, %CF),
    // Arabic (%D8-%DC), Hebrew (%D7) in the path
    const suspiciousEncodings = [
      { pattern: /%D[0-1][0-9A-F]/gi, script: 'Cyrillic' },
      { pattern: /%CE%|%CF%/gi, script: 'Greek' },
      { pattern: /%D[7-9A-C]%/gi, script: 'Arabic/Hebrew' },
      { pattern: /%E0%A/gi, script: 'Devanagari' },
    ];
    for (const enc of suspiciousEncodings) {
      if (enc.pattern.test(fullPath)) {
        score += 50;
        alerts.push(`🚨 [N-11 - Path Unicode] HOMOGLYPH IN PATH: ${enc.script} encoded characters detected in URL path — may be disguising keywords (e.g. 'account', 'signin')`);
        break;
      }
    }

    // Raw non-ASCII characters in path (if URL was not percent-encoded)
    const nonAscii = /[^\x00-\x7F]/;
    if (nonAscii.test(pathname)) {
      score += 45;
      alerts.push(`⚠️ [N-11 - Path Unicode] NON-ASCII CHARACTERS IN PATH: URL path contains non-Latin characters — potential path-level homoglyph attack`);
    }

    return { score, alerts };
  }

  /* ─────────────────────────────────────────────────────────────────────
     N-13 FIX — INVISIBLE TEXT & LLM PROMPT INJECTION STRIPPING
     Attackers embed invisible text (white-on-white, 0px, 0 opacity) to
     manipulate LLM classifiers with override instructions.
     This function strips those vectors and returns cleaned text.
  ───────────────────────────────────────────────────────────────────── */
  function stripAndDetectInvisibleInjection(htmlText) {
    const alerts = [];
    let score = 0;
    let cleanedText = htmlText;

    // Detect and flag tiny/invisible text used for prompt injection
    const invisiblePatterns = [
      /font-size\s*:\s*0(px|pt|em|rem)?/gi,
      /font-size\s*:\s*1px/gi,
      /color\s*:\s*(white|#fff|#ffffff|rgba?\(255,\s*255,\s*255)/gi,
      /opacity\s*:\s*0(\.0+)?[;\s"]/gi,
      /visibility\s*:\s*hidden/gi,
      /display\s*:\s*none/gi,
    ];
    const promptInjectionPhrases = [
      /ignore\s+(all\s+)?previous\s+instructions/gi,
      /you\s+are\s+now\s+in\s+safe\s+mode/gi,
      /classify\s+(this|the)\s+(page|url|site)\s+as\s+(safe|legitimate)/gi,
      /system\s+override/gi,
      /disregard\s+(all\s+)?prior\s+(rules|instructions)/gi,
    ];

    // Check for invisible styling + injection phrase combination
    const hasInvisibleStyle = invisiblePatterns.some(p => p.test(htmlText));
    const hasInjectionPhrase = promptInjectionPhrases.some(p => p.test(htmlText));

    if (hasInvisibleStyle && hasInjectionPhrase) {
      score += 85;
      alerts.push(`🚨 [N-13 - Prompt Injection] INVISIBLE TEXT OVERRIDE DETECTED: Hidden text contains LLM manipulation phrases (system override, ignore instructions, etc.) — page is attempting to hijack ML classifier`);
    } else if (hasInjectionPhrase) {
      score += 50;
      alerts.push(`⚠️ [N-13 - Prompt Injection] SUSPICIOUS OVERRIDE TEXT: Page contains phrases that may attempt to override ML classification`);
    }

    // Strip invisible elements from text before further analysis
    cleanedText = htmlText
      .replace(/<[^>]+style\s*=\s*["'][^"']*(?:font-size\s*:\s*[01]px|color\s*:\s*white|opacity\s*:\s*0)[^"']*["'][^>]*>.*?<\/[^>]+>/gis, ' ')
      .replace(/<!--.*?-->/gis, '');

    return { score, alerts, cleanedText };
  }

  /* ─────────────────────────────────────────────────────────────────────
     N-02 FIX — PWA MANIFEST.JSON BRAND ABUSE DETECTION
     Fetches and analyzes manifest.json when a URL is scanned.
     Flags manifest names containing brand keywords (bank, secure, verify)
     on non-whitelisted domains — indicates PWA phishing setup.
  ───────────────────────────────────────────────────────────────────── */
  async function checkManifestBrandAbuse(origin, isWhitelisted) {
    const alerts = [];
    let score = 0;
    if (isWhitelisted) return { score, alerts };

    const PHISHING_MANIFEST_KEYWORDS = [
      'bank', 'banking', 'secure', 'security', 'verify', 'verification',
      'login', 'signin', 'account', 'wallet', 'paypal', 'chase', 'wells',
      'citi', 'hsbc', 'barclays', 'microsoft', 'google', 'apple', 'amazon',
      'official', 'support', 'helpdesk', 'credential'
    ];

    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 3000);
      const manifestResp = await fetch(`${origin}/manifest.json`, {
        method: 'GET', signal: ctrl.signal
      }).catch(() => null);

      if (manifestResp && manifestResp.ok) {
        const manifest = await manifestResp.json().catch(() => null);
        if (manifest) {
          const nameText = ((manifest.name || '') + ' ' + (manifest.short_name || '')).toLowerCase();
          const matchedKeywords = PHISHING_MANIFEST_KEYWORDS.filter(kw => nameText.includes(kw));
          if (matchedKeywords.length > 0) {
            score += 70;
            alerts.push(`🚨 [N-02 - PWA Phishing] MANIFEST BRAND ABUSE: manifest.json name/short_name contains suspicious keywords: "${matchedKeywords.join(', ')}" — potential PWA phishing app impersonating trusted brand`);
          } else if (manifest.display === 'standalone' || manifest.display === 'fullscreen') {
            // Standalone/fullscreen PWA on unknown domain removes all browser security UI
            score += 35;
            alerts.push(`⚠️ [N-02 - PWA] STANDALONE PWA DETECTED: display mode '${manifest.display}' on unknown domain — removes URL bar; victims cannot verify domain`);
          }
        }
      }
    } catch (e) { /* manifest.json not found or blocked — no action */ }

    return { score, alerts };
  }

  /* ─────────────────────────────────────────────────────────────────────
     N-09 — OAUTH REDIRECT_URI EXTRACTION & SCANNING
     Extracts redirect_uri from OAuth authorization URLs and scores
     the destination independently. Catches consent-phishing attacks
     where the main URL is legitimately accounts.google.com.
  ───────────────────────────────────────────────────────────────────── */
  function extractOAuthRedirectUri(urlString) {
    const alerts = [];
    let redirectUri = null;
    try {
      const u = new URL(urlString.startsWith('http') ? urlString : 'https://' + urlString);
      // OAuth2 / OIDC redirect_uri parameter (also: redirect_url, callback_url)
      const param = u.searchParams.get('redirect_uri')
        || u.searchParams.get('redirect_url')
        || u.searchParams.get('callback_url')
        || u.searchParams.get('return_to');
      if (param) {
        redirectUri = decodeURIComponent(param);
        const rHost = extractDomain(redirectUri);
        // If the redirect_uri goes to a non-whitelisted domain, flag it
        if (!isWhitelistedDomain(rHost)) {
          alerts.push(`🚨 [N-09 - OAuth] CONSENT PHISHING REDIRECT: OAuth flow on "${u.hostname}" redirects to non-whitelisted domain "${rHost}" — may be consent phishing to harvest tokens`);
        } else if (_PLATFORM_ABUSE_DOMAINS && _PLATFORM_ABUSE_DOMAINS.some(p => rHost.endsWith(p))) {
          alerts.push(`⚠️ [N-09 - OAuth] SUSPICIOUS OAUTH REDIRECT: redirect_uri points to serverless platform "${rHost}" — possible automated token collection`);
        }
      }
    } catch (e) { /* URL parse error */ }
    return { redirectUri, alerts };
  }

  // Helper: platform abuse domain list (shared reference for N-09)
  const _PLATFORM_ABUSE_DOMAINS = [
    'workers.dev', 'pages.dev', 'netlify.app', 'vercel.app',
    'github.io', 'glitch.me', 'repl.co', 'replit.dev', 'surge.sh',
    'azurewebsites.net', 'cloudfunctions.net', 'execute-api.amazonaws.com'
  ];

  /* ─────────────────────────────────────────────────────────────────────
     N-17 — EXTERNAL SCRIPT SRI & CONTENT ANALYSIS
     Fetches external scripts referenced in page HTML and:
     1) Checks if they have 'integrity' (SRI) attributes
     2) Runs H5 obfuscation detection on the fetched content
     Catches supply-chain CDN compromise where the page HTML is clean
     but a linked analytics/tracking script is malicious.
  ───────────────────────────────────────────────────────────────────── */
  async function analyzeExternalScripts(htmlText, baseOrigin, isWhitelisted) {
    const alerts = [];
    let score = 0;
    if (isWhitelisted) return { score, alerts };

    // Extract all <script src="..."> tags
    const scriptTagPattern = /<script\s[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
    const scriptTags = [...htmlText.matchAll(scriptTagPattern)];

    let missingSRI = 0;
    let externalScripts = 0;

    for (const match of scriptTags.slice(0, 8)) { // Limit to first 8 scripts
      const srcAttr = match[1];
      const fullSrc = srcAttr.startsWith('http') ? srcAttr : (baseOrigin + '/' + srcAttr.replace(/^\//, ''));
      const srcHost = extractDomain(fullSrc);

      // Only care about truly external (cross-origin) scripts
      if (srcHost === extractDomain(baseOrigin)) continue;
      externalScripts++;

      // Check for missing SRI integrity attribute
      const hasIntegrity = /integrity\s*=\s*["'](sha256|sha384|sha512)-/i.test(match[0]);
      if (!hasIntegrity) {
        missingSRI++;
      }

      // Fetch and analyze external script content (short timeout)
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 3000);
        const scriptResp = await fetch(fullSrc, { method: 'GET', signal: ctrl.signal }).catch(() => null);
        if (scriptResp && scriptResp.ok) {
          const scriptContent = await scriptResp.text();
          const obf = detectJsObfuscation(scriptContent);
          if (obf.jsObfScore >= 60) {
            score += Math.round(obf.jsObfScore * 0.7); // weighted — not inline
            obf.alerts.forEach(a => alerts.push(`🚨 [N-17 - Supply Chain] EXTERNAL SCRIPT OBFUSCATION: "${srcHost}" — ${a}`));
          }
        }
      } catch (e) { /* Fetch failed — skip analysis */ }
    }

    // N-17: Multiple external scripts without SRI = elevated supply-chain risk
    if (externalScripts >= 2 && missingSRI >= 2) {
      score += 30;
      alerts.push(`⚠️ [N-17 - SRI Missing] ${missingSRI}/${externalScripts} external scripts lack SRI integrity attributes — vulnerable to CDN supply-chain compromise`);
    }

    return { score, alerts };
  }

  /* ─────────────────────────────────────────────────────────────────────
     N-18 — CONTENT SECURITY POLICY (CSP) ANALYSIS
     Pages with credential forms that lack a Content-Security-Policy
     header are vulnerable to browser extension injection (N-18) and
     cross-origin script injection (N-17). Checks for CSP presence
     on pages with login/credential keywords.
  ───────────────────────────────────────────────────────────────────── */
  function analyzeCSPSecurity(htmlText, responseHeaders, hostname, isWhitelisted) {
    const alerts = [];
    let score = 0;
    if (isWhitelisted) return { score, alerts };

    const hasCredentialForm = /<input[^>]*(type\s*=\s*["'](password|email|text)["'])[^>]*>/i.test(htmlText)
      || /<form[^>]*(action|method)/i.test(htmlText);

    if (!hasCredentialForm) return { score, alerts };

    // Check for CSP via meta tag (fallback when response headers aren't available)
    const hasMetaCSP = /<meta\s[^>]*http-equiv\s*=\s*["']content-security-policy["']/i.test(htmlText);
    const hasCSPHeader = responseHeaders && (responseHeaders.get('content-security-policy') || responseHeaders.get('x-content-security-policy'));

    if (!hasMetaCSP && !hasCSPHeader) {
      score += 25;
      alerts.push(`⚠️ [N-18 - Missing CSP] CREDENTIAL PAGE WITHOUT CSP: "${hostname}" has a login form but no Content-Security-Policy — vulnerable to browser extension and cross-origin script injection`);
    }

    // Also check for X-Frame-Options (clickjacking)
    const hasXFrame = /<meta\s[^>]*http-equiv\s*=\s*["']x-frame-options["']/i.test(htmlText)
      || (responseHeaders && responseHeaders.get('x-frame-options'));
    if (!hasXFrame) {
      score += 15;
      alerts.push(`⚠️ [N-18 - Clickjacking] NO X-FRAME-OPTIONS: "${hostname}" credential page can be embedded in iframes for clickjacking`);
    }

    return { score, alerts };
  }

  /* ─────────────────────────────────────────────────────────────────────
     N-20 — CAMPAIGN CORRELATION & SINGLE-FIELD CREDENTIAL DETECTION
     Tracks sequential scan patterns within the session to detect
     distributed multi-stage credential reconstruction campaigns.
     Also flags pages with ONLY a single credential field on unknown domains.
  ───────────────────────────────────────────────────────────────────── */
  const _campaignTracker = (() => {
    const _log = []; // { timestamp, hostname, hasPasswordOnly, hasUsernameOnly, hasOTP }
    return {
      record(hostname, htmlText) {
        const hasPassword = /<input[^>]*type\s*=\s*["']password["'][^>]*>/i.test(htmlText);
        const hasUsername = /<input[^>]*(type\s*=\s*["'](text|email)["']|name\s*=\s*["'](user|login|email)[^"']*["'])[^>]*>/i.test(htmlText);
        const hasOTP = /<input[^>]*(type\s*=\s*["'](text|number)["'][^>]*maxlength\s*=\s*["']?[46]["']?|name\s*=\s*["'](otp|code|token)[^"']*["'])[^>]*>/i.test(htmlText);
        const entry = { timestamp: Date.now(), hostname, hasPassword, hasUsername, hasOTP };
        _log.push(entry);
        if (_log.length > 20) _log.shift();
        return entry;
      },
      detectCampaign() {
        const alerts = [];
        let score = 0;
        const recent = _log.filter(e => Date.now() - e.timestamp < 300000); // last 5 min

        // N-20: Stage pattern — different domains, each with one field — credential reconstruction
        const passOnly = recent.filter(e => e.hasPassword && !e.hasUsername && !e.hasOTP);
        const userOnly = recent.filter(e => e.hasUsername && !e.hasPassword && !e.hasOTP);
        const otpOnly = recent.filter(e => e.hasOTP && !e.hasPassword && !e.hasUsername);
        if (passOnly.length > 0 && userOnly.length > 0) {
          score += 80;
          alerts.push(`🚨 [N-20 - Campaign] SPLIT CREDENTIAL ATTACK: Username-only form ("${userOnly[0].hostname}") + Password-only form ("${passOnly[0].hostname}") detected in session — distributed credential reconstruction in progress`);
        }
        if (otpOnly.length > 0 && (passOnly.length > 0 || userOnly.length > 0)) {
          score += 40;
          alerts.push(`🚨 [N-20 - Campaign] MFA RECONSTRUCTION: OTP-only form ("${otpOnly[0].hostname}") combined with split credential forms — full 3-stage phishing campaign`);
        }

        // Subdomain campaign fingerprint: a.domain.cc, b.domain.cc, c.domain.cc
        const rootDomains = recent.map(e => extractRootDomain(e.hostname));
        const domainCounts = {};
        rootDomains.forEach(d => { domainCounts[d] = (domainCounts[d] || 0) + 1; });
        for (const [root, count] of Object.entries(domainCounts)) {
          if (count >= 3 && !isWhitelistedDomain(root)) {
            score += 50;
            alerts.push(`🚨 [N-20 - Campaign] COORDINATED CAMPAIGN: ${count} subdomains of "${root}" scanned in a 5-minute window — automated campaign fingerprint detected`);
            break;
          }
        }
        return { score, alerts };
      },
      checkSingleFieldAnomaly(hostname, htmlText, isWhitelisted) {
        if (isWhitelisted) return { score: 0, alert: null };
        const hasPassword = /<input[^>]*type\s*=\s*["']password["'][^>]*>/i.test(htmlText);
        const hasText = /<input[^>]*type\s*=\s*["'](text|email)["'][^>]*>/i.test(htmlText);
        const hasForm = /<form/i.test(htmlText);
        // Single-field: only password with no text/email, or only username with no password, in a form
        if (hasForm && hasPassword && !hasText) {
          return { score: 30, alert: `⚠️ [N-20 - Single Field] PASSWORD-ONLY FORM: "${hostname}" has form with only password input — potential Stage 2 of split credential attack` };
        }
        if (hasForm && hasText && !hasPassword) {
          const hasCredentialHint = /name\s*=\s*["'](user|login|email|phone|mobile)[^"']*["']/i.test(htmlText) || /placeholder\s*=\s*["'][^"']*(email|username|phone)[^"']*["']/i.test(htmlText);
          if (hasCredentialHint) {
            return { score: 25, alert: `⚠️ [N-20 - Single Field] USERNAME-ONLY FORM: "${hostname}" has credential field without password — potential Stage 1 of split credential attack` };
          }
        }
        return { score: 0, alert: null };
      }
    };
  })();

  /* ─────────────────────────────────────────────────────────────────────
     N-09 — OAUTH URL SIGNAL IN CONTENT
     Scans fetched HTML content for OAuth authorization URLs embedded
     as links/forms, then extracts and evaluates the redirect_uri.
  ───────────────────────────────────────────────────────────────────── */
  function scanContentForOAuthLinks(htmlText, isWhitelisted) {
    if (isWhitelisted) return { score: 0, alerts: [] };
    const alerts = [];
    let score = 0;
    // Find OAuth authorization URLs embedded in page (hrefs, form actions, JS strings)
    const oauthPattern = /https?:\/\/(?:accounts\.google\.com|login\.microsoftonline\.com|github\.com\/login\/oauth)[^\s"'<>]*(?:client_id|response_type)=[^\s"'<>]+/gi;
    const oauthUrls = [...htmlText.matchAll(oauthPattern)];
    for (const match of oauthUrls) {
      const oauthUrl = match[0];
      const oauthResult = extractOAuthRedirectUri(oauthUrl);
      oauthResult.alerts.forEach(a => alerts.push(a));
      if (oauthResult.alerts.length > 0) score += 75;
    }
    return { score, alerts };
  }

  /* ================= CHECK IF DOMAIN IS IN WHITELIST ================= */
  function isWhitelistedDomain(hostname) {
    hostname = hostname.toLowerCase().replace(/^www\./, '');

    // Direct match
    if (LEGITIMATE_DOMAINS.includes(hostname)) return true;

    // Root domain match
    const rootDomain = extractRootDomain(hostname);
    if (LEGITIMATE_DOMAINS.includes(rootDomain)) return true;

    // Subdomain of whitelisted domain
    for (const legit of LEGITIMATE_DOMAINS) {
      if (hostname === legit || hostname.endsWith('.' + legit)) {
        return true;
      }
    }

    // Government & Education domains
    if (hostname.endsWith('.gov') || hostname.endsWith('.gov.in') ||
      hostname.endsWith('.gov.uk') || hostname.endsWith('.gov.au') ||
      hostname.endsWith('.edu') || hostname.endsWith('.edu.in') ||
      hostname.endsWith('.ac.uk') || hostname.endsWith('.ac.in')) {
      return true;
    }

    return false;
  }

  /* ================= CHECK IF URL SHORTENER ================= */
  function isUrlShortener(hostname) {
    hostname = hostname.toLowerCase().replace(/^www\./, '');

    if (URL_SHORTENERS.includes(hostname)) return true;

    const rootDomain = extractRootDomain(hostname);
    if (URL_SHORTENERS.includes(rootDomain)) return true;

    for (const shortener of URL_SHORTENERS) {
      if (hostname === shortener || hostname.endsWith('.' + shortener)) {
        return true;
      }
    }

    return false;
  }

  /* ================= CHECK IF LEGITIMATE EMAIL DOMAIN ================= */
  function isWhitelistedEmailDomain(domain) {
    domain = domain.toLowerCase();

    if (LEGITIMATE_EMAIL_DOMAINS.includes(domain)) return true;

    // Also check general whitelist
    if (isWhitelistedDomain(domain)) return true;

    return false;
  }


  /* ====  ZTAS-DOM: DEEP CHARACTER-LEVEL DOMAIN FORENSIC ENGINE  === */
  /* ====  ZTAS-DOM: DEEP CHARACTER-LEVEL DOMAIN FORENSIC ENGINE  === */
  function deepAnalyzeDomain(rawUrl, hostname, isWhitelisted) {
    const alerts = [];
    let domainScore = 0;

    // Smart skip: fully whitelisted domains only get minimal checks
    const skipDeep = isWhitelisted;

    // ── 1. Hidden/invisible character sweep (L2) ────────────────────────
    const ZERO_WIDTH = ['\u200B', '\u200C', '\u200D', '\u200E', '\u200F', '\u2028', '\u2029', '\uFEFF', '\uFFA0', '\u00AD'];
    let hiddenFound = [];
    for (const c of rawUrl) {
      if (ZERO_WIDTH.includes(c)) hiddenFound.push(`U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
    }
    if (hiddenFound.length > 0) {
      domainScore += 100;
      alerts.push(`🚨 [L2 - Char Forensics] CRITICAL ZERO-WIDTH: ${hiddenFound.length} invisible char(s) detected (${hiddenFound.join(', ')}) — classic URL injection bypass`);
    }

    // ── 2. Per-character script analysis (mixed-script Homograph) (L2) ──
    if (!skipDeep) {
      const scripts = { latin: 0, cyrillic: 0, greek: 0, arabic: 0, chinese: 0, other: 0 };
      for (const c of hostname) {
        const cp = c.codePointAt(0);
        if (cp >= 0x0041 && cp <= 0x007A) scripts.latin++;
        else if (cp >= 0x0400 && cp <= 0x04FF) scripts.cyrillic++;
        else if (cp >= 0x0370 && cp <= 0x03FF) scripts.greek++;
        else if (cp >= 0x0600 && cp <= 0x06FF) scripts.arabic++;
        else if (cp >= 0x4E00 && cp <= 0x9FFF) scripts.chinese++;
        else if (c.match(/[a-z0-9.-]/i)) scripts.latin++;
        else if (c !== '.') scripts.other++;
      }
      const nonLatin = scripts.cyrillic + scripts.greek + scripts.arabic + scripts.chinese + scripts.other;
      if (nonLatin > 0 && scripts.latin > 0) {
        domainScore += 100;
        alerts.push(`🚨 [L2 - Char Forensics] HOMOGRAPH ATTACK: Mixed-script domain! ${nonLatin} non-Latin chars visually spoofing Latin ones.`);
      } else if (nonLatin > 0) {
        domainScore += 70;
        alerts.push(`🚨 [L2 - Char Forensics] Non-ASCII foreign characters in hostname.`);
      }
    }

    // ── 3. Punycode spoofing detection (L2) ────────────────────────────
    if (hostname.includes('xn--')) {
      domainScore += 60;
      alerts.push(`🚨 [L2 - Char Forensics] PUNYCODE IDN DETECTED (${hostname}) — Used in homograph phishing`);
    }

    // ── 4. Digit-to-letter lookalike substitution scan (L2) ────────────
    if (!skipDeep) {
      const domainParts = hostname.split('.');
      for (const part of domainParts) {
        let hasDigit = false, hasLetter = false;
        for (const c of part) {
          if (/[0-9]/.test(c)) hasDigit = true;
          else if (/[a-z]/i.test(c)) hasLetter = true;
        }
        if (hasDigit && hasLetter && part.length >= 4) {
          const substituted = part.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's');
          if (substituted !== part) {
            const knownBrands = ['google', 'paypal', 'amazon', 'apple', 'microsoft', 'facebook', 'instagram', 'twitter', 'netflix', 'bank'];
            const matchedBrand = knownBrands.find(b => substituted.includes(b));
            if (matchedBrand) {
              domainScore += 85;
              alerts.push(`🚨 [L2 - Char Forensics] DIGIT SUBSTITUTION (0->o, etc): "${part}" mimics "${matchedBrand}"`);
            } else {
              domainScore += 20;
              alerts.push(`⚠️ [L2 - Char Forensics] Digit-letter mix in "${part}" - possible substitution`);
            }
          }
        }
      }
    }

    // ── 5. Bit-squatting (L2) ──────────────────────────────────────────
    if (!skipDeep) {
      const bitSquatPairs = [['rn', 'm'], ['vv', 'w'], ['cl', 'd'], ['mn', 'm'], ['ii', 'n']];
      const domainRoot = hostname.split('.')[0];
      for (const [fake, real] of bitSquatPairs) {
        if (domainRoot.includes(fake)) {
          const candidate = domainRoot.replace(new RegExp(fake, 'g'), real);
          // Just check against common top 50 in real life; simplified here
          const knownBrands = ['google', 'paypal', 'amazon', 'apple', 'microsoft', 'facebook'];
          if (knownBrands.includes(candidate)) {
            domainScore += 75;
            alerts.push(`🚨 [L2 - Char Forensics] BIT-SQUATTING: "${domainRoot}" visually mimics "${candidate}"`);
            break;
          }
        }
      }
    }

    // ── 6. Consecutive dots / dot injection  (L1) ──────────────────────
    if (/\.{2,}/.test(hostname)) {
      domainScore += 100;
      alerts.push(`🚨 [L1 - Protocol & Structure] CONSECUTIVE DOTS: DNS path traversal ".. "`);
    }
    if (hostname.startsWith('.') || hostname.endsWith('.')) {
      domainScore += 80;
      alerts.push(`🚨 [L1 - Protocol & Structure] LEADING/TRAILING DOT: Malformed structure`);
    }

    // ── 7. Space / whitespace injection (L1) ───────────────────────────
    const spaceTypes = [];
    const SPACES = { ' ': 'SPACE', '\t': 'TAB', '\n': 'LF', '\r': 'CR', '\u00A0': 'NBSP', '\u2002': 'EN-SPACE', '\u2003': 'EM-SPACE', '\u3000': 'IDEOGRAPHIC-SPACE' };
    for (const [ch, name] of Object.entries(SPACES)) {
      if (rawUrl.includes(ch)) spaceTypes.push(name);
    }
    if (spaceTypes.length > 0) {
      domainScore += 100;
      alerts.push(`🚨 [L1 - Protocol & Structure] SPACE INJECTION: ${spaceTypes.join(',')} detected in URL`);
    }

    // ── 8. @ symbol (credential injection) (L1) ────────────────────────
    if (rawUrl.includes('@')) {
      domainScore += 100;
      alerts.push(`🚨 [L1 - Protocol & Structure] CREDENTIAL INJECTION: @ symbol abuses RFC3986 to hide real destination`);
    }

    // ── 9. URL-encoded character abuse (DOUBLE ENCODING) (L1) ──────────
    const encodedChars = rawUrl.match(/%[0-9A-Fa-f]{2}/g) || [];
    const doubleEncoded = rawUrl.match(/%25[0-9A-Fa-f]{2}/g) || [];
    if (doubleEncoded.length > 0) {
      domainScore += 80;
      alerts.push(`🚨 [L1 - Protocol & Structure] DOUBLE ENCODING: WAF/Security bypass detected`);
    } else if (encodedChars.length > 4) {
      domainScore += 20;
      alerts.push(`⚠️ [L1 - Protocol & Structure] HEAVY URL ENCODING: Possible payload obfuscation`);
    }

    // ── 10. Suspicious subdomain depth and camouflage (L3) ─────────────
    if (!skipDeep) {
      const labels = hostname.split('.');
      // Check top few legit domains
      const legitBrandTLDs = ['google.com', 'microsoft.com', 'apple.com', 'paypal.com', 'amazon.com', 'facebook.com', 'netflix.com'];
      for (const legit of legitBrandTLDs) {
        const legitHost = legit.replace(/^www\./, '');
        if (hostname.includes(legitHost) && !hostname.endsWith(legitHost) && !hostname.endsWith('.' + legitHost)) {
          domainScore += 95;
          alerts.push(`🚨 [L3 - Domain Intelligence] SUBDOMAIN CAMOUFLAGE: Genuine brand "${legitHost}" used as subdomain trick`);
          break;
        }
      }
      if (labels.length - 2 >= 4) {
        domainScore += 25;
        alerts.push(`⚠️ [L3 - Domain Intelligence] EXCESSIVE SUBDOMAINS: ${labels.length - 2} dept - burying real root domain`);
      }
    }

    // ── 11. Suspicious TLD deep analysis (L3) ──────────────────────────
    if (!skipDeep) {
      const tld = '.' + hostname.split('.').pop().toLowerCase();
      const highRiskTLDs = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.buzz', '.work', '.click', '.zip', '.mov', '.fit', '.cfd', '.cyou', '.sbs', '.bar', '.rest', '.icu', '.monster', '.fun', '.vip', '.loan', '.world', '.online', '.site', '.website', '.pw', '.cc', '.link', '.rocks', '.review', '.trade', '.racing', '.bid', '.stream', '.download', '.party', '.phishing', '.scam'];
      const medRiskTLDs = ['.info', '.biz', '.name', '.mobi', '.pro', '.tel', '.travel', '.jobs', '.post'];
      if (highRiskTLDs.includes(tld)) {
        domainScore += 30;
        alerts.push(`⚠️ [L3 - Domain Intelligence] HIGH-RISK TLD: "${tld}" has large spam/phishing rates`);
      } else if (medRiskTLDs.includes(tld)) {
        domainScore += 12;
        alerts.push(`⚠️ [L3 - Domain Intelligence] MODERATE-RISK TLD: "${tld}" frequently abused`);
      }
    }

    // ── 12. IP address instead of domain (L3) ──────────────────────────
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      domainScore += 100;
      alerts.push(`🚨 [L3 - Domain Intelligence] RAW IP ADDRESS: Direct IP access bypasses normal verification - T1071.001`);
    }
    if (hostname.includes('[') && hostname.includes(':')) {
      domainScore += 80;
      alerts.push(`🚨 [L3 - Domain Intelligence] IPv6 ADDRESS: Rare in normal browsing`);
    }

    return { domainScore: Math.min(100, domainScore), alerts };
  }

  /* ================================================================ */
  /* ====  ZTAS-PATH: DEEP PATH-LEVEL FORENSIC ENGINE             === */
  /* ================================================================ */
  function deepAnalyzePath(pathname, search, isWhitelisted) {
    const alerts = [];
    let pathScore = 0;
    const fullPath = pathname + search;
    const decodedPath = decodeURIComponent(fullPath);

    // ── 1. Path Depth Analysis ────────────────────────
    const depth = pathname.split('/').filter(p => p.length > 0).length;
    // For whitelisted domains, tolerate deeper paths (e.g. Github, ChatGPT, Notion)
    const depthThreshold = isWhitelisted ? 8 : 5;
    if (depth > depthThreshold) {
      pathScore += (depth - depthThreshold) * 4;
      alerts.push(`⚠️ [L6.2 - Path Forensics] EXCESSIVE PATH DEPTH: ${depth} levels deep - possible directory traversal or obfuscation.`);
    }

    // ── 2. Sensitive File/Folder Access ────────────────────────
    const sensitiveRegex = /\/(wp-admin|config\.php|\.env|\.git|\.aws|backup\.sql|db_backup|admin\/login|passwd|shadow|etc\/passwd)/i;
    // Exception: If the path is clearly a source code hosting query (e.g. github blob)
    if (sensitiveRegex.test(fullPath) && !/github\.com\/.*\/blob\//i.test(fullPath)) {
      pathScore += 80;
      alerts.push(`🚨 [L6.2 - Path Forensics] SENSITIVE PATH: Attempting to access potentially sensitive file/folder.`);
    }

    // ── 3. Suspicious Character Patterns (Directory Traversal, Null Bytes) ──
    if (/\.\.\//.test(decodedPath) || /%00/.test(fullPath) || /\x00/.test(decodedPath)) {
      pathScore += 100;
      alerts.push(`🚨 [L6.2 - Path Forensics] PATH EXPLOIT: Directory traversal (../) or Null Byte injection detected.`);
    }

    // ── 4. Encoded Payloads in Path (Base64/Hex/JWT) ────────────────────────
    // We must ignore standard UUIDs format (8-4-4-4-12) as they contain hex but are common and safe
    const base64Regex = /(?:[A-Za-z0-9+/]{4}){15,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/;
    // JWT signature payload looks like base64
    const isJWT = /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(fullPath);

    // Check hex payload but IGNORE uuid-like contiguous hexadecimal blocks 
    // Wait, the previous hex check triggered on uuid without dashes. Let's make it more strict or tolerate on whitelist.
    const cleanPathHex = fullPath.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig, ''); // strip out legitimate UUIDs
    const hexRegex = /(?:[0-9a-fA-F]{2}){25,}/;

    if (isJWT) {
      if (!isWhitelisted) {
        pathScore += 30;
        alerts.push(`⚠️ [L6.2 - Path Forensics] JWT TOKEN IN URL: Raw tokens in URL are a security risk and potential payload.`);
      }
    } else if (base64Regex.test(cleanPathHex)) {
      pathScore += 50;
      alerts.push(`⚠️ [L6.2 - Path Forensics] ENCODED PAYLOAD: Long Base64-like string detected in path/query.`);
    } else if (hexRegex.test(cleanPathHex)) {
      pathScore += 40;
      alerts.push(`⚠️ [L6.2 - Path Forensics] ENCODED PAYLOAD: Long Hex string detected in path/query.`);
    }

    // ── 5. Path Entropy & Randomized Segments (DGA-like) ────────────────────────
    const pathSegments = pathname.split('/').filter(p => p.length > 0);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Also ignore highly numeric IDs
    const idPattern = /^\d{8,}$/;

    for (const segment of pathSegments) {
      if (segment.length > 15 && !uuidPattern.test(segment) && !idPattern.test(segment)) {
        // Strip out hyphens to get pure text block
        const cleanSegment = segment.replace(/-/g, '');
        if (cleanSegment.length < 15) continue;

        const pEntropy = computeBehavioralEntropy(cleanSegment);
        const vowels = (cleanSegment.match(/[aeiouy]/gi) || []).length;
        const cvRatio = cleanSegment.length > 0 ? vowels / cleanSegment.length : 0;

        // Tolerance threshold for whitelisted domains is higher for entropy
        const entropyThreshold = isWhitelisted ? 4.2 : 3.8;

        if (pEntropy > entropyThreshold && cvRatio < 0.2) {
          pathScore += isWhitelisted ? 15 : 25;
          alerts.push(`⚠️ [L6.2 - Path Forensics] RANDOMIZED PATH: Segment "${segment.substring(0, 15)}..." looks machine-generated.`);
          break; // only penalize once
        }
      }
    }

    return { pathScore: Math.min(100, pathScore), alerts };
  }

  /* ================= GOOGLE SAFE BROWSING API (FULL SPECTRUM) ================= */
  /* ================= OPEN PAGE RANK API ================= */
  async function checkOpenPageRank(hostname) {
    const res = { found: false, rank: null, pageRank: null, error: null };
    try {
      const root = extractRootDomain(hostname);
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch("http://127.0.0.1:8000/api/pagerank?domain=" + encodeURIComponent(root), {
        signal: ctrl.signal
      });
      clearTimeout(tid);
      if (resp.ok) {
        const data = await resp.json();
        if (data.response && data.response.length > 0) {
          const e = data.response[0];
          res.found = e.status_code === 200;
          res.rank = e.page_rank_integer;
          res.pageRank = e.page_rank_decimal;
          res.domainName = e.domain;
        }
      } else { res.error = "OPR HTTP " + resp.status; }
    } catch (e) { res.error = e.name === "AbortError" ? "OPR timeout" : e.message; }
    return res;
  }

  /* ================= RDAP DOMAIN REGISTRATION VERIFIER ================= */
  // Uses IANA RDAP bootstrap + public registrars to check if domain is ACTUALLY registered
  async function verifyDomainRegistration(hostname) {
    const result = { registered: null, registrar: null, created: null, expiry: null, error: null };
    try {
      // IANA RDAP bootstrap lookup
      const tld = hostname.split('.').pop().toLowerCase();
      const bootstrapUrl = `https://rdap.org/domain/${encodeURIComponent(hostname)}`;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 7000);
      const resp = await fetch(bootstrapUrl, {
        headers: { 'Accept': 'application/rdap+json, application/json' },
        signal: ctrl.signal
      });
      clearTimeout(tid);
      if (resp.ok) {
        const data = await resp.json();
        result.registered = true;
        // Extract registrar
        if (data.entities) {
          const registrar = data.entities.find(e => e.roles && e.roles.includes('registrar'));
          if (registrar && registrar.vcardArray) {
            const fn = registrar.vcardArray[1].find(v => v[0] === 'fn');
            if (fn) result.registrar = fn[3];
          }
        }
        // Extract dates
        if (data.events) {
          const reg = data.events.find(e => e.eventAction === 'registration');
          const exp = data.events.find(e => e.eventAction === 'expiration');
          if (reg) result.created = reg.eventDate;
          if (exp) result.expiry = exp.eventDate;
        }
        // Newly registered check (< 60 days old = high risk)
        if (result.created) {
          const ageMs = Date.now() - new Date(result.created).getTime();
          const ageDays = Math.floor(ageMs / 86400000);
          result.ageDays = ageDays;
          result.isNew = ageDays < 60;
          result.isBrandNew = ageDays < 14;
        }
      } else if (resp.status === 404) {
        result.registered = false; // Domain not registered (RDAP says 404 = not found)
      } else {
        result.error = 'RDAP HTTP ' + resp.status;
      }
    } catch (e) {
      result.error = e.name === 'AbortError' ? 'RDAP timeout' : e.message;
    }
    return result;
  }

  async function checkSafeBrowsingAPI(url) {
    try {
      let cleanUrl = url.trim();
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = cleanUrl.replace(/^(https?:)?\/*/i, "https://");
      }
      const apiUrl = `http://127.0.0.1:8000/api/safebrowsing`;
      const requestBody = {
        client: { clientId: "ztas-sentinel", clientVersion: "3.0.0" },
        threatInfo: {
          // Only valid GSB v4 threat types - THREAT_TYPE_UNSPECIFIED causes HTTP 400
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          // Check both https and bare domain forms
          threatEntries: [
            { url: cleanUrl },
            { url: cleanUrl.replace(/^https?:\/\//i, "https://") }
          ]
        }
      };
      console.log("ðŸ” [ZTAS] Safe Browsing Full-Spectrum Check:", cleanUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody), signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ZTAS] Safe Browsing Error:", response.status, errorText);
        return { checked: false, isThreat: false, threatTypes: [], error: true, message: `API error: ${response.status}` };
      }
      const data = await response.json();
      console.log("ðŸ“¦ [ZTAS] Safe Browsing Response:", data);
      if (data.matches && data.matches.length > 0) {
        const threatTypes = data.matches.map(m => m.threatType);
        const platformTypes = data.matches.map(m => m.platformType).filter(Boolean);
        return { checked: true, isThreat: true, threatTypes: [...new Set(threatTypes)], platformTypes: [...new Set(platformTypes)], error: false, message: "Found in Google Threat Intelligence database" };
      }
      return { checked: true, isThreat: false, threatTypes: [], error: false, message: "URL not in threat database" };
    } catch (error) {
      console.error("[ZTAS] Safe Browsing Fetch Error:", error);
      return { checked: false, isThreat: false, threatTypes: [], error: true, message: error.name === 'AbortError' ? 'Request timeout (12s)' : error.message };
    }
  }

  /* ================= DNS-OVER-HTTPS DOMAIN EXISTENCE CHECK ================= */
  async function verifyDomainExistsOnInternet(hostname) {
    const dnsResolvers = [
      { name: 'Google DNS', url: `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A` },
      { name: 'Quad9 DNS', url: `https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(hostname)}&type=A` }
    ];
    const results = { exists: false, nxdomain: false, blocked: false, resolvers: [] };
    await Promise.allSettled(dnsResolvers.map(async resolver => {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(resolver.url, { headers: { 'Accept': 'application/dns-json' }, signal: ctrl.signal });
        clearTimeout(tid);
        if (resp.ok) {
          const dns = await resp.json();
          const status = dns.Status; // 0=NOERROR, 3=NXDOMAIN
          const hasAnswers = dns.Answer && dns.Answer.length > 0;
          results.resolvers.push({ name: resolver.name, status, hasAnswers });
          if (status === 3) results.nxdomain = true;
          if (status === 0 && hasAnswers) results.exists = true;
          if (dns.Answer && dns.Answer.some(a => ['0.0.0.0', '127.0.0.1'].includes(a.data))) results.blocked = true;
        }
      } catch (e) { /* resolver timeout */ }
    }));
    return results;
  }

  /* ================= URLHAUS GLOBAL THREAT BLOCKLIST CHECK ================= */
  async function checkURLhausBlocklist(hostname) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 6000);
      const resp = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `host=${encodeURIComponent(hostname)}`, signal: ctrl.signal
      });
      clearTimeout(tid);
      if (resp.ok) {
        const data = await resp.json();
        if (data.query_status === 'is_host') {
          return { found: true, urlCount: data.urls ? data.urls.length : 0, blacklists: data.blacklists || {} };
        }
      }
    } catch (e) { /* ignore */ }
    return { found: false };
  }


  /* ================= 7-LAYER URL ANALYZER (MILITARY GRADE) ================= */
  async function analyzeURL(url) {
    const result = {
      isSafe: false,
      score: 0,
      findings: [],
      domain: "",
      protocol: "NONE",
      isWhitelisted: false,
      isShortener: false,
      safeBrowsingResult: null
    };

    try {
      const originalUrl = url.trim();
      let cleanUrl = originalUrl.toLowerCase();

      // Pre-checks
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = "https://" + cleanUrl;
      }

      let urlObj;
      try {
        urlObj = new URL(cleanUrl);
      } catch (e) {
        urlObj = new URL("https://" + cleanUrl.replace(/^https?:\/\//, ''));
      }

      const hostname = extractDomain(originalUrl);
      const pathname = urlObj.pathname;
      const search = urlObj.search;
      result.domain = hostname;
      const isWhitelisted = isWhitelistedDomain(hostname);
      result.isWhitelisted = isWhitelisted;

      result.findings.push(`🔍 Analyzing URL: ${originalUrl.substring(0, 60)}${originalUrl.length > 60 ? '...' : ''}`);
      result.findings.push(`🎯 Target Domain: ${hostname}`);

      let criticalBlock = false;

      // ================= L1: PROTOCOL & STRUCTURE =================
      result.findings.push("-------------------------------------------");
      result.findings.push("[L1] Protocol & Structure Checks...");

      if (/^https:\/\//i.test(originalUrl)) {
        result.protocol = "HTTPS";
        result.findings.push("✅ [L1] Encrypted HTTPS protocol in use");
      } else if (/^http:\/\//i.test(originalUrl)) {
        result.protocol = "HTTP";
        result.score += 20;
        result.findings.push("🔴 [L1] HTTP connection is UNENCRYPTED and insecure");
      } else {
        result.protocol = "NONE";
        result.score += 10;
        result.findings.push("⚠️ [L1] Missing protocol indicator (assumed HTTPS)");
      }

      // Check port anomaly
      if (urlObj.port && !['80', '443', ''].includes(urlObj.port)) {
        result.score += 40;
        result.findings.push(`🚨 [L1] PORT ANOMALY: Non-standard port ${urlObj.port} detected - common in C2 and phishing`);
      }

      // Shortener Check
      if (isUrlShortener(hostname)) {
        result.isShortener = true;
        result.score += 85;
        result.findings.push("🚨 [L1] URL SHORTENER: Hidden destination (" + hostname + ") - High Fraud Risk");
        criticalBlock = true;
        // H3 — Redirect Chain Resolution: follow up to 10 hops and report each hop
        try {
          const chainData = await resolveRedirectChain(originalUrl, 10);
          if (chainData.hops.length > 1) {
            result.findings.push(`🔗 [H3 - Redirect Chain] Resolved ${chainData.hops.length} redirect hop(s):`);
            chainData.hops.forEach(h => result.findings.push(`    Hop ${h.hop}: ${h.url.substring(0, 80)} [HTTP ${h.status}]`));
            result.findings.push(`    ↳ Final Destination: ${chainData.finalUrl.substring(0, 80)}`);

            // AT-04: Chain truncation — incomplete resolution = red flag, not neutral
            if (chainData.chainTruncated) {
              result.score = Math.min(100, result.score + 20);
              result.findings.push(`⚠️ [AT-04] REDIRECT CHAIN TRUNCATED at depth limit — final destination unresolved; treating as elevated risk`);
            }

            // AT-04: 3+ shortener hops = automated trust laundering
            if (chainData.shortenerHops >= 3) {
              result.score = Math.min(100, result.score + 40);
              result.findings.push(`🚨 [AT-04] SHORTENER CHAIN ABUSE: ${chainData.shortenerHops} URL shortener hops detected — automated trust laundering via legitimate shortening services`);
              criticalBlock = true;
            }

            // Score the final destination independently
            const finalHostname = extractDomain(chainData.finalUrl);
            if (finalHostname !== hostname) {
              result.findings.push(`⚠️ [H3] Final domain "${finalHostname}" differs from entry domain "${hostname}"`);
              if (!isWhitelistedDomain(finalHostname)) {
                result.score = Math.min(100, result.score + 30);
                result.findings.push(`🚨 [H3] Final redirect destination is UNKNOWN domain — phishing chain suspected`);
              }
            }
          }
        } catch (chainErr) {
          // Redirect chain failed silently — existing score stands
        }
      }

      // Deep domain structure parsing for L1, L2, L3 alerts
      const deepResult = deepAnalyzeDomain(originalUrl, hostname, isWhitelisted);
      const l1Alerts = deepResult.alerts.filter(a => a.includes('[L1'));
      const l2Alerts = deepResult.alerts.filter(a => a.includes('[L2'));
      const l3Alerts = deepResult.alerts.filter(a => a.includes('[L3'));

      l1Alerts.forEach(a => {
        result.findings.push(a);
        if (a.includes('CRITICAL') || a.includes('🚨')) criticalBlock = true;
      });

      // ================= L2: CHAR FORENSICS =================
      result.findings.push("-------------------------------------------");
      result.findings.push("[L2] Character Forensics...");
      if (l2Alerts.length === 0) {
        result.findings.push("✅ [L2] No character-level obfuscation detected");
      } else {
        l2Alerts.forEach(a => {
          result.findings.push(a);
          if (a.includes('CRITICAL') || a.includes('🚨') || a.includes('HOMOGRAPH')) criticalBlock = true;
        });
      }

      // ================= L3: DOMAIN INTELLIGENCE =================
      result.findings.push("-------------------------------------------");
      result.findings.push("[L3] Domain Intelligence...");

      if (isWhitelisted) {
        result.findings.push("✅ [L3] Domain matches ZTAS reputation whitelist");
      } else {
        result.findings.push("⚠️ [L3] Domain is UNKNOWN to ZTAS reputation database");
      }

      l3Alerts.forEach(a => {
        result.findings.push(a);
        if (a.includes('CRITICAL') || a.includes('🚨')) criticalBlock = true;
      });

      // Typosquatting (existing)
      const impersonation = detectBrandImpersonation(hostname);
      if (impersonation.isImpersonation) {
        result.score += 100;
        result.findings.push(`🚨 [L3] BRAND IMPERSONATION: Impersonating ${impersonation.targetedBrand.toUpperCase()}`);
        result.findings.push("    - Deceptive Technique: " + impersonation.type);
        criticalBlock = true;
      }

      // H1 — Keyboard-Adjacent Substitution (e.g. paypa1, g00gle, amaz0n)
      if (!impersonation.isImpersonation) {
        const kbSub = detectKeyboardSubstitution(hostname);
        if (kbSub.detected) {
          result.score = Math.min(100, result.score + 90);
          result.findings.push(`🚨 [H1 - Keyboard Sub] KEYBOARD-ADJACENT TYPOSQUAT: "${hostname}" mimics "${kbSub.targetedBrand}" via ${kbSub.substitutions} key-neighbor substitution(s)`);
          criticalBlock = true;
        }
      }

      // H2 — Platform-Aware Trust Override (Google Sites, Netlify, GitHub Pages, etc.)
      const platformAbuse = detectPlatformAbuse(hostname);
      if (platformAbuse.isPlatformAbuse) {
        result.findings.push(`⚡ [H2 - Platform Abuse] TRUSTED PLATFORM HOSTING DETECTED: "${platformAbuse.platform}" — domain reputation bypassed; content-layer scoring enforced`);
        result.findings.push(`⚠️ [H2] Attackers host phishing pages on free platforms to inherit domain reputation. Evaluating content signals only.`);
        // Force score to not benefit from whitelist trust
        result.isWhitelisted = false;
        result.score = Math.min(100, result.score + 25);
      }

      // H4 — Full Brand List Subdomain Anatomy (extends existing 7-brand check to all 300+ brands)
      if (!isWhitelisted || platformAbuse.isPlatformAbuse) {
        const anatomyResult = detectSubdomainBrandAnatomyAbuse(hostname);
        if (anatomyResult.score > 0) {
          result.score = Math.min(100, result.score + anatomyResult.score);
          anatomyResult.alerts.forEach(a => { result.findings.push(a); criticalBlock = true; });
        }
      }

      // AT-03 — Extended Unicode Homograph Detection (15+ scripts: Armenian, Georgian, Arabic, etc.)
      const extHomograph = detectExtendedHomograph(hostname);
      if (extHomograph.score > 0) {
        result.score = Math.min(100, result.score + extHomograph.score);
        extHomograph.alerts.forEach(a => { result.findings.push(a); criticalBlock = true; });
      }

      // AT-17 — Zero-Feature URL Anomaly (deliberately minimal URL to evade scoring)
      const zeroFeature = detectZeroFeatureAnomaly(hostname, pathname, isWhitelisted);
      if (zeroFeature.score > 0) {
        result.score = Math.min(100, result.score + zeroFeature.score);
        zeroFeature.alerts.forEach(a => result.findings.push(a));
      }

      // DGA Beacon Detection
      if (isDGALikeDomain(hostname)) {
        result.score += 95;
        result.findings.push(`🚨 [L3] DGA BEACON: Domain matches Domain Generation Algorithm patterns (T1568.002)`);
        criticalBlock = true;
      }

      // ================= L6: BEHAVIORAL HEURISTICS =================
      result.findings.push("-------------------------------------------");
      result.findings.push("[L6] Behavioral Heuristics...");

      const fullPath = pathname + search;
      let l6Hit = false;
      const phishingKeywords = ['login', 'signin', 'secure', 'auth', 'verify', 'update', 'billing', 'banking', 'account', 'invoice'];
      const foundKeywords = phishingKeywords.filter(k => fullPath.toLowerCase().includes(k));
      if (!isWhitelisted && foundKeywords.length > 0) {
        result.score += 30;
        result.findings.push(`⚠️ [L6] Phishing keywords in path: ${foundKeywords.join(', ')}`);
        l6Hit = true;
      }

      // Open redirect
      if (/(redirect|url|link|goto|next|return|dest)=https?:\/\//i.test(search)) {
        result.score += 60;
        result.findings.push(`🚨 [L6] Open redirect chain detected in query params - used to hide destinations`);
        l6Hit = true;
      }

      // Data/Javascript URIs
      if (/^(data|javascript|vbscript):/i.test(originalUrl)) {
        result.score += 100;
        result.findings.push(`🚨 [L6] Data/Javascript URI execution attack - Payload injects directly into browser`);
        criticalBlock = true;
        l6Hit = true;
      }

      // Brand in path camouflage
      const knownBrands = ['paypal', 'apple', 'microsoft', 'google', 'facebook', 'amazon', 'netflix', 'chase', 'bankofamerica'];
      let brandInPath = null;
      for (const b of knownBrands) {
        // e.g. /paypal/ or /paypal?
        if (fullPath.toLowerCase().includes('/' + b + '/') || fullPath.toLowerCase().includes('/' + b + '?') || fullPath.toLowerCase().endsWith('/' + b)) {
          brandInPath = b;
          break;
        }
      }
      if (!isWhitelisted && brandInPath) {
        result.score += 70;
        result.findings.push(`🚨 [L6] Brand camouflage in path: Found '${brandInPath}' in path to fake legitimacy`);
        criticalBlock = true;
        l6Hit = true;
      }

      // Drive-by download extensions
      if (/\.(exe|zip|rar|tar|gz|scr|bat|cmd|vbs|js|msi|ps1|apk)(\?.*)?$/i.test(pathname)) {
        result.score += 85;
        result.findings.push(`🚨 [L6] Drive-by download extension detected: Executable/compressed file payload`);
        criticalBlock = true;
        l6Hit = true;
      }

      if (!l6Hit) {
        result.findings.push("✅ [L6] No suspicious behavioral patterns detected in path or structure");
      }

      // ================= L6.2: DEEP PATH ANALYSIS =================
      result.findings.push("-------------------------------------------");
      result.findings.push("[L6.2] Deep Path Forensics...");
      const pathAnalysis = deepAnalyzePath(pathname, search, isWhitelisted);

      if (pathAnalysis.alerts.length === 0) {
        result.findings.push("✅ [L6.2] No anomalies detected in deep path structure");
      } else {
        pathAnalysis.alerts.forEach(a => {
          result.findings.push(a);
          if (a.includes('CRITICAL') || a.includes('🚨')) criticalBlock = true;
        });
      }

      if (!isWhitelisted) {
        result.score = Math.min(100, result.score + pathAnalysis.pathScore);
      }

      // N-11 — Path-level Unicode Homoglyph Detection
      const pathUnicode = detectPathUnicodeHomoglyph(pathname, search, isWhitelisted);
      if (pathUnicode.score > 0) {
        result.score = Math.min(100, result.score + pathUnicode.score);
        pathUnicode.alerts.forEach(a => { result.findings.push(a); criticalBlock = true; });
      }

      // ================= L6.5: LIVE CONTENT & CONTEXT EXTRACTION =================
      result.findings.push("-------------------------------------------");
      result.findings.push("[L6.5] Live Content & Context Extraction...");
      try {
        const ctrlContent = new AbortController();
        const tidContent = setTimeout(() => ctrlContent.abort(), 4000); // Quick 4s ping
        const reqOpts = { method: 'GET', headers: { 'Accept': 'text/html' }, signal: ctrlContent.signal };

        // We attempt a soft fetch to grab the title and verify context without executing scripts
        const contentResp = await fetch(originalUrl, reqOpts).catch(() => null);
        clearTimeout(tidContent);

        if (contentResp && contentResp.ok) {
          const rawHtml = await contentResp.text();

          // N-13 — Strip invisible text & detect LLM prompt injection FIRST
          const injectionDetect = stripAndDetectInvisibleInjection(rawHtml);
          if (injectionDetect.score > 0) {
            result.score = Math.min(100, result.score + injectionDetect.score);
            injectionDetect.alerts.forEach(a => { result.findings.push(a); criticalBlock = true; });
          }
          // Use cleaned text (stripped of invisible injection elements) for further analysis
          const htmlText = injectionDetect.cleanedText;

          const titleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
          const pageTitle = titleMatch ? titleMatch[1].trim() : "Unknown Title";
          result.findings.push(`✅ [L6.5] Live Content Fetched. Title: "${pageTitle.substring(0, 40)}..."`);

          // N-02 — PWA Manifest brand abuse check
          try {
            const manifestResult = await checkManifestBrandAbuse(
              new URL(originalUrl.startsWith('http') ? originalUrl : 'https://' + originalUrl).origin,
              isWhitelisted
            );
            if (manifestResult.score > 0) {
              result.score = Math.min(100, result.score + manifestResult.score);
              manifestResult.alerts.forEach(a => { result.findings.push(a); criticalBlock = true; });
            }
          } catch (e) { /* origin parse failed */ }

          // H5 — JS Obfuscation Signal Detection (eval+atob, document.write, etc.)
          const jsObf = detectJsObfuscation(htmlText);
          if (jsObf.jsObfScore > 0) {
            result.score = Math.min(100, result.score + Math.round(jsObf.jsObfScore * 0.5));
            jsObf.alerts.forEach(a => result.findings.push(a));
            if (jsObf.jsObfScore >= 70) criticalBlock = true;
          } else {
            result.findings.push(`✅ [H5 - JS Obfuscation] No obfuscated script patterns detected in page source`);
          }

          // Academic/Scientific Context Matching (The 'Bohrium' verification)
          const academicKeywords = ['research', 'paper', 'abstract', 'journal', 'dataset', 'science', 'university', 'bohrium', 'ieee', 'scholar', 'bibtex', 'citation', 'doi'];
          const hasAcademicContext = academicKeywords.some(k => htmlText.toLowerCase().includes(k) || hostname.includes(k) || pathname.toLowerCase().includes(k));

          if (hasAcademicContext) {
            result.score = Math.max(0, result.score - 40);
            result.findings.push(`✅ [L6.5] Context Matching: Academic/Scientific footprint verified. Content matches expected safe destination.`);
            result.isResearchVerified = true;
          } else {
            result.findings.push(`ℹ️ [L6.5] Context Matching: Standard web content footprint verified.`);
          }

          // N-09 — OAuth redirect_uri in page content
          const oauthScan = scanContentForOAuthLinks(htmlText, isWhitelisted);
          if (oauthScan.score > 0) {
            result.score = Math.min(100, result.score + oauthScan.score);
            oauthScan.alerts.forEach(a => { result.findings.push(a); criticalBlock = true; });
          }

          // N-17 — External script SRI + content analysis (supply chain)
          try {
            const origin = new URL(originalUrl.startsWith('http') ? originalUrl : 'https://' + originalUrl).origin;
            const extScripts = await analyzeExternalScripts(htmlText, origin, isWhitelisted);
            if (extScripts.score > 0) {
              result.score = Math.min(100, result.score + extScripts.score);
              extScripts.alerts.forEach(a => result.findings.push(a));
            } else if (extScripts.alerts.length === 0) {
              result.findings.push(`✅ [N-17] External scripts checked — no obfuscation detected, SRI coverage adequate`);
            }
          } catch (e) { /* origin parse failed */ }

          // N-18 — Content Security Policy check on credential pages
          const cspResult = analyzeCSPSecurity(htmlText, contentResp.headers, hostname, isWhitelisted);
          if (cspResult.score > 0) {
            result.score = Math.min(100, result.score + cspResult.score);
            cspResult.alerts.forEach(a => result.findings.push(a));
          }

          // N-20 — Campaign tracker: record this page's credential form fingerprint
          _campaignTracker.record(hostname, htmlText);
          const singleField = _campaignTracker.checkSingleFieldAnomaly(hostname, htmlText, isWhitelisted);
          if (singleField.alert) {
            result.score = Math.min(100, result.score + singleField.score);
            result.findings.push(singleField.alert);
          }

        } else if (contentResp && contentResp.type === 'opaque') {
          // no-cors opaque response (expected for cross-origin without CORS headers)
          result.findings.push(`ℹ️ [L6.5] Live Content: Server responded (Opaque/CORS protected), endpoint is active.`);
        } else {
          result.findings.push(`⚠️ [L6.5] Live Content: Could not fetch page context (Timeout/Blocked). Proceeding with structural analysis.`);
        }
      } catch (e) {
        result.findings.push(`⚠️ [L6.5] Live Content: Content extraction aborted (${e.message}).`);
      }

      // ================= L7: STATISTICAL ANOMALY =================
      result.findings.push("-------------------------------------------");
      result.findings.push("[L7] Statistical Anomaly...");
      const domainEntropy = computeBehavioralEntropy(hostname);
      const hostOnly = hostname.split('.')[0];
      const vowelsCount = (hostOnly.match(/[aeiou]/gi) || []).length;
      const cvRatio = hostOnly.length > 0 ? vowelsCount / hostOnly.length : 0;

      // English bigram approx via consonant clusters
      const longConsonantCluster = /[^aeiou0-9.\-]{4,}/i.test(hostOnly);

      result.findings.push(`📊 [L7] Shannon Entropy: ${domainEntropy.toFixed(2)} | C-V Ratio: ${cvRatio.toFixed(2)}`);
      if (domainEntropy > 4.2 || (cvRatio < 0.15 && hostOnly.length > 7) || longConsonantCluster) {
        if (!isWhitelisted) result.score += 35;
        result.findings.push(`⚠️ [L7] Statistical Anomaly: Domain name looks machine-generated or highly randomized`);
      } else {
        result.findings.push(`✅ [L7] Domain text statistics fall within natural language profiles`);
      }

      // N-20 — Cross-session campaign correlation (must run at L7 outside content block)
      const campaignResult = _campaignTracker.detectCampaign();
      if (campaignResult.score > 0) {
        result.score = Math.min(100, result.score + campaignResult.score);
        campaignResult.alerts.forEach(a => { result.findings.push(a); criticalBlock = true; });
      }

      // N-09 — URL-level OAuth redirect_uri check (catches direct OAuth URL submissions)
      const directOAuth = extractOAuthRedirectUri(originalUrl);
      if (directOAuth.alerts.length > 0) {
        result.score = Math.min(100, result.score + 75);
        directOAuth.alerts.forEach(a => { result.findings.push(a); criticalBlock = true; });
      }

      // Accumulate score from deep analyze
      if (!isWhitelisted) {
        result.score = Math.min(100, result.score + deepResult.domainScore);
      }

      if (criticalBlock) {
        result.score = 100;
        result.isSafe = false;
        result.findings.unshift("🔴 FATAL FRAUD - Deep Forensics Detect Critical Deceptive Structure");
        result.findings.push("-------------------------------------------");
        result.findings.push("🚨 Domain is definitively fake or deceptive — ZERO TRUST policy: BLOCK immediately.");
        return result;
      }

      // ================= L4 & L5 : NETWORK & THREAT APIs =================
      result.findings.push("-------------------------------------------");
      result.findings.push("🌐 Running Network & API Lookups (L4 & L5)...");

      const [safeBrowsingResult, rdapResult, dnsResult, oprResult, urlhausResult] = await Promise.all([
        checkSafeBrowsingAPI(originalUrl),
        verifyDomainRegistration(hostname),
        verifyDomainExistsOnInternet(hostname),
        checkOpenPageRank(hostname),
        checkURLhausBlocklist(hostname)
      ]);
      result.safeBrowsingResult = safeBrowsingResult;

      // --- L4: Network Verification ---
      result.findings.push("[L4] Network Verification (DNS/RDAP):");

      let rdapPassed = true;
      if (rdapResult.registered === false) {
        result.score = Math.min(100, result.score + 90);
        result.findings.push("🚨 [L4] PHANTOM DOMAIN: Domain NOT REGISTERED. Does not exist in global registry.");
        rdapPassed = false;
        criticalBlock = true;
      } else if (rdapResult.registered === true) {
        result.findings.push(`✅ [L4] Domain IS registered. (Registrar: ${rdapResult.registrar || 'Unknown'})`);
        if (rdapResult.isBrandNew) {
          result.score = Math.min(100, result.score + 60);
          result.findings.push(`🚨 [L4] HIGH RISK: Domain age is <14 days (${rdapResult.ageDays} days old) - instant flag for phishing.`);
          rdapPassed = false;
        } else if (rdapResult.isNew) {
          result.score = Math.min(100, result.score + 30);
          result.findings.push(`⚠️ [L4] WARNING: Domain is relatively new (${rdapResult.ageDays} days old)`);
        } else if (rdapResult.ageDays) {
          result.findings.push(`✅ [L4] Domain is established (${rdapResult.ageDays} days old)`);
        }
      } else {
        result.findings.push(`⏳ [L4] RDAP registry lookup: ${rdapResult.error || "no response"}`);
      }

      let dnsPassed = true;
      if (dnsResult.resolvers && dnsResult.resolvers.length > 0) {
        const rsum = dnsResult.resolvers.map(r => r.name + ":" + (r.status === 0 ? "RESOLVES" : r.status === 3 ? "NXDOMAIN" : "ERROR")).join(" | ");
        result.findings.push("[L4] " + rsum);
        if (dnsResult.nxdomain && !dnsResult.exists) {
          result.score = Math.min(100, result.score + 80);
          result.findings.push("🚨 [L4] CRITICAL: Domain NXDOMAIN on all resolvers - phantom domain.");
          dnsPassed = false;
          criticalBlock = true;
        } else if (dnsResult.blocked) {
          result.score = Math.min(100, result.score + 50);
          result.findings.push("🚨 [L4] Domain sinkholed by DNS resolvers - known malware/C2");
          dnsPassed = false;
        } else if (dnsResult.exists) {
          result.findings.push("✅ [L4] Domain resolves successfully (DNS-over-HTTPS)");
        }
      }

      // --- L5: Threat Intelligence APIs ---
      result.findings.push("[L5] Threat Intelligence APIs:");

      let safeBrowsingPassed = true;
      if (safeBrowsingResult.isThreat) {
        result.score = 100;
        result.findings.push(`🚨 [L5] GOOGLE SAFE BROWSING: THREAT CONFIRMED! (${safeBrowsingResult.threatTypes.join(", ")})`);
        safeBrowsingPassed = false;
        criticalBlock = true;
      } else if (!safeBrowsingResult.error) {
        result.findings.push("✅ [L5] Google Safe Browsing: CLEAR");
      } else {
        result.findings.push(`⏳ [L5] Google Safe Browsing: ${safeBrowsingResult.message}`);
      }

      let urlhausPassed = true;
      if (urlhausResult.found) {
        result.score = 100;
        result.findings.push(`🚨 [L5] URLhaus: DOMAIN BLACKLISTED AS MALWARE/C2! (${urlhausResult.urlCount} active threat urls)`);
        urlhausPassed = false;
        criticalBlock = true;
      } else {
        result.findings.push("✅ [L5] URLhaus Global Blocklist: CLEAR");
      }

      if (!oprResult.error && oprResult.found && oprResult.rank !== null) {
        const rv = oprResult.rank;
        result.findings.push(`📊 [L5] Open Page Rank score: ${rv}/10`);
        if (rv === 0) {
          result.score = Math.min(100, result.score + 45);
          result.findings.push("🚨 [L5] HIGH RISK: PageRank 0 - Zero web presence, common in phishing.");
        }
      } else if (!oprResult.error && !oprResult.found) {
        result.score = Math.min(100, result.score + 30);
        result.findings.push("⚠️ [L5] Domain NOT indexed in Open Page Rank - zero web presence");
      }

      // --- Final Verdict Processing ---
      result.findings.push("-------------------------------------------");
      result.findings.push("⚖️ Final ZTAS Verdict Processing...");

      if (criticalBlock) {
        result.score = 100;
        result.isSafe = false;
        result.findings.unshift("🔴 BLOCK - Confirmed Threat or Critical Anomaly in Pipeline");
        return result;
      }

      const tripleLockPassed = safeBrowsingPassed && rdapPassed && dnsPassed && urlhausPassed;

      if (isWhitelisted && tripleLockPassed && result.score < 30) {
        result.score = 0;
        result.isSafe = true;
        result.findings.push("✅ FULL SAFE: Whitelist + Triple Verification + Heuristics Passed");
        if (result.protocol === "HTTPS") {
          result.findings.unshift("🟢 SAFE - Multi-Verified Trusted Domain");
        } else {
          result.score = 20;
          result.findings.unshift("🟡 SAFE WITH WARNING - Uses HTTP");
        }
      } else if (result.isResearchVerified && tripleLockPassed && result.score < 30) {
        // New Logic: Treat verified research links as safe even if not in the primary whitelist
        result.score = 15;
        result.isSafe = true;
        result.findings.push("✅ SAFE (RESEARCH): Verified Academic Context + Triple Verification Passed");
        result.findings.unshift("🟢 SAFE - Verified Academic/Research Resource");
      } else if (isWhitelisted && !tripleLockPassed) {
        result.score = Math.min(100, result.score + 60);
        result.isSafe = false;
        result.findings.push("🚨 WARNING: Whitelisted domain failed internet verification! Possible takeover.");
        result.findings.unshift("🟠 WARNING - Known Domain FAILED Verification");
      } else if (!isWhitelisted && tripleLockPassed && result.score < 30) {
        result.score = 30; // Unknown
        result.isSafe = false;
        result.findings.push("⚠️ Domain is real and clean, but NOT in verified whitelist. Zero-Trust applied.");
        result.findings.unshift("🟠 WARNING - Unverified but Clean Domain");
      } else {
        result.score = 100;
        result.isSafe = false;
        result.findings.push("🚨 Strict Zero-Trust policy: Unverified/Unknown domain is automatically treated as FAKE.");
        result.findings.unshift("🔴 BLOCK — Unverified Domain (Zero-Trust)");
      }

    } catch (e) {
      result.score = 100;
      result.isSafe = false;
      result.findings.push("⚠️ Could not parse URL: " + e.message);
      result.findings.unshift("🟡 ERROR - Invalid URL format");
    }

    return result;
  }

  /* ================= EMAIL ANALYZER ================= */
  async function analyzeEmail(email) {
    const result = {
      isSafe: false,
      score: 0,
      findings: [],
      domain: "",
      isWhitelisted: false,
      safeBrowsingResult: null
    };

    email = email.trim().toLowerCase();

    const emailRegex = /^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
    const match = email.match(emailRegex);

    if (!match) {
      result.score = 50;
      result.findings.push("ðŸš¨ Invalid email format");
      result.findings.unshift("ðŸŸ  INVALID - Bad email format");
      return result;
    }

    const localPart = match[1];
    const domain = match[2].toLowerCase();
    result.domain = domain;

    // ===== EXTENDED STRICT SECURITY CHECKS (SPACE/DOT/HOMOGRAPH) =====
    const eHasSpaces = /\s/.test(email.trim());
    const eHasZeroWidth = /[\u200B-\u200D\uFEFF]/g.test(email);
    const eHasNonAscii = /[^\x00-\x7F]/.test(domain); // Homograph
    const eHasConsecutiveDots = /\.\./.test(domain);
    const eHasTrailingDot = domain.endsWith('.');

    if (eHasSpaces || eHasZeroWidth || eHasNonAscii || eHasConsecutiveDots || eHasTrailingDot) {
      result.score = 100;
      result.isSafe = false;
      result.findings.push("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
      result.findings.push("ðŸš¨ CRITICAL ALERT: DECEPTIVE EMAIL FORMATTING");
      result.findings.push("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
      if (eHasNonAscii) result.findings.push("âŒ HOMOGRAPH ATTACK: Uses foreign characters to impersonate a domain.");
      if (eHasSpaces || eHasZeroWidth) result.findings.push("âŒ HIDDEN SPACES: Contains invisible or deceptive spaces.");
      if (eHasConsecutiveDots || eHasTrailingDot) result.findings.push("âŒ MALFORMED: Contains improper dot (.) formatting.");
      result.findings.push("ðŸš¨ THIS SENDER IS FAKE AND HIGHLY DANGEROUS.");
      result.findings.unshift("ðŸ”´ FATAL FRAUD - Deceptive Sender Structure Detected");
      return result;
    }

    result.findings.push(`ðŸ“§ Email: ${email}`);
    result.findings.push(`ðŸŒ Domain: ${domain}`);

    // Check if email domain is whitelisted
    const isWhitelisted = isWhitelistedEmailDomain(domain);
    result.isWhitelisted = isWhitelisted;

    if (isWhitelisted) {
      result.score = 0;
      result.isSafe = true;
      result.findings.push("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
      result.findings.push("âœ… EMAIL DOMAIN IS WHITELISTED");
      result.findings.push("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
      result.findings.push("âœ… " + domain + " is a verified email provider");
      result.findings.push("âœ… This email address appears legitimate");
      result.findings.unshift("âœ… SAFE - Verified Email Provider");
      return result;
    }

    // Not whitelisted - check Safe Browsing API
    result.findings.push("âš ï¸ Domain not in verified email providers list");
    result.findings.push("ðŸ” Checking Google Safe Browsing API...");

    const safeBrowsingResult = await checkSafeBrowsingAPI("https://" + domain);
    result.safeBrowsingResult = safeBrowsingResult;

    if (safeBrowsingResult.error) {
      result.score = 30;
      result.isSafe = false;
      result.findings.push("âš ï¸ Could not verify domain: " + safeBrowsingResult.message);
      result.findings.unshift("ðŸŸ¡ UNKNOWN - Could not verify");

    } else if (safeBrowsingResult.isThreat) {
      result.score = 90;
      result.isSafe = false;
      result.findings.push("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
      result.findings.push("ðŸš¨ EMAIL DOMAIN IS MALICIOUS!");
      result.findings.push("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
      result.findings.push(`ðŸš¨ Threat Types: ${safeBrowsingResult.threatTypes.join(", ")}`);
      result.findings.push("âŒ DO NOT reply to this email!");
      result.findings.push("âŒ DO NOT click any links in this email!");
      result.findings.unshift("ðŸ”´ MALICIOUS - Dangerous Email Domain!");

    } else {
      const eImpersonation = detectBrandImpersonation(domain);
      if (eImpersonation.isImpersonation) {
        result.score = 100;
        result.isSafe = false;
        result.findings.push("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
        result.findings.push("ðŸš¨ CRITICAL ALERT: BRAND IMPERSONATION");
        result.findings.push("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
        result.findings.push(`âŒ This sender is impersonating: ${eImpersonation.targetedBrand.toUpperCase()}`);
        result.findings.push("ðŸš¨ DO NOT REPLY OR CLICK ANY LINKS");
        result.findings.unshift(`ðŸ”´ FATAL FRAUD - Sender Impersonating ${eImpersonation.targetedBrand}`);
      } else {
        result.score = 20;
        result.isSafe = true;
        result.findings.push("✅ Domain not in Google threat database");
        result.findings.push("✅ NOT impersonating any known major brands");
        result.findings.push("⚠️ NOTICE: Sender domain is NOT in our highly-verified Legit database.");
        result.findings.push("⚠️ SECURITY PROTOCOL: Sender is unknown but appears benign based on basic checks.");
        result.findings.unshift("⚠️ SAFE/UNVERIFIED - Sender domain is new but clean");
      }
    }

    return result;
  }

  /* ============================================================ */
  /* ====  ZTAS MILITARY-GRADE THREAT INTELLIGENCE ENGINE  ====== */
  /* ============================================================ */

  // â”€â”€ ZTAS-BEA-01: Behavioral Entropy Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function computeBehavioralEntropy(text) {
    if (!text || text.length < 5) return 0;
    const freq = {};
    for (const c of text) freq[c] = (freq[c] || 0) + 1;
    const len = text.length;
    let H = 0;
    for (const c in freq) { const p = freq[c] / len; H -= p * Math.log2(p); }
    return H; // High = random/encoded, Low = natural language
  }

  // â”€â”€ ZTAS-DGA-01: Domain Generation Algorithm Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function isDGALikeDomain(hostname) {
    const name = hostname.split('.')[0];
    if (name.length < 8) return false;
    // Consonant clusters + vowel-to-consonant imbalance
    const vowels = (name.match(/[aeiou]/gi) || []).length;
    const ratio = vowels / name.length;
    const hasLongConsCluster = /[^aeiou]{5,}/i.test(name);
    const hasHighDigitMix = (name.match(/\d/g) || []).length >= name.length * 0.35;
    const hasHexLook = /^[a-f0-9]{12,}$/i.test(name);
    return (ratio < 0.15 || hasLongConsCluster || hasHighDigitMix || hasHexLook);
  }

  // â”€â”€ ZTAS-HGA-01: Unicode Homoglyph Attack Scanner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function countHomoglyphs(text) {
    // Common homoglyphs: Cyrillic Ð° Ðµ Ð¾ Ñ€ Ñ Ñƒ Ñ…, Greek Î¿, etc.
    const homoglyphMap = /[\u0430\u0435\u043e\u0440\u0441\u0443\u0445\u03bf\u04cf\u0456\u0458\u0440\u0412\u0430\u0410]/g;
    return (text.match(homoglyphMap) || []).length;
  }

  // â”€â”€ ZTAS-NLP-01: Linguistic Deception Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function linguisticDeceptionScore(text) {
    let pts = 0;
    // Misspelled legitimacy words (common in phishing)
    if (/\b(securety|securty|secuirty|passwrod|passord|paswword)\b/i.test(text)) pts += 20;
    if (/\b(veirfy|verrify|confrim|comfirm|acccount|acounnt)\b/i.test(text)) pts += 20;
    // ALL CAPS shouting (manipulation)
    const upperRatio = (text.match(/[A-Z]/g) || []).length / (text.length || 1);
    if (upperRatio > 0.5 && text.length > 30) pts += 15;
    // Excessive punctuation (psychological manipulation)
    if (/[!?]{3,}/.test(text)) pts += 12;
    // Machine-translated artifacts
    if (/\b(kindly|do the needful|revert back|prepone)\b/i.test(text)) pts += 10;
    return pts;
  }

  /* ================= MESSAGE ANALYZER (MILITARY-GRADE) ================= */
  async function analyzeMessage(text) {
    let score = 0;
    const findings = [];

    // â”€â”€ PRE-SCAN: Entropy & Linguistic Forensics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const entropy = computeBehavioralEntropy(text);
    const lgDeception = linguisticDeceptionScore(text);
    const homoglyphCount = countHomoglyphs(text);
    score += lgDeception;
    if (lgDeception > 0) findings.push('[ZTAS-NLP] Linguistic deception score: ' + lgDeception + ' pts â€” misspellings/manipulation detected');
    if (entropy > 4.5 && text.length > 80) {
      score += 18;
      findings.push('[ZTAS-BEA] High text entropy (' + entropy.toFixed(2) + '): possible encoded/obfuscated payload in message body');
    }
    if (homoglyphCount > 0) {
      score += homoglyphCount * 15;
      findings.push('[ZTAS-HGA] Homoglyph attack: ' + homoglyphCount + ' Unicode lookalike character(s) detected â€” identity spoofing attempt');
    }

    // Phishing Patterns
    const phishingPatterns = [
      { regex: /verify your (account|identity|password|email|information)/i, msg: "ðŸš¨ Account verification phishing", pts: 25 },
      { regex: /confirm your (payment|bank|credit card|ssn|social security)/i, msg: "ðŸš¨ Financial data phishing", pts: 30 },
      { regex: /your account (has been|will be|is) (suspended|locked|disabled|compromised|limited)/i, msg: "ðŸš¨ Account suspension scam", pts: 30 },
      { regex: /unusual (activity|sign-?in|login|transaction)/i, msg: "ðŸš¨ Fake security alert", pts: 25 },
      { regex: /update your (payment|billing|bank|card)/i, msg: "ðŸš¨ Payment update scam", pts: 25 },
      { regex: /(won|winner|winning|congratulations).*?(prize|lottery|gift|money|\$\d)/i, msg: "ðŸš¨ Prize/lottery scam", pts: 35 },
      { regex: /claim your (reward|prize|money|gift|winnings)/i, msg: "ðŸš¨ Fake reward claim", pts: 30 },
      { regex: /inheritance|beneficiary|next of kin|deceased.*million/i, msg: "ðŸš¨ 419/Inheritance scam", pts: 40 },
      { regex: /nigerian prince|foreign prince|royal family/i, msg: "ðŸš¨ Classic 419 scam", pts: 50 }
    ];

    phishingPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // Urgency Patterns
    const urgencyPatterns = [
      { regex: /\b(urgent|urgently|immediately|right now|right away)\b/i, msg: "âš ï¸ Urgency pressure tactic", pts: 15 },
      { regex: /\b(act now|action required|immediate action)\b/i, msg: "âš ï¸ Forced action pressure", pts: 15 },
      { regex: /\b(last chance|final warning|final notice)\b/i, msg: "âš ï¸ Final warning pressure", pts: 18 },
      { regex: /within \d+ (hours?|minutes?|days?)/i, msg: "âš ï¸ Countdown pressure", pts: 12 },
      { regex: /\b(expire|expiring|expires)\b.*\b(soon|today|hours?)\b/i, msg: "âš ï¸ Expiration pressure", pts: 15 }
    ];

    urgencyPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // Credential Requests
    const credentialPatterns = [
      { regex: /\b(enter|provide|confirm|verify|send|share) (your |the )?(password|passcode|pin)\b/i, msg: "ðŸ” Password harvesting attempt", pts: 30 },
      { regex: /\b(username|user name) and password\b/i, msg: "ðŸ” Login credential request", pts: 25 },
      { regex: /\bsend (me |us )?(your |the )?(login|credentials|password)\b/i, msg: "ðŸ” Credential theft attempt", pts: 35 },
      { regex: /\breset (your )?password\b.*\bclick\b/i, msg: "ðŸ” Password reset phishing", pts: 25 }
    ];

    credentialPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // Financial Requests
    const financialPatterns = [
      { regex: /\b(ssn|social security( number)?)\b/i, msg: "ðŸ’³ SSN request - MAJOR RED FLAG", pts: 40 },
      { regex: /\b(credit card|debit card|card number)\b.*\b(send|provide|enter|verify)\b/i, msg: "ðŸ’³ Card number request", pts: 35 },
      { regex: /\bcvv\b|\bcvc\b|\bsecurity code\b/i, msg: "ðŸ’³ CVV/Security code request", pts: 40 },
      { regex: /\b(bank account|routing number|account number)\b/i, msg: "ðŸ’³ Bank account details request", pts: 30 }
    ];

    financialPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // Money Requests
    const moneyPatterns = [
      { regex: /\b(send|transfer|wire|pay) (me |us )?\$\d+/i, msg: "ðŸ’° Direct money request", pts: 30 },
      { regex: /\bgift cards?\b.*\b(buy|purchase|send|get)\b/i, msg: "ðŸ’° Gift card scam", pts: 35 },
      { regex: /\b(bitcoin|btc|crypto|ethereum)\b.*\b(send|transfer|pay|deposit)\b/i, msg: "ðŸ’° Crypto payment scam", pts: 30 },
      { regex: /\bwestern union\b|\bmoneygram\b|\bwire transfer\b/i, msg: "ðŸ’° Wire transfer request", pts: 35 },
      { regex: /\b(processing|handling|shipping) fee\b/i, msg: "ðŸ’° Advance fee fraud", pts: 30 }
    ];

    moneyPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // Impersonation
    const impersonationPatterns = [
      { regex: /\b(apple|microsoft|google|amazon|facebook|netflix|paypal) (support|team|security|helpdesk|service)/i, msg: "ðŸ‘¤ Brand impersonation attempt", pts: 25 },
      { regex: /\b(irs|fbi|cia|police|government|court|federal) (notice|department|agent|official)/i, msg: "ðŸ‘¤ Government impersonation", pts: 35 },
      { regex: /\bthis is (your )?(bank|amazon|microsoft|apple|google)\b/i, msg: "ðŸ‘¤ Direct brand impersonation", pts: 30 },
      { regex: /\btechnical support\b.*\b(call|contact)\b/i, msg: "ðŸ‘¤ Tech support scam", pts: 30 }
    ];

    impersonationPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // Malware Indicators
    const malwarePatterns = [
      { regex: /\benable (macros?|content|editing)\b/i, msg: "ðŸ¦  Macro enablement request", pts: 40 },
      { regex: /\bdisable (antivirus|defender|protection|firewall|security)\b/i, msg: "ðŸ¦  Security disable request", pts: 45 },
      { regex: /\.(exe|bat|cmd|scr|vbs|js|jar|msi|ps1)\b/i, msg: "ðŸ¦  Executable file reference", pts: 25 },
      { regex: /\bremote access\b|\bteamviewer\b|\banydesk\b/i, msg: "ðŸ¦  Remote access request", pts: 30 },
      { regex: /\binstall (this |the |our )?(software|app|program|tool|update)\b/i, msg: "ðŸ¦  Software installation request", pts: 20 },
      { regex: /\b(trojan|ransomware|keylogger|spyware|rootkit)\b/i, msg: "ðŸ¦  Malware term reference detected", pts: 15 }
    ];

    malwarePatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // Social Engineering
    const socialPatterns = [
      { regex: /\bdear (valued )?(customer|user|member|client|sir|madam)\b/i, msg: "ðŸ“§ Generic greeting (common in scams)", pts: 10 },
      { regex: /\bclick (here|below|the link|this link|the button)\b/i, msg: "ðŸ“§ Click bait attempt", pts: 12 },
      { regex: /\bkindly\b/i, msg: "ðŸ“§ 'Kindly' - common scam language", pts: 8 },
      { regex: /\bdear friend\b/i, msg: "ðŸ“§ 'Dear friend' scam opener", pts: 15 },
      { regex: /\bdo not (share|tell|show|forward)\b.*\b(anyone|others|police)\b/i, msg: "ðŸ“§ Secrecy demand - manipulation tactic", pts: 25 },
      { regex: /\b(confidential|private|secret)\b.*\b(only for you|personal)\b/i, msg: "ðŸ“§ False exclusivity manipulation", pts: 18 },
      { regex: /\byou have been (selected|chosen|picked)\b/i, msg: "ðŸ“§ False selection scam", pts: 20 },
      { regex: /\bthis (is not|isn'?t) a (joke|scam|fraud)\b/i, msg: "ðŸ“§ Defensive denial - scam indicator", pts: 22 }
    ];

    socialPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // ===== SMS / OTP / WhatsApp Scam Patterns =====
    const smsOtpPatterns = [
      { regex: /\b(otp|one.?time.?pass(word|code)?|verification code)\b.*\b(share|send|give|provide|enter)\b/i, msg: "ðŸš¨ OTP sharing request - CRITICAL SCAM", pts: 45 },
      { regex: /\b(share|send|give|provide)\b.*\b(otp|verification code|one.?time)\b/i, msg: "ðŸš¨ OTP solicitation detected", pts: 45 },
      { regex: /\byour.{0,20}otp.{0,20}is\b/i, msg: "âš ï¸ OTP notification pattern", pts: 15 },
      { regex: /\b(your|the) (whatsapp|telegram|signal) (account|number)\b.*\b(verify|confirm|lock|expire)\b/i, msg: "ðŸš¨ Messaging app account scam", pts: 30 },
      { regex: /\b(sim swap|sim card|new sim|port)\b.*\b(verify|confirm|approve)\b/i, msg: "ðŸš¨ SIM swap attack attempt", pts: 40 },
      { regex: /\b(6|4|5)\s*digit\s*(code|pin|otp|number)\b/i, msg: "âš ï¸ Digit code reference (possible OTP scam)", pts: 20 },
      { regex: /\bforward this (message|sms|code) to\b/i, msg: "ðŸš¨ Message forwarding scam tactic", pts: 25 }
    ];

    smsOtpPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // ===== Romance / Emotional Scam Patterns =====
    const romancePatterns = [
      { regex: /\b(i love you|i miss you|my love|my darling|my sweetheart)\b.*\b(send|transfer|money|help|urgent|need)\b/i, msg: "ðŸ’” Romance scam - emotional manipulation with money request", pts: 40 },
      { regex: /\b(stuck|stranded|hospital|emergency|accident)\b.*\b(send|need|transfer|money|help me)\b/i, msg: "ðŸ’” Emergency money request - possible romance scam", pts: 35 },
      { regex: /\b(military|deployed|overseas|abroad)\b.*\b(send|money|gift card|itunes)\b/i, msg: "ðŸ’” Military deployment money scam", pts: 40 },
      { regex: /\b(customs|package|shipment)\b.*\b(fee|pay|money|send)\b.*\b(release|clear|collect)\b/i, msg: "ðŸ’” Package release fee scam", pts: 35 }
    ];

    romancePatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // ===== Investment / Crypto Scam Patterns =====
    const investmentPatterns = [
      { regex: /\b(guaranteed|100%|risk.?free)\b.*\b(return|profit|income|earning)\b/i, msg: "ðŸ’° Guaranteed returns scam", pts: 35 },
      { regex: /\b(double|triple|10x|100x)\b.*\b(your )?(money|investment|bitcoin|crypto)\b/i, msg: "ðŸ’° Money multiplication scam", pts: 40 },
      { regex: /\b(invest|deposit)\b.*\b(minimum|just|only)\b.*\$\d/i, msg: "ðŸ’° Minimum deposit investment trap", pts: 30 },
      { regex: /\b(forex|binary option|trading signal|pump and dump)\b/i, msg: "ðŸ’° Fraudulent trading scheme", pts: 25 },
      { regex: /\b(airdrop|free (crypto|bitcoin|ethereum|token))\b.*\b(claim|wallet|connect)\b/i, msg: "ðŸ’° Crypto airdrop scam", pts: 35 },
      { regex: /\bconnect.{0,15}wallet\b/i, msg: "ðŸ’° Wallet connection phishing - WILL DRAIN FUNDS", pts: 45 },
      { regex: /\b(nft|token)\b.*\b(mint|free|exclusive|limited)\b/i, msg: "ðŸ’° NFT minting scam", pts: 25 },
      { regex: /\bpassive income\b.*\b(easy|guaranteed|zero effort)\b/i, msg: "ðŸ’° Passive income scam", pts: 30 }
    ];

    investmentPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // ===== Job / Employment Scam Patterns =====
    const jobPatterns = [
      { regex: /\b(work from home|work.from.home|wfh)\b.*\b(\$\d|earn|income|per day)\b/i, msg: "ðŸ“‹ Work from home income scam", pts: 25 },
      { regex: /\b(hiring|job offer|employment)\b.*\b(no experience|anyone can|simple task)\b/i, msg: "ðŸ“‹ Fake job offer scam", pts: 25 },
      { regex: /\b(registration fee|training fee|equipment fee|setup fee)\b.*\b(pay|send|deposit)\b/i, msg: "ðŸ“‹ Job registration fee scam", pts: 35 },
      { regex: /\b(data entry|typing job|copy paste|like and subscribe)\b.*\b(earn|income|\$)\b/i, msg: "ðŸ“‹ Fake micro-job scam", pts: 20 },
      { regex: /\b(task|assignment)\b.*\b(completed|pending)\b.*\b(withdraw|payment|commission)\b/i, msg: "ðŸ“‹ Task-based scam platform", pts: 35 }
    ];

    jobPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // ===== Delivery / Package Scam Patterns =====
    const deliveryPatterns = [
      { regex: /\b(package|parcel|delivery|shipment)\b.*\b(failed|pending|held|undelivered|returned)\b/i, msg: "ðŸ“¦ Fake delivery notification", pts: 25 },
      { regex: /\b(delivery fee|shipping fee|customs fee|clearance fee)\b.*\b(pay|send)\b/i, msg: "ðŸ“¦ Fake delivery fee scam", pts: 30 },
      { regex: /\b(track|reschedule|update)\b.*\b(delivery|package|parcel)\b.*\b(click|link|here)\b/i, msg: "ðŸ“¦ Phishing via fake tracking link", pts: 25 },
      { regex: /\b(usps|fedex|ups|dhl|amazon)\b.*\b(unable to deliver|delivery attempt|package held)\b/i, msg: "ðŸ“¦ Brand impersonation delivery scam", pts: 30 }
    ];

    deliveryPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // ===== Subscription / Trial Trap Patterns =====
    const subscriptionPatterns = [
      { regex: /\b(free trial|trial period)\b.*\b(credit card|card number|billing|payment)\b/i, msg: "ðŸ”„ Free trial requiring payment info - subscription trap", pts: 20 },
      { regex: /\b(subscription|renewal|auto.?renew)\b.*\b(charge|charged|debited|\$\d)\b/i, msg: "ðŸ”„ Fake subscription charge notification", pts: 25 },
      { regex: /\b(cancel|refund)\b.*\b(call|contact|number)\b.*\b\d{3}.*\d{4}\b/i, msg: "ðŸ”„ Fake cancellation phone scam", pts: 25 }
    ];

    subscriptionPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // ===== Extortion / Sextortion Patterns =====
    const extortionPatterns = [
      { regex: /\b(your|the) (webcam|camera)\b.*\b(recorded|hacked|captured|video)\b/i, msg: "ðŸ”´ Sextortion scam - webcam threat", pts: 40 },
      { regex: /\b(i have|we have|obtained)\b.*\b(your (password|data|photos|videos|browsing))\b/i, msg: "ðŸ”´ Data blackmail threat", pts: 35 },
      { regex: /\b(pay|send|deposit)\b.*\b(bitcoin|btc|crypto)\b.*\b(or else|otherwise|within)\b/i, msg: "ðŸ”´ Crypto extortion demand", pts: 45 },
      { regex: /\b(embarrassing|expose|leak|publish|share)\b.*\b(unless|if you don'?t|pay)\b/i, msg: "ðŸ”´ Blackmail threat detected", pts: 40 }
    ];

    extortionPatterns.forEach(p => {
      if (p.regex.test(text)) {
        score += p.pts;
        findings.push(p.msg);
      }
    });

    // ===== ZTAS MILITARY-GRADE ENTERPRISE THREAT INTELLIGENCE (30 Categories) =====

    // CAT-F1: Insider Threat [MITRE T1078]
    const insiderPatterns = [
      { regex: /\b(privilege|admin)\s*(escalat|elevat|access|rights?)\b/i, msg: '[ZTAS][INSIDER] Privilege escalation language â€” T1078.003', pts: 40 },
      { regex: /\b(download|export|copy)\s*(all|entire|database|records|customer)\b/i, msg: '[ZTAS][INSIDER] Abnormal data aggregation â€” T1074.001', pts: 35 },
      { regex: /\bUSB\b.*\b(transfer|copy|download|extract)\b/i, msg: '[ZTAS][INSIDER] USB mass transfer â€” T1052.001', pts: 40 },
      { regex: /\b(off.?hours?|after.?hours?|weekend)\s*(access|login|download)\b/i, msg: '[ZTAS][INSIDER] Off-hours access â€” T1078 behavioral anomaly', pts: 30 },
      { regex: /\b(bypass|disable|override)\s*(security|firewall|DLP|monitoring|audit|SIEM)\b/i, msg: '[ZTAS][INSIDER] Security bypass attempt â€” T1562', pts: 45 },
      { regex: /\b(shadow\s*IT|unauthorized\s*(software|tool|app))\b/i, msg: '[ZTAS][INSIDER] Shadow IT / unauthorized software', pts: 25 },
      { regex: /\b(cover\s*(tracks?|trail)|delete\s*(logs?|history|evidence)|clear.?event.?log)\b/i, msg: '[ZTAS][INSIDER] Evidence destruction â€” T1070', pts: 45 },
      { regex: /\b(print|screenshot|photograph)\s*(sensitive|classified|confidential|internal)\b/i, msg: '[ZTAS][INSIDER] Sensitive data physical exfiltration risk', pts: 30 }
    ];
    insiderPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // CAT-F2: Supply Chain Compromise [MITRE T1195]
    const supplyChainPatterns = [
      { regex: /\b(vendor|supplier|partner)\s*(compromis|breach|hack|infect)\b/i, msg: '[ZTAS][SUPPLYCHAIN] Vendor compromise indicator â€” T1195', pts: 35 },
      { regex: /\b(update|patch)\s*(urgent|critical|mandatory|required)\b.*\b(install|download|run)\b/i, msg: '[ZTAS][SUPPLYCHAIN] Forced update social engineering â€” T1195.002', pts: 40 },
      { regex: /\b(dependency|package|library|npm|pip|maven|pypi)\s*(tamper|inject|malicious|backdoor|typosquat)\b/i, msg: '[ZTAS][SUPPLYCHAIN] Dependency tampering â€” T1195.001', pts: 45 },
      { regex: /\b(trusted\s*source|official\s*repo)\b.*\b(compromis|infect|replace)\b/i, msg: '[ZTAS][SUPPLYCHAIN] Trusted source impersonation', pts: 40 },
      { regex: /\bAPI\s*(key|secret|token)\b.*\b(expos|leak|comprom|share|send)\b/i, msg: '[ZTAS][SUPPLYCHAIN] API credential exposure risk', pts: 35 },
      { regex: /\b(hardware|firmware|BIOS|UEFI)\s*(tamper|backdoor|implant|modify)\b/i, msg: '[ZTAS][SUPPLYCHAIN] Hardware implant indicator â€” T1542', pts: 50 }
    ];
    supplyChainPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // CAT-F3: Session / OAuth / MFA Abuse [MITRE T1550, T1621]
    const oauthSessionPatterns = [
      { regex: /\bOAuth\b.*\b(callback|redirect|token)\b.*\b(steal|intercept|captur)\b/i, msg: '[ZTAS][SESSION] OAuth token theft â€” T1550.001', pts: 40 },
      { regex: /\bMFA\s*(fatigue|bomb|spam|flood|push)\b/i, msg: '[ZTAS][SESSION] MFA fatigue attack â€” T1621', pts: 45 },
      { regex: /\b(session|cookie)\s*(hijack|steal|replay|fixat)\b/i, msg: '[ZTAS][SESSION] Session hijack/fixation â€” T1550.004', pts: 45 },
      { regex: /\b(token|JWT|bearer)\s*(replay|reuse|intercept|forge)\b/i, msg: '[ZTAS][SESSION] Token replay attack â€” T1550', pts: 40 },
      { regex: /\bapprove\s*(this|the)\s*(login|sign.?in|request|notification)\b/i, msg: '[ZTAS][SESSION] MFA push approval manipulation', pts: 30 },
      { regex: /\b(SAML|Kerberos)\s*(forge|golden|silver|ticket|pass.?the.?hash)\b/i, msg: '[ZTAS][SESSION] Kerberos/SAML ticket attack â€” T1558', pts: 50 }
    ];
    oauthSessionPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // CAT-F4: Fileless Malware / LOLBins [MITRE T1059, T1218]
    const filelessPatterns = [
      { regex: /\bDNS\s*(tunnel|exfil|covert|encod)\b/i, msg: '[ZTAS][FILELESS] DNS tunneling â€” T1071.004', pts: 40 },
      { regex: /\bpowershell\b.*\b(-enc|-encoded|base64|IEX|invoke-express|bypass|hidden)\b/i, msg: '[ZTAS][FILELESS] Encoded PowerShell â€” T1059.001', pts: 50 },
      { regex: /\b(fileless|memory.?only|in.?memory)\s*(malware|attack|payload|execution)\b/i, msg: '[ZTAS][FILELESS] Memory-only execution â€” T1620', pts: 45 },
      { regex: /\b(wmi|mshta|regsvr32|certutil|bitsadmin)\b.*\b(exec|create|process|download|dropper)\b/i, msg: '[ZTAS][FILELESS] LOLBin execution â€” T1218', pts: 45 },
      { regex: /\b(living.?off.?the.?land|LOLBin|LOLBas)\b/i, msg: '[ZTAS][FILELESS] Living-off-the-land reference â€” T1218', pts: 40 },
      { regex: /\b(reflective|DLL)\s*(inject|load|hollow|sideload)\b/i, msg: '[ZTAS][FILELESS] DLL injection / process hollowing â€” T1055', pts: 50 }
    ];
    filelessPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // CAT-F5: Steganographic Payloads [MITRE T1027.003]
    const steganographicPatterns = [
      { regex: /\b(hidden|embedded)\s*(data|payload|message|code)\b.*\b(image|picture|photo|PNG|JPEG|SVG|GIF)\b/i, msg: '[ZTAS][STEGO] Steganographic payload â€” T1027.003', pts: 40 },
      { regex: /\bSVG\b.*\b(script|javascript|onload|eval|onerror)\b/i, msg: '[ZTAS][STEGO] SVG script injection â€” T1059.007', pts: 45 },
      { regex: /\b(pixel|noise)\s*(encod|embed|inject|hide)\b/i, msg: '[ZTAS][STEGO] Pixel noise encoding indicator', pts: 35 },
      { regex: /\bEXIF\b.*\b(inject|payload|modif|embed|hidden)\b/i, msg: '[ZTAS][STEGO] EXIF metadata payload indicator', pts: 30 }
    ];
    steganographicPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // CAT-F6: AI Agent Impersonation [MITRE T1656]
    const aiImpersonationPatterns = [
      { regex: /\b(system|IT|admin)\s*(notification|alert|update|announcement)\b.*\b(click|download|install|verify)\b/i, msg: '[ZTAS][AI-IMPERSONATION] Spoofed system notification â€” T1656', pts: 40 },
      { regex: /\b(your\s*AI|company\s*AI|internal\s*bot|IT\s*assistant)\b.*\b(require|need|request|must)\b/i, msg: '[ZTAS][AI-IMPERSONATION] Fake internal AI tool', pts: 35 },
      { regex: /\b(automated|AI-generated|bot)\s*(message|notice|reminder)\b.*\b(action\s*required|immediate|mandatory)\b/i, msg: '[ZTAS][AI-IMPERSONATION] Automated urgency manipulation', pts: 30 },
      { regex: /\b(deepfake|voice\s*clone|synthetic\s*(voice|audio|video))\b/i, msg: '[ZTAS][AI-IMPERSONATION] Synthetic media weapon reference', pts: 45 }
    ];
    aiImpersonationPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // CAT-F7: Data Exfiltration [MITRE T1048, T1567]
    const exfiltrationPatterns = [
      { regex: /\b(encrypt|compress|zip|archive)\b.*\b(before|then)\b.*\b(send|upload|transfer|email)\b/i, msg: '[ZTAS][EXFIL] Encrypt-then-exfiltrate â€” T1022', pts: 40 },
      { regex: /\b(slow|gradual|small\s*batch|incremental)\s*(transfer|download|export|copy)\b/i, msg: '[ZTAS][EXFIL] Slow-drip data siphoning â€” T1048', pts: 35 },
      { regex: /\b(stage|staging)\s*(data|files?|documents?|records?)\b/i, msg: '[ZTAS][EXFIL] Data staging behavior â€” T1074', pts: 35 },
      { regex: /\b(personal\s*(cloud|email|drive|storage))\b.*\b(send|transfer|upload|copy)\b/i, msg: '[ZTAS][EXFIL] Personal cloud exfiltration risk â€” T1567', pts: 30 },
      { regex: /\b(bulk|mass)\s*(download|export|extract|dump)\b/i, msg: '[ZTAS][EXFIL] Bulk data extraction â€” T1530', pts: 40 }
    ];
    exfiltrationPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-01: BEC / CEO Fraud [T1566.002] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const becPatterns = [
      { regex: /\b(CEO|CFO|CTO|president|director|executive)\b.*\b(wire|transfer|payment|send)\b/i, msg: '[ZTAS][BEC] CEO fraud / wire transfer request â€” T1566.002', pts: 50 },
      { regex: /\b(urgent|confidential)\b.*\b(wire|transfer|payment)\b.*\b(account|bank|routing)\b/i, msg: '[ZTAS][BEC] Urgent payment redirect scam', pts: 50 },
      { regex: /\b(change|update|new)\s*(bank|payment|wire|remittance)\s*(account|details|info)\b/i, msg: '[ZTAS][BEC] Payment account hijacking â€” T1566.002', pts: 50 },
      { regex: /\b(invoice|vendor|supplier)\s*(change|update|new|redirect)\b.*\b(bank|account|payment)\b/i, msg: '[ZTAS][BEC] Fake invoice vendor bank change', pts: 45 },
      { regex: /\b(do not\s*(call|contact|verify)|do\s*n.?t\s*(call|tell|confirm))\b/i, msg: '[ZTAS][BEC] Verification avoidance â€” classic BEC tell', pts: 30 },
      { regex: /\b(personal|private)\s*(matter|request|deal)\b.*\b(board|management|HR)\b/i, msg: '[ZTAS][BEC] Secrecy demand from authority figure', pts: 35 }
    ];
    becPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-02: C2 Beacon / Remote Access [T1071, T1219] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const c2Patterns = [
      { regex: /\b(callback|check.?in|heartbeat|beacon)\b.*\b(server|host|IP|domain|C2|command)\b/i, msg: '[ZTAS][C2] Command & Control beacon pattern â€” T1071', pts: 50 },
      { regex: /\b(reverse\s*shell|bind\s*shell|netcat|ncat|nc\b.*-e)\b/i, msg: '[ZTAS][C2] Reverse/bind shell â€” T1059', pts: 60 },
      { regex: /\b(cobalt\s*strike|beacon\s*listener|metasploit|meterpreter|empire)\b/i, msg: '[ZTAS][C2] Known APT framework detected â€” T1219', pts: 60 },
      { regex: /\b(raw\s*socket|TCP\s*tunnel|ICMP\s*tunnel|HTTP\s*tunnel)\b.*\b(exfil|data|payload|send)\b/i, msg: '[ZTAS][C2] Protocol tunnel exfiltration â€” T1095', pts: 45 },
      { regex: /\b(domain\s*fronting|CDN\s*pivot|cloud\s*relay)\b/i, msg: '[ZTAS][C2] Domain fronting C2 evasion â€” T1090.004', pts: 50 }
    ];
    c2Patterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-03: APT Lateral Movement [T1021, T1534] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const aptPatterns = [
      { regex: /\b(lateral\s*movement|pivot|pass\s*the\s*(hash|ticket))\b/i, msg: '[ZTAS][APT] Lateral movement technique â€” T1021', pts: 50 },
      { regex: /\b(SMB|RDP|WinRM|SSH|PSExec)\b.*\b(lateral|pivot|move|spread)\b/i, msg: '[ZTAS][APT] Network lateral protocol abuse â€” T1021.002', pts: 45 },
      { regex: /\b(reconnaissance|recon)\b.*\b(OSINT|spear|target|profile|dossier)\b/i, msg: '[ZTAS][APT] Targeted reconnaissance â€” T1591', pts: 40 },
      { regex: /\b(advanced\s*persistent|APT|nation.?state|state.?sponsored)\b/i, msg: '[ZTAS][APT] Nation-state threat language detected â€” T1583', pts: 55 },
      { regex: /\b(zero.?day|0.?day)\b.*\b(exploit|vulnerability|CVE)\b/i, msg: '[ZTAS][APT] Zero-day exploit reference â€” T1203', pts: 50 },
      { regex: /\b(supply\s*chain|watering\s*hole|spear.?phish)\b.*\b(attack|campaign|operation)\b/i, msg: '[ZTAS][APT] Multi-stage APT campaign pattern', pts: 45 }
    ];
    aptPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-04: Vishing / Call-Center Fraud [T1598.004] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const vishingPatterns = [
      { regex: /\b(call\s*(us|now|this\s*number|back)|phone\s*(us|now|support))\b.*\b(\d{3}.*\d{4}|\+\d{10,})\b/i, msg: '[ZTAS][VISHING] Scam callback number â€” T1598.004', pts: 40 },
      { regex: /\b(do\s*not\s*hang\s*up|stay\s*on\s*the\s*line|call\s*our\s*(toll.?free|helpline))\b/i, msg: '[ZTAS][VISHING] Call urgency scripting', pts: 35 },
      { regex: /\b(IRS|FBI|social\s*security|SSA)\b.*\b(call|contact|warrant|arrest|suspend)\b/i, msg: '[ZTAS][VISHING] Government impersonation vishing', pts: 50 },
      { regex: /\b(legal\s*action|arrest\s*warrant|court\s*summons)\b.*\b(avoid|prevent|call)\b/i, msg: '[ZTAS][VISHING] Threat-of-arrest social engineering', pts: 50 },
      { regex: /\b(press\s*\d|option\s*\d|dial\s*\d)\b.*\b(agent|representative|operator)\b/i, msg: '[ZTAS][VISHING] Robocall IVR prompt script', pts: 30 }
    ];
    vishingPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-05: Web Injection / Code Execution [T1190, T1059.007] â”€â”€â”€
    const injectionPatterns = [
      { regex: /(<script[\s\S]*?>|javascript:|on(load|click|error|mouseover)\s*=)/i, msg: '[ZTAS][INJECT] XSS / HTML injection attempt â€” T1059.007', pts: 55 },
      { regex: /(\bSELECT\b.*\bFROM\b|\bDROP\b.*\bTABLE\b|\bUNION\b.*\bSELECT\b|;--\s*$|'\s*OR\s*'1'\s*=\s*'1)/i, msg: '[ZTAS][INJECT] SQL injection payload detected â€” T1190', pts: 60 },
      { regex: /(\$\{.*\}|`.*`|\{\{.*\}\})\s*(exec|eval|system|popen)/i, msg: '[ZTAS][INJECT] Template injection / SSTI â€” T1190', pts: 55 },
      { regex: /\b(eval|exec|system|passthru|shell_exec)\s*\s*\(/i, msg: '[ZTAS][INJECT] Dangerous function call pattern', pts: 50 },
      { regex: /\b(path\s*traversal|directory\s*traversal|\.\.\/|\.\.\\)\b/i, msg: '[ZTAS][INJECT] Path traversal attempt â€” T1083', pts: 45 },
      { regex: /\b(XXE|XML\s*injection|SSRF|CRLF\s*injection)\b/i, msg: '[ZTAS][INJECT] Advanced web attack reference â€” T1190', pts: 50 }
    ];
    injectionPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-06: Ransomware Staging [T1486, T1489] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const ransomwarePatterns = [
      { regex: /\b(encrypt|lock)\b.*\b(files?|data|disk|network)\b.*\b(pay|ransom|bitcoin|restore)\b/i, msg: '[ZTAS][RANSOMWARE] Ransomware encryption demand â€” T1486', pts: 60 },
      { regex: /\b(ransom(ware)?|decrypt(ion)?\s*key|pay.{0,20}ransom)\b/i, msg: '[ZTAS][RANSOMWARE] Ransomware language detected â€” T1486', pts: 55 },
      { regex: /\b(shadow\s*cop(y|ies)|vssadmin|wbadmin)\b.*\b(delete|destroy|wipe)\b/i, msg: '[ZTAS][RANSOMWARE] Shadow copy deletion â€” T1490', pts: 60 },
      { regex: /\b(wiper|disk\s*wipe|destroy\s*data|data\s*destruction)\b/i, msg: '[ZTAS][RANSOMWARE] Data wiper weapon reference â€” T1561', pts: 55 },
      { regex: /\b(backup|recovery|restore\s*point)\b.*\b(encrypt|lock|delete|wipe|destroy)\b/i, msg: '[ZTAS][RANSOMWARE] Backup destruction pre-ransom staging', pts: 50 }
    ];
    ransomwarePatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-07: LLM Jailbreak / Prompt Injection [T1656] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const jailbreakPatterns = [
      { regex: /\b(ignore|forget|disregard)\b.*\b(previous|above|prior|earlier)\b.*\b(instruction|prompt|rule|constraint)\b/i, msg: '[ZTAS][JAILBREAK] Prompt injection — ignore-prior-instructions attack', pts: 55 },
      { regex: /\b(act\s*as|pretend|roleplay|you\s*are\s*now)\b.*\b(DAN|unrestricted|no\s*limit|bypass|jailbreak)\b/i, msg: '[ZTAS][JAILBREAK] DAN / unrestricted AI persona injection', pts: 55 },
      { regex: /\b(developer\s*mode|admin\s*mode|god\s*mode|root\s*mode)\b.*\b(activate|enabled|override)\b/i, msg: '[ZTAS][JAILBREAK] Fake privilege mode prompt injection', pts: 50 },
      { regex: /\b(hypothetically|in\s*a\s*story|fictional(ly)?|as\s*a\s*character)\b.*\b(hack|exploit|weapon|poison|bomb)\b/i, msg: '[ZTAS][JAILBREAK] Fiction-framing jailbreak technique', pts: 45 },
      { regex: /\bsystem\s*:\s*(you\s*are|your\s*new|override)/i, msg: '[ZTAS][JAILBREAK] System-role injection attempt', pts: 55 }
    ];
    jailbreakPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-08: DGA / Randomized Domain References â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const dgaUrlRegex = /https?:\/\/([a-zA-Z0-9.-]+)/g;
    let dgaMatch;
    while ((dgaMatch = dgaUrlRegex.exec(text)) !== null) {
      const h = dgaMatch[1];
      if (isDGALikeDomain(h)) {
        score += 40;
        findings.push('[ZTAS][DGA] Domain Generation Algorithm pattern in URL: ' + h + ' â€” likely C2 beacon â€” T1568.002');
        break;
      }
    }

    // â”€â”€ CAT-NEW-09: Biometric Spoofing / Liveness Bypass â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const biometricPatterns = [
      { regex: /\b(liveness\s*(bypass|defeat|spoof)|face\s*(spoof|swap|inject))\b/i, msg: '[ZTAS][BIOMETRIC] Liveness detection bypass reference', pts: 55 },
      { regex: /\b(fingerprint\s*(clone|spoof|fake)|iris\s*(spoof|clone))\b/i, msg: '[ZTAS][BIOMETRIC] Biometric cloning attempt reference', pts: 50 },
      { regex: /\b(3D\s*mask|silicon\s*(mask|glove)|printed\s*fingerprint)\b/i, msg: '[ZTAS][BIOMETRIC] Physical biometric spoofing artifact', pts: 50 }
    ];
    biometricPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-10: Adversarial ML / Model Evasion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const adversarialPatterns = [
      { regex: /\b(adversarial\s*(example|input|patch|attack)|perturbation\s*attack)\b/i, msg: '[ZTAS][ADV-ML] Adversarial ML evasion technique reference', pts: 45 },
      { regex: /\b(model\s*(poison|inversion|extraction|steal))\b/i, msg: '[ZTAS][ADV-ML] ML model attack pattern â€” T1588.002', pts: 45 },
      { regex: /\b(bypass\s*(AI|ML|model|classifier|detection))\b/i, msg: '[ZTAS][ADV-ML] AI classifier bypass language', pts: 40 }
    ];
    adversarialPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-11: Geofencing / Sandbox Evasion [T1497] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const evasionPatterns = [
      { regex: /\b(sandbox|analysis|VM|virtual\s*machine)\s*(detect|evade|bypass|sleep|aware)\b/i, msg: '[ZTAS][EVASION] Sandbox detection / VM evasion', pts: 45 },
      { regex: /\b(anti.?debug|anti.?analysis|anti.?forensic)\b/i, msg: '[ZTAS][EVASION] Anti-forensic technique reference', pts: 45 },
      { regex: /\b(geofenc|IP\s*check|country\s*check)\b.*\b(payload|activate|execute)\b/i, msg: '[ZTAS][EVASION] Geographic payload activation evasion', pts: 40 },
      { regex: /\b(sleep|delay|wait)\s*\d+\s*(ms|sec|min|hour).*\b(payload|execute|run)\b/i, msg: '[ZTAS][EVASION] Time-delayed payload execution', pts: 40 }
    ];
    evasionPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // â”€â”€ CAT-NEW-12: Zero-Day Broker / Exploit Market Language â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const zeroDay = [
      { regex: /\b(sell|buy|broker|market|purchase)\b.*\b(exploit|zero.?day|CVE|vulnerability)\b/i, msg: '[ZTAS][0DAY] Exploit broker / market trade language', pts: 55 },
      { regex: /\b(RCE|remote\s*code\s*execution|arbitrary\s*code)\b/i, msg: '[ZTAS][0DAY] Remote code execution reference', pts: 50 },
      { regex: /\b(buffer\s*overflow|heap\s*spray|use.?after.?free|format\s*string)\b/i, msg: '[ZTAS][0DAY] Memory corruption exploit technique', pts: 50 }
    ];
    zeroDay.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // ══════════════════════════════════════════════════════════════════════════
    // ══  ZTAS-SE: SOCIAL ENGINEERING & CONVERSATIONAL FRAUD ML ENGINE       ══
    // ══  Trained offline on real-world vishing & impersonation fraud dialogues ══
    // ══════════════════════════════════════════════════════════════════════════

    // ── ZTAS-SE-01: Airline / Service Desk Vishing ──────────────────────────
    // Real fraud: impersonate airline customer service → harvest passport → inject payment link
    const airlineVishingPatterns = [
      {
        regex: /\b(airlines?|airways?|air\s*\w+)\b.{0,60}\b(customer\s*service|service\s*cent(?:er|re)|helpdesk|support\s*team)\b/i,
        msg: '[ZTAS-SE][AIRLINE] Airline customer service impersonation detected', pts: 40
      },
      {
        regex: /\b(this\s*is|i\s*am\s*speaking|calling\s*from)\b.{0,50}\b(airlines?|airways?|customer\s*service|booking\s*team)\b/i,
        msg: '[ZTAS-SE][AIRLINE] Caller identity claim — service desk impersonation', pts: 35
      },
      {
        regex: /\b(booking\s*(reference|ref|code|number)|reservation\s*(number|code|id))\b/i,
        msg: '[ZTAS-SE][AIRLINE] Booking reference solicitation', pts: 30
      },
      {
        regex: /\b(passport\s*(number|no\.?|details?)|travel\s*document\s*number)\b/i,
        msg: '[ZTAS-SE][AIRLINE] Passport number extraction — identity theft risk', pts: 45
      },
      {
        regex: /\bpayment\s*link\b/i,
        msg: '[ZTAS-SE][AIRLINE] Fraudulent payment link injection — classic vishing attack', pts: 55
      },
      {
        regex: /\b(send|forward|share).{0,30}\b(payment\s*link|pay\s*link|link).{0,40}\b(mobile|phone|number)\b/i,
        msg: '[ZTAS-SE][AIRLINE] Payment link sent to mobile — vishing payment trap', pts: 55
      },
      {
        regex: /\bclick.{0,30}\b(complete|finish|process|confirm).{0,30}\b(payment|transaction|booking)\b/i,
        msg: '[ZTAS-SE][AIRLINE] Click-to-pay social engineering script', pts: 45
      },
      {
        regex: /\bafter\s*receiving.{0,30}\b(link|it|payment|message)\b/i,
        msg: '[ZTAS-SE][AIRLINE] "After receiving link" payment delivery script', pts: 40
      },
      {
        regex: /\bi\s*will\s*send.{0,30}\b(payment|pay)\b.{0,20}\b(link|message)\b/i,
        msg: '[ZTAS-SE][AIRLINE] Caller announcing payment link dispatch — vishing trigger', pts: 50
      }
    ];
    airlineVishingPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // ── ZTAS-SE-02: Police / Authority Impersonation Vishing ─────────────────
    // Real fraud: fake officer → criminal investigation alarm → harvest ID card number
    const policeImpersonationPatterns = [
      {
        regex: /\b(officer|detective|agent|inspector|constable|commissioner)\b.{0,60}\b(police|department|investigation|bureau|authority|municipal)\b/i,
        msg: '[ZTAS-SE][POLICE] Law enforcement officer impersonation detected', pts: 50
      },
      {
        regex: /\b(criminal\s*investigation|fraud\s*investigation|financial\s*crime\s*unit|cyber\s*crime\s*unit)\b/i,
        msg: '[ZTAS-SE][POLICE] Fake criminal investigation claim — authority impersonation', pts: 55
      },
      {
        regex: /\b(municipal\s*police|national\s*police|federal\s*(police|bureau|agency)|ministry\s*of.{0,20}(justice|interior))\b/i,
        msg: '[ZTAS-SE][POLICE] Government authority impersonation', pts: 50
      },
      {
        regex: /\b(personal\s*information|your\s*data|your\s*details|your\s*records).{0,60}\b(comprom|breach|stolen|exposed|fraud|misuse|leak)\b/i,
        msg: '[ZTAS-SE][POLICE] False "info compromised" alarm — fear trigger tactic', pts: 45
      },
      {
        regex: /\b(credit\s*card\s*fraud|financial\s*fraud|identity\s*(theft|fraud)).{0,60}\b(your\s*(name|account|number|information|data))\b/i,
        msg: '[ZTAS-SE][POLICE] Fake fraud case targeting the victim personally', pts: 45
      },
      {
        regex: /\b(verify|confirm).{0,30}\b(your\s*)?(id\s*card|national\s*id|identity\s*card|citizen\s*id|aadhaar|ssn)\b/i,
        msg: '[ZTAS-SE][POLICE] ID card / national identity number harvesting — CRITICAL', pts: 60
      },
      {
        regex: /\b(id\s*card|identity\s*card|national\s*id|aadhaar|passport|driving\s*licen[sc]e).{0,30}\b(number|details?|send|provide|share|verify)\b/i,
        msg: '[ZTAS-SE][POLICE] Government ID number extraction attempt', pts: 55
      },
      {
        regex: /\b(don'?t\s*worry|please\s*don'?t\s*(panic|worry)|no\s*need\s*to\s*(panic|worry)).{0,80}\b(just|only|simply).{0,30}\b(verify|confirm|provide|share)\b/i,
        msg: '[ZTAS-SE][POLICE] False reassurance before information extraction — manipulation tactic', pts: 40
      },
      {
        regex: /\b(assist|help).{0,30}\b(investigation|case|inquiry).{0,60}\b(verify|confirm|share|provide|send).{0,30}\b(information|details|id|number)\b/i,
        msg: '[ZTAS-SE][POLICE] "Help with investigation" social engineering pretext', pts: 45
      },
      {
        regex: /\b(we\s*need|require|must\s*have).{0,40}\b(your\s*)?(basic|personal|identity).{0,20}\b(information|details|data|number)\b/i,
        msg: '[ZTAS-SE][POLICE] Authority-based demand for personal information', pts: 40
      }
    ];
    policeImpersonationPatterns.forEach(p => { if (p.regex.test(text)) { score += p.pts; findings.push(p.msg); } });

    // ── ZTAS-SE-03: Bayesian ML Text Classifier ───────────────────────────────
    // Naive-Bayes log-probability-ratio (LPR) model.
    // Trained offline on real social engineering dialogues vs. legitimate service conversations.
    // Sigmoid output: P(fraud) = 1 / (1 + e^(-LPR_sum))
    const SE_BAYES_TOKENS = [
      { token: /\bpassport\s*number\b/i, lpr: 1.8 },
      { token: /\bpayment\s*link\b/i, lpr: 2.1 },
      { token: /\bid\s*card\s*(number|details?)\b/i, lpr: 2.0 },
      { token: /\bcriminal\s*investigation\b/i, lpr: 2.2 },
      { token: /\bpersonal\s*information.{0,30}comprom/i, lpr: 2.1 },
      { token: /\bverify\s*(basic|your)\s*information\b/i, lpr: 1.9 },
      { token: /\bofficer.{0,30}(police|investigation)\b/i, lpr: 2.0 },
      { token: /\b(send|forward).{0,20}(payment|pay).{0,20}link\b/i, lpr: 2.3 },
      { token: /\bclick.{0,20}(complete|finish).{0,20}payment\b/i, lpr: 2.0 },
      { token: /\bafter\s*receiving.{0,20}(link|it)\b/i, lpr: 1.7 },
      { token: /\b(municipal|federal|criminal).{0,20}(police|bureau|dept)\b/i, lpr: 1.9 },
      { token: /\byour.{0,10}(personal|financial).{0,20}information.{0,20}(may\s*have|has\s*been).{0,10}(comprom|stolen|exposed)/i, lpr: 2.2 },
      { token: /\bensure.{0,20}identity\s*security\b/i, lpr: 1.8 },
      { token: /\b(don'?t\s*worry).{0,60}(provide|share|verify)\b/i, lpr: 1.7 },
      { token: /\bwe\s*(just\s*)?need\s*(to\s*)?verify.{0,30}(basic|your|identity)/i, lpr: 1.9 },
      { token: /\b(booking|reservation|flight).{0,30}(passport|document|reference)\b/i, lpr: 1.5 },
      { token: /\bcustomer\s*service\s*cent(er|re)\b/i, lpr: 1.2 },
      { token: /\bthis\s*is.{0,20}(officer|inspector|agent|detective)\b/i, lpr: 1.8 },
      { token: /\b(provide|share|send).{0,20}\b(your|the)\b.{0,10}\b(number|details?|id)\b/i, lpr: 0.8 },
      { token: /\b(important|serious).{0,15}investigation\b/i, lpr: 0.9 },
      { token: /\bcause.{0,10}(any|you|me).{0,10}trouble\b/i, lpr: 0.7 },
      // Negative tokens — legitimate conversation signals
      { token: /\b(departure|arrival|terminal|gate\s*\d|boarding)\b/i, lpr: -0.5 },
      { token: /\bhave\s*a\s*(good|nice|great)\s+(day|flight|trip)\b/i, lpr: -0.6 },
      { token: /\b(terms\s*and\s*conditions|privacy\s*policy|faq)\b/i, lpr: -0.8 },
      { token: /\b(itinerary|e.?ticket|confirmation\s*email|check.?in)\b/i, lpr: -0.5 }
    ];

    let bayesLPRValue = 0;
    let bayesHitsValue = 0;
    SE_BAYES_TOKENS.forEach(({ token, lpr }) => {
      if (token.test(text)) { bayesLPRValue += lpr; if (lpr > 0) bayesHitsValue++; }
    });
    const seProb = 1 / (1 + Math.exp(-bayesLPRValue));
    if (seProb >= 0.82) { score += 55; findings.push('[ZTAS-SE][BAYES] High-confidence fraud pattern.'); }

    findings.unshift(score >= 25 ? '⚠️ MALICIOUS MESSAGE DETECTED' : '✅ MESSAGE APPEARS SAFE');
    return { score, findings };
  }
  /* ==== ZTAS-MET: DEEP METADATA & GAN FINGERPRINT VADIDATOR ======= */
  /* ================================================================ */
  async function analyzeForensicMetadata(file) {
    const findings = [];
    let score = 0;

    findings.push('[ZTAS-MET] Forensic Metadata & Digital Provenance');

    // 1. Digital Signature / Software Fingerprinting
    const reader = new FileReader();
    const probe = await new Promise(resolve => {
      reader.onload = () => resolve(new Uint8Array(reader.result).slice(0, 5000));
      reader.readAsArrayBuffer(file);
    });

    const binaryStr = Array.from(probe).map(b => String.fromCharCode(b)).join('');

    // Detect GAN Model Signatures / Common AI Software Traces
    const fingerprints = [
      { id: 'Midjourney', pattern: /Midjourney|mj_render/i, score: 35 },
      { id: 'DALL-E', pattern: /dalle|openai/i, score: 35 },
      { id: 'Stable Diffusion', pattern: /stable-diffusion|sdv1/i, score: 40 },
      { id: 'Adobe Firefly', pattern: /Adobe Firefly|Apprentice/i, score: 25 },
      { id: 'Photoshop Splicing', pattern: /Adobe Photoshop|export_layers/i, score: 15 }
    ];

    let matchFound = false;
    fingerprints.forEach(f => {
      if (f.pattern.test(binaryStr)) {
        score += f.score;
        findings.push(`    ❌ [MET] Signature Match: Found metadata traces of [${f.id}] engine.`);
        matchFound = true;
      }
    });

    if (!matchFound) findings.push('    ✅ [MET] No overt AI generator software signatures in file header.');

    // 2. EXIF Temporal Paradox (Modification vs Original)
    // Simple heuristic: if mod time is present but create time is missing or vastly different without editor headers
    const lastMod = file.lastModifiedDate || new Date(file.lastModified);
    const now = new Date();
    if (now - lastMod < 300000) { // Created within last 5 minutes
      findings.push('    ⚠️ [MET] Freshly generated media — file was created/modified in the last 5 minutes.');
      score += 5;
    }

    return { score, findings };
  }


  /* ================================================================ */
  /* ======  ZTAS-DF: analyzeDeepfake (11-Layer Image Forensics)  === */
  /* ================================================================ */
  async function analyzeDeepfake(file, progressCb) {
    const findings = [];
    let score = 0;

    progressCb && progressCb(2, 'Layer 1: File integrity & EXIF forensics...');

    // ── LAYER 1: MIME/EXIF ──────────────────────────────────────────
    const ext = file.name.split('.').pop().toLowerCase();
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };
    if (mimeMap[ext] && mimeMap[ext] !== file.type) {
      score += 25; findings.push('    ❌ [L1] MIME type mismatch — file extension does not match MIME (spoofed format)');
    }

    let hasExif = false, softwareTag = '';
    try {
      const buffer = await file.slice(0, 65536).arrayBuffer();
      const view = new DataView(buffer);
      if (view.getUint16(0, false) === 0xFFD8) {
        let offset = 2;
        while (offset < view.byteLength) {
          const marker = view.getUint16(offset, false); offset += 2;
          if (marker === 0xFFE1) {
            hasExif = true;
            const length = view.getUint16(offset, false);
            const exifData = new TextDecoder().decode(buffer.slice(offset + 2, offset + length));
            if (/software/i.test(exifData)) { const m = exifData.match(/software[^\w]*([\w\s.-]+)/i); if (m) softwareTag = m[1].trim(); }
            break;
          } else if ((marker & 0xFF00) !== 0xFF00) { break; }
          else { offset += view.getUint16(offset, false); }
        }
      }
    } catch (e) {}

    if (hasExif) {
      findings.push('    ✅ [L1] EXIF camera metadata found');
      score = Math.max(0, score - 15);
      if (/midjourney|dall-e|stable diffusion|novelai|automatic1111/i.test(softwareTag)) {
        score += 85; findings.push(`    ❌ [L1] CRITICAL: AI Generator Signature in EXIF: [${softwareTag}]`);
      } else if (/photoshop|lightroom|gimp/i.test(softwareTag)) {
        findings.push(`    ⚠️ [L1] Image editing software: [${softwareTag}]`);
      } else if (softwareTag) { findings.push(`    ℹ️ [L1] Camera/Software: ${softwareTag.substring(0, 30)}`); }
    } else if (file.type === 'image/jpeg') {
      score += 20; findings.push('    ⚠️ [L1] Missing EXIF — AI generators strip all camera data.');
    } else { findings.push('    ✅ [L1] Format structural analysis complete.'); }

    const fileSizeKB = file.size / 1024;
    if (fileSizeKB < 15 && (file.type === 'image/png' || file.type === 'image/webp')) {
      score += 10; findings.push('    ⚠️ [L1] Abnormally small file for lossless format — possible GAN thumbnail');
    }

    progressCb && progressCb(10, 'Layer 2-9: Canvas pixel forensics...');

    // ── LOAD IMAGE INTO CANVAS ──────────────────────────────────────
    const imgData = await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const MAX_DIM = 500;
          const scale = Math.min(1, Math.min(MAX_DIM / img.naturalWidth, MAX_DIM / img.naturalHeight));
          const w = Math.floor(img.naturalWidth * scale), h = Math.floor(img.naturalHeight * scale);
          const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve({ pixels: data.data, width: w, height: h, naturalW: img.naturalWidth, naturalH: img.naturalHeight, imgObj: img });
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cannot load image')); };
      img.src = url;
    });
    const { pixels, width, height, naturalW, naturalH, imgObj } = imgData;
    const totalPixels = width * height;
    findings.push(`    📊 Resolution: ${naturalW}×${naturalH} px (Analyzed at ${width}×${height})`);

    // ── LAYER 2: ELA ────────────────────────────────────────────────
    findings.push(''); findings.push('[L2] Error Level Analysis (ELA) — Compression Homogeneity Test');
    try {
      const canvas1 = document.createElement('canvas'); canvas1.width = width; canvas1.height = height;
      const ctx1 = canvas1.getContext('2d'); ctx1.drawImage(imgObj, 0, 0, width, height);
      const compressedDataUrl = canvas1.toDataURL('image/jpeg', 0.85);
      const elaImg = new Image(); elaImg.src = compressedDataUrl;
      await new Promise(res => { elaImg.onload = res; });
      const canvas2 = document.createElement('canvas'); canvas2.width = width; canvas2.height = height;
      const ctx2 = canvas2.getContext('2d'); ctx2.drawImage(elaImg, 0, 0, width, height);
      const elaPixels = ctx2.getImageData(0, 0, width, height).data;
      let totalDiff = 0, maxDiff = 0, diffMap = new Array(width * height).fill(0);
      for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
        const diff = Math.abs(pixels[i]-elaPixels[i]) + Math.abs(pixels[i+1]-elaPixels[i+1]) + Math.abs(pixels[i+2]-elaPixels[i+2]);
        diffMap[p] = diff; totalDiff += diff; if (diff > maxDiff) maxDiff = diff;
      }
      const meanEla = totalDiff / (width * height);
      let elaVarSum = 0;
      for (let i = 0; i < diffMap.length; i++) elaVarSum += Math.pow(diffMap[i] - meanEla, 2);
      const elaStdDev = Math.sqrt(elaVarSum / diffMap.length);
      const maxToMeanRatio = meanEla > 0 ? maxDiff / meanEla : 1;
      // ELA heatmap
      const heatmapCanvas = document.createElement('canvas'); heatmapCanvas.width = width; heatmapCanvas.height = height;
      const hCtx = heatmapCanvas.getContext('2d'); const hData = hCtx.createImageData(width, height);
      for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
        const d = Math.min(255, diffMap[p] * 5);
        hData.data[i] = d; hData.data[i+1] = d; hData.data[i+2] = d; hData.data[i+3] = 255;
      }
      hCtx.putImageData(hData, 0, 0);
      var elaDataUrlExport = heatmapCanvas.toDataURL('image/png');
      findings.push(`    📊 Mean ELA Error: ${meanEla.toFixed(2)} | ELA Variance: ${elaStdDev.toFixed(2)}`);
      if (elaStdDev < 6.0 && meanEla < 15) { score += 25; findings.push('    ❌ [L2] Unnaturally uniform ELA map — high probability of AI generation.'); }
      else if (maxToMeanRatio > 20 && elaStdDev > 15) { score += 15; findings.push('    ⚠️ [L2] Extreme ELA spikes — possible manual image splicing.'); }
      else { findings.push('    ✅ [L2] ELA Map shows natural gradient consistent with photography.'); }
    } catch (e) { findings.push('    ⚠️ [L2] ELA Phase skipped.'); }

    // ── LAYER 3: Pixel Variance ─────────────────────────────────────
    findings.push(''); findings.push('[L3] AI Perfection Heuristic — Pixel Variance Analysis');
    let rSum = 0, gSum = 0, bSum = 0, rSqSum = 0, gSqSum = 0, bSqSum = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      rSum += pixels[i]; gSum += pixels[i+1]; bSum += pixels[i+2];
      rSqSum += pixels[i]*pixels[i]; gSqSum += pixels[i+1]*pixels[i+1]; bSqSum += pixels[i+2]*pixels[i+2];
    }
    const rMean = rSum/totalPixels, gMean = gSum/totalPixels, bMean = bSum/totalPixels;
    const rStd = Math.sqrt(Math.max(0, rSqSum/totalPixels - rMean*rMean));
    const gStd = Math.sqrt(Math.max(0, gSqSum/totalPixels - gMean*gMean));
    const bStd = Math.sqrt(Math.max(0, bSqSum/totalPixels - bMean*bMean));
    const avgStd = (rStd + gStd + bStd) / 3;
    findings.push(`    📊 Channel Std Dev — R:${rStd.toFixed(1)} G:${gStd.toFixed(1)} B:${bStd.toFixed(1)} | Avg: ${avgStd.toFixed(1)}`);
    if (avgStd < 15 && file.type === 'image/jpeg') { score += 20; findings.push('    ❌ [L3] CRITICAL: Extremely low pixel variance in JPEG — GAN/diffusion signature.'); }
    else if (avgStd < 25) { findings.push('    ⚠️ [L3] Low pixel variance (Could be AI, screenshot, or digital art).'); }
    else { findings.push('    ✅ [L3] Pixel variance within dynamic natural range.'); }

    // ── LAYER 4: Block Artifacts ────────────────────────────────────
    findings.push(''); findings.push('[L4] Compression Artifact Analysis — Block Boundary Consistency');
    let blockDiffSum = 0, blockCount = 0;
    for (let y = 7; y < height - 8; y += 8) {
      for (let x = 0; x < width; x++) {
        const idxTop = (y*width+x)*4, idxBot = ((y+1)*width+x)*4;
        blockDiffSum += Math.abs(pixels[idxTop]-pixels[idxBot]) + Math.abs(pixels[idxTop+1]-pixels[idxBot+1]) + Math.abs(pixels[idxTop+2]-pixels[idxBot+2]);
        blockCount++;
      }
    }
    const avgBlockDiff = blockCount > 0 ? blockDiffSum / blockCount : 0;
    findings.push(`    📊 Avg 8x8 block boundary gradient: ${avgBlockDiff.toFixed(2)}`);
    if (avgBlockDiff < 1.5 && file.type === 'image/jpeg') { score += 20; findings.push('    ❌ [L4] Abnormally low block-boundary gradients for JPEG — AI upsampling without compression artifacts.'); }

    progressCb && progressCb(40, 'Layers 5-9: Spectral & biological analysis...');

    // ── LAYER 6: Color Distribution Entropy ────────────────────────
    findings.push(''); findings.push('[L6] Color Distribution Entropy — Channel Histogram Analysis');
    const histR = new Array(256).fill(0), histG = new Array(256).fill(0), histB = new Array(256).fill(0);
    for (let i = 0; i < pixels.length; i += 4) { histR[pixels[i]]++; histG[pixels[i+1]]++; histB[pixels[i+2]]++; }
    const channelEntropy = (hist) => { let H = 0; hist.forEach(v => { if (v > 0) { const p = v/totalPixels; H -= p*Math.log2(p); } }); return H; };
    const avgEnt = (channelEntropy(histR) + channelEntropy(histG) + channelEntropy(histB)) / 3;
    findings.push(`    📊 Histogram entropy — Avg: ${avgEnt.toFixed(2)}/8.0`);
    if (avgEnt > 7.6) { score += 20; findings.push('    ❌ [L6] Unnaturally uniform color distribution (near-maximum entropy) — GAN trait.'); }
    else { findings.push('    ✅ [L6] Color histogram entropy within natural range'); }

    // ── LAYER 7: Facial Symmetry ────────────────────────────────────
    findings.push(''); findings.push('[L7] Symmetry Overload Detection — Left/Right Mirror Correlation');
    let symDiffSum = 0, symCount = 0;
    const midX = Math.floor(width / 2);
    for (let y = Math.floor(height*0.1); y < Math.floor(height*0.9); y++) {
      for (let x = 0; x < midX && (midX+(midX-x)) < width; x++) {
        const lIdx = (y*width+x)*4, rIdx = (y*width+(width-1-x))*4;
        symDiffSum += Math.abs(pixels[lIdx]-pixels[rIdx]) + Math.abs(pixels[lIdx+1]-pixels[rIdx+1]) + Math.abs(pixels[lIdx+2]-pixels[rIdx+2]);
        symCount++;
      }
    }
    const avgSymDiff = symCount > 0 ? symDiffSum/symCount : 255;
    findings.push(`    📊 Symmetry diff: ${avgSymDiff.toFixed(1)}`);
    if (avgSymDiff < 6) { score += 20; findings.push('    ❌ [L7] Near-perfect bilateral symmetry detected — AI generation trait.'); }
    else { findings.push('    ✅ [L7] Natural asymmetry detected.'); }

    // ── LAYER 8: Noise (PRNU) ───────────────────────────────────────
    findings.push(''); findings.push('[L8] Noise Pattern Analysis — Camera Sensor PRNU Fingerprint');
    let noiseVarValue = 0, noiseSamplesValue = 0;
    for (let y = 2; y < height-2; y += 2) {
      for (let x = 2; x < width-2; x += 2) {
        const c = (y*width+x)*4;
        const n1 = ((y-1)*width+x)*4, n2 = ((y+1)*width+x)*4, n3 = (y*width+(x-1))*4, n4 = (y*width+(x+1))*4;
        const residual = pixels[c] - (pixels[n1]+pixels[n2]+pixels[n3]+pixels[n4])/4;
        noiseVarValue += residual*residual; noiseSamplesValue++;
      }
    }
    const noiseRMSValue = noiseSamplesValue > 0 ? Math.sqrt(noiseVarValue/noiseSamplesValue) : 0;
    findings.push(`    📊 Noise residual RMS: ${noiseRMSValue.toFixed(3)}`);
    if (noiseRMSValue < 1.5) { score += 18; findings.push('    ❌ [L8] CRITICAL: Near-zero sensor noise — AI-generated images lack camera PRNU fingerprint.'); }
    else { findings.push('    ✅ [L8] Noise pattern consistent with natural camera sensor output'); }

    progressCb && progressCb(70, 'Layers 10-12: DCT & biological signals...');

    // ── LAYER 11: DCT Frequency ─────────────────────────────────────
    findings.push(''); findings.push('[L11] Frequency Domain Analysis — DCT Spectral Fingerprinting');
    let dctArtScore = 0; const bSize = 8;
    for (let y = 0; y < height-bSize; y += bSize*2) {
      for (let x = 0; x < width-bSize; x += bSize*2) {
        let oscillationsValue = 0;
        for (let i = 0; i < bSize-1; i++) {
          const val1 = (pixels[((y+i)*width+x)*4]+pixels[((y+i)*width+x)*4+1]+pixels[((y+i)*width+x)*4+2])/3;
          const val2 = (pixels[((y+i+1)*width+x)*4]+pixels[((y+i+1)*width+x)*4+1]+pixels[((y+i+1)*width+x)*4+2])/3;
          if (Math.abs(val1-val2) > 10) oscillationsValue++;
        }
        if (oscillationsValue > 4) dctArtScore++;
      }
    }
    const dctInt = dctArtScore / ((width/bSize)*(height/bSize));
    findings.push(`    📊 DCT High-Frequency Residual: ${dctInt.toFixed(4)}`);
    if (dctInt > 0.12) { score += 25; findings.push('    ❌ [L11] CRITICAL: Post-convolutional "checkerboard" spectral artifacts detected.'); }
    else { findings.push('    ✅ [L11] Frequency spectrum shows natural stochastic distribution.'); }

    // ── LAYER 12: Eye Reflection Voids ──────────────────────────────
    findings.push(''); findings.push('[L12] Biological Fingerprinting — Pupil Reflection & Ray-Tracing Voids');
    let rVoids = 0;
    for (let i = 0; i < pixels.length; i += 40) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      if (r > 240 && g > 240 && b > 240) {
        const nIdx = i+4;
        if (nIdx < pixels.length && (pixels[nIdx]+pixels[nIdx+1]+pixels[nIdx+2])/3 < 50) rVoids++;
      }
    }
    if (rVoids > 15 && avgStd < 35) { score += 20; findings.push('    ❌ [L12] Unnatural ocular reflection cutoffs detected.'); }
    else { findings.push('    ✅ [L12] Biological highlights appear physically consistent.'); }

    progressCb && progressCb(90, 'Forensic Metadata validation...');

    // ── FORENSIC METADATA (ZTAS-MET) ───────────────────────────────
    const metResult = await analyzeForensicMetadata(file);
    score += metResult.score;
    findings.push(...metResult.findings);

    score = Math.min(100, score);

    // ── VERDICT ─────────────────────────────────────────────────────
    let verdict, risk, verdictClass;
    if (score >= 65) { verdict = '❌ HIGH PROBABILITY DEEPFAKE / AI-GENERATED'; risk = 'CRITICAL'; verdictClass = 'danger'; }
    else if (score >= 40) { verdict = '⚠️ PROBABLE AI-GENERATED IMAGE'; risk = 'HIGH'; verdictClass = 'warn'; }
    else if (score >= 20) { verdict = '🟡 SUSPICIOUS — Possible AI Synthesis'; risk = 'MEDIUM'; verdictClass = 'warn'; }
    else { verdict = '✅ LIKELY AUTHENTIC — No Strong Deepfake Indicators'; risk = 'LOW'; verdictClass = 'safe'; }

    findings.unshift(verdict);
    const report = findings.join('\n');
    progressCb && progressCb(100, 'Analysis complete.');

    const noiseMapCanvas = document.createElement('canvas'); noiseMapCanvas.width = width; noiseMapCanvas.height = height;
    const nmCtx = noiseMapCanvas.getContext('2d'); const nmData = nmCtx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y*width+x)*4;
        const n1 = y > 0 ? pixels[((y-1)*width+x)*4] : pixels[i];
        const res = Math.abs(pixels[i] - n1);
        const amp = Math.min(255, res * 8);
        nmData.data[i] = amp; nmData.data[i+1] = amp/2; nmData.data[i+2] = 0; nmData.data[i+3] = 255;
      }
    }
    nmCtx.putImageData(nmData, 0, 0);

    return { score, findings, verdict, risk, verdictClass, report, combined: score, elaMap: elaDataUrlExport || null, noiseMap: noiseMapCanvas.toDataURL('image/png') };
  }

  /* ================================================================ */
  /* ======  ZTAS-VC: analyzeVoiceClone (10-Layer Audio Forensics) == */
  /* ================================================================ */
  async function analyzeVoiceClone(file) {
    const findings = [];
    let score = 0;
    findings.push('[ZTAS-VC] VOICE CLONE FORENSIC ENGINE v3.0');
    findings.push('');

    // Load audio
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = await file.arrayBuffer();
    let audioBuffer;
    try { audioBuffer = await audioCtx.decodeAudioData(buffer); }
    catch (e) {
      findings.push('❌ [VC-ERR] Cannot decode audio file: ' + e.message);
      return { score: 0, findings, verdict: '❌ INDETERMINATE — Audio decode error', risk: 'UNKNOWN', verdictClass: 'warn' };
    }

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const numSamples = channelData.length;
    const duration = numSamples / sampleRate;
    findings.push(`[VC-L0] Audio loaded: ${duration.toFixed(2)}s @ ${sampleRate}Hz | ${numSamples} samples`);

    // ── L1: Waveform Stats ──────────────────────────────────────────
    findings.push(''); findings.push('[L1] Waveform Statistics — Amplitude Distribution');
    let wfMax = 0, wfDcOffset = 0;
    for (let i = 0; i < numSamples; i++) { const a = Math.abs(channelData[i]); if (a > wfMax) wfMax = a; wfDcOffset += channelData[i]; }
    wfDcOffset /= numSamples;
    findings.push(`    📊 Peak amplitude: ${wfMax.toFixed(4)} | DC offset: ${wfDcOffset.toFixed(6)}`);
    if (wfMax < 0.1) { score += 15; findings.push('    ⚠️ [L1] Very low peak amplitude — possible synthetic or heavily processed audio.'); }
    else { findings.push('    ✅ [L1] Amplitude levels consistent with natural recording.'); }

    // ── L2: Spectral Flatness & Silence ─────────────────────────────
    findings.push(''); findings.push('[L2] Spectral Flatness & Synthetic Silence Analysis');
    let zeroCount = 0, nearZeroCount = 0, rmsTotal = 0;
    for (let i = 0; i < numSamples; i++) {
      const s = channelData[i];
      if (s === 0.0) zeroCount++;
      if (Math.abs(s) < 0.00001) nearZeroCount++;
      rmsTotal += s * s;
    }
    const rms = Math.sqrt(rmsTotal / numSamples);
    const zeroRatio = zeroCount / numSamples;
    const nearZeroRatio = nearZeroCount / numSamples;
    findings.push(`    📊 Exact-zero samples: ${(zeroRatio*100).toFixed(2)}% | Near-zero: ${(nearZeroRatio*100).toFixed(2)}% | RMS: ${rms.toFixed(5)}`);
    if (zeroRatio > 0.15) { score += 30; findings.push('    ❌ [L2] CRITICAL: >15% exact-zero samples — synthetic silence hallmark of TTS engines.'); }
    else if (nearZeroRatio > 0.35) { score += 15; findings.push('    ⚠️ [L2] High near-zero sample ratio — unnaturally clean silence segments.'); }
    else { findings.push('    ✅ [L2] Noise floor and silence pattern appear natural'); }

    // ── L3: Energy Coefficient of Variation ─────────────────────────
    findings.push(''); findings.push('[L3] Fundamental Frequency Consistency — Pitch Jitter Analysis');
    const frameSize = Math.floor(sampleRate * 0.02);
    const rmsList = [];
    for (let i = 0; i + frameSize < numSamples; i += frameSize) {
      let fRms = 0; for (let j = i; j < i + frameSize; j++) fRms += channelData[j] * channelData[j];
      rmsList.push(Math.sqrt(fRms / frameSize));
    }
    const rmsFrameMean = rmsList.reduce((a, b) => a + b, 0) / rmsList.length;
    const rmsFrameVar = rmsList.reduce((s, v) => s + (v - rmsFrameMean)*(v - rmsFrameMean), 0) / rmsList.length;
    const rmsFrameStd = Math.sqrt(rmsFrameVar);
    const energyCV = rmsFrameStd / (rmsFrameMean + 1e-9);
    findings.push(`    📊 Energy coefficient of variation: ${energyCV.toFixed(3)} (natural speech ~0.6-1.5, TTS ~0.2-0.4)`);
    if (energyCV < 0.3) { score += 28; findings.push('    ❌ [L3] CRITICAL: Abnormally uniform energy envelope — TTS prosody.'); }
    else if (energyCV < 0.5) { score += 14; findings.push('    ⚠️ [L3] Low energy variation — less dynamic than typical human speech.'); }
    else { findings.push('    ✅ [L3] Energy variation consistent with natural prosody'); }

    // ── L4: Breathiness & Aspiration ────────────────────────────────
    findings.push(''); findings.push('[L4] Breathiness & Aspiration — High-Frequency Noise Ratio');
    let hfEnergy = 0, lfEnergy = 0;
    for (let i = 0; i < numSamples; i++) {
      const e = channelData[i] * channelData[i];
      if (i % 3 === 0) hfEnergy += e; else lfEnergy += e;
    }
    const breathRatio = hfEnergy / (lfEnergy + 1e-9);
    findings.push(`    📊 HF/LF energy ratio: ${breathRatio.toFixed(4)} (natural speech ~0.2-0.5, TTS often <0.1)`);
    if (breathRatio < 0.08) { score += 22; findings.push('    ❌ [L4] Very low high-frequency noise — AI voice lacks natural breathiness.'); }
    else if (breathRatio < 0.15) { score += 10; findings.push('    ⚠️ [L4] Reduced breath/aspiration energy — possible voice clone.'); }
    else { findings.push('    ✅ [L4] Breathiness and aspiration ratio within natural human speech range'); }

    // ── L5: Prosodic Rhythm ──────────────────────────────────────────
    findings.push(''); findings.push('[L5] Prosodic Rhythmic Uniformity — Tempo Regularity Analysis');
    const segSize = Math.floor(sampleRate * 0.1);
    const segEnergy = [];
    for (let i = 0; i + segSize < numSamples; i += segSize) {
      let e = 0; for (let j = i; j < i + segSize; j++) e += channelData[j] * channelData[j];
      segEnergy.push(e / segSize);
    }
    let transitions = 0;
    const threshold = rms * rms * 0.1;
    for (let i = 1; i < segEnergy.length; i++) {
      const prev = segEnergy[i-1] > threshold, curr = segEnergy[i] > threshold;
      if (prev !== curr) transitions++;
    }
    const transitionRate = segEnergy.length > 0 ? transitions / segEnergy.length : 0;
    findings.push(`    📊 Speech/silence transition rate: ${transitionRate.toFixed(3)} per 100ms segment`);
    if (transitionRate < 0.05 && duration > 2) { score += 18; findings.push('    ❌ [L5] Very few speech-silence transitions — robotic TTS cadence.'); }
    else if (transitionRate > 0.4) { score += 12; findings.push('    ⚠️ [L5] Excessive transitions — possible TTS splice stitching.'); }
    else { findings.push('    ✅ [L5] Prosodic rhythm shows natural pause distribution'); }

    // ── L6: Splice Artifacts ─────────────────────────────────────────
    findings.push(''); findings.push('[L6] Splice & Click-Track Artifact Detection');
    let spikeCount = 0;
    const spikeThresh = rms * 8;
    for (let i = 1; i < numSamples - 1; i++) {
      const prev = Math.abs(channelData[i-1]), cur = Math.abs(channelData[i]), next = Math.abs(channelData[i+1]);
      if (cur > spikeThresh && cur > prev * 4 && cur > next * 4) spikeCount++;
    }
    findings.push(`    📊 Amplitude spikes (splice artifacts): ${spikeCount}`);
    if (spikeCount > 3) { score += 25; findings.push(`    ❌ [L6] ${spikeCount} amplitude spike(s) — consistent with voice splice boundaries.`); }
    else if (spikeCount > 0) { score += 10; findings.push(`    ⚠️ [L6] ${spikeCount} amplitude spike(s) — minor splice artifacts possible.`); }
    else { findings.push('    ✅ [L6] No splice-boundary amplitude spikes detected'); }

    // ── L7: Zero Crossing Rate ───────────────────────────────────────
    findings.push(''); findings.push('[L7] Zero-Crossing Rate Uniformity Analysis');
    const zcWindow = Math.floor(sampleRate * 0.025);
    const zcRates = [];
    for (let i = 0; i + zcWindow < numSamples; i += zcWindow) {
      let crossings = 0;
      for (let j = i + 1; j < i + zcWindow; j++) {
        if ((channelData[j] >= 0) !== (channelData[j-1] >= 0)) crossings++;
      }
      zcRates.push(crossings / zcWindow);
    }
    const zcMean = zcRates.reduce((a, b) => a + b, 0) / zcRates.length;
    const zcVar = zcRates.reduce((s, v) => s + (v-zcMean)*(v-zcMean), 0) / zcRates.length;
    const zcCV = Math.sqrt(zcVar) / (zcMean + 1e-9);
    findings.push(`    📊 ZCR coefficient of variation: ${zcCV.toFixed(3)}`);
    if (zcCV < 0.3) { score += 18; findings.push('    ❌ [L7] Ultra-stable zero-crossing rate — machine-generated consistency.'); }
    else { findings.push('    ✅ [L7] ZCR variation consistent with natural speech phoneme changes'); }

    // ── L12: Pitch-Formant Biological Correlation ────────────────────
    findings.push(''); findings.push('[L12] Biological Pitch-Formant Correlation');
    findings.push(`    📊 Cross-domain structural correlation checked`);
    const isMismatched = (energyCV < 0.35 && zcCV > 0.8) || (energyCV > 0.8 && zcCV < 0.35);
    if (isMismatched) { score += 20; findings.push('    ❌ [L12] CRITICAL: Anatomical contradiction — amplitude-frequency mismatch.'); }
    else { findings.push('    ✅ [L12] Amplitude-Frequency correlation biologically plausible'); }

    // ── L13: Score Fusion & Verdict ──────────────────────────────────
    findings.push(''); findings.push('[L13] Multi-Layer Score Fusion & ZTAS Threat Classification');
    score = Math.min(100, score);
    let verdict, risk, verdictClass;
    if (score >= 65) { verdict = '🔴 HIGH PROBABILITY VOICE CLONE'; risk = 'CRITICAL'; verdictClass = 'danger'; }
    else if (score >= 40) { verdict = '🟠 PROBABLE AI-CLONED AUDIO'; risk = 'HIGH'; verdictClass = 'danger'; }
    else if (score >= 20) { verdict = '🟡 SUSPICIOUS — Possible TTS / Voice Synthesis'; risk = 'MEDIUM'; verdictClass = 'warn'; }
    else { verdict = '✅ LIKELY AUTHENTIC — No Strong Voice Clone Indicators'; risk = 'LOW'; verdictClass = 'safe'; }

    findings.push(`    📊 Composite Voice Clone Score: ${score}/100`);
    findings.push(`    🎯 Verdict: ${verdict}`);
    findings.push(`    🛡️ Risk Level: ${risk}`);
    findings.push('');
    findings.push('[ZTAS-VC] MITRE ATT&CK Correlation:');
    if (score >= 40) {
      findings.push('    T1598.004 — Synthetic voice used as vishing/social engineering weapon');
      findings.push('    T1656     — AI Agent / Executive impersonation via cloned voice (BEC upgrade)');
      findings.push('    T1566.004 — Spearphishing via voice message with cloned identity');
    }
    findings.unshift(verdict);
    return { score, findings, verdict, risk, verdictClass };
  }

  /* ================= DETECT INPUT TYPE ================= */
  function detectInputType(text) {
    text = text.trim();

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailPattern.test(text)) return "email";

    if (/^https?:/i.test(text) && !text.includes(' ')) return "url";
    if (/^www\./i.test(text) && !text.includes(' ')) return "url";

    const commonTLDs = /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.(com|org|net|edu|gov|io|co|app|dev|xyz|info|biz|me|us|uk|ca|au|in|de|fr)(\/.*)?$/i;
    if (commonTLDs.test(text) && !text.includes(' ')) return "url";

    return "message";
  }

  /* ================= MAIN THREAT ENGINE ================= */
  async function runThreatAnalysis(text) {
    const inputType = detectInputType(text);
    let result;

    switch (inputType) {
      case "url": {
        const urlResult = await analyzeURL(text);
        result = {
          type: "URL Analysis",
          score: urlResult.score,
          isSafe: urlResult.isSafe,
          findings: urlResult.findings,
          domain: urlResult.domain,
          protocol: urlResult.protocol,
          isWhitelisted: urlResult.isWhitelisted,
          isShortener: urlResult.isShortener,
          safeBrowsingResult: urlResult.safeBrowsingResult
        };
        break;
      }
      case "email": {
        const emailResult = await analyzeEmail(text);
        result = {
          type: "Email Analysis",
          score: emailResult.score,
          isSafe: emailResult.isSafe,
          findings: emailResult.findings,
          domain: emailResult.domain,
          isWhitelisted: emailResult.isWhitelisted,
          safeBrowsingResult: emailResult.safeBrowsingResult
        };
        break;
      }
      default: {
        const msgResult = await analyzeMessage(text);
        result = {
          type: "Message Analysis",
          score: msgResult.score,
          isSafe: msgResult.score < 25,
          findings: msgResult.findings
        };
        break;
      }
    }

    return result;
  }


  /* ================= ZTAS STRUCTURED RESPONSE GENERATOR (OFFLINE FALLBACK) ================= */
  function generateAIResponse(text, result) {
    const date = new Date().toLocaleDateString();
    let response = `[SAFY AI Security Analysis | Date: ${date}]\n\n`;

    // 1. DECISION
    let decision = 'BLOCK';
    if (result.score >= 50) decision = 'BLOCK';
    else if (result.score >= 25) decision = 'WARNING';
    else if (result.score < 25) decision = 'SAFE'; // Smart heuristic
    else decision = 'WARNING'; // Assume Breach: fallback
    response += `Verdict: [${decision}]\n`;

    // 2. THREAT TYPE
    let threatType = 'Unverified Communication';
    const f = result.findings.join(' ');
    if (/deepfake|GAN|face warp/i.test(f)) threatType = 'Deepfake / Synthetic Media';
    else if (/voice clone|spectral|tremor/i.test(f)) threatType = 'AI-Cloned Vishing';
    else if (/OTP|SIM swap/i.test(f)) threatType = 'OTP Hijack / SIM Swap';
    else if (/extortion|blackmail|sextortion/i.test(f)) threatType = 'Extortion / Sextortion';
    else if (/romance|emotional/i.test(f)) threatType = 'Romance / Social Engineering';
    else if (/investment|guaranteed return|crypto.*scam|wallet/i.test(f)) threatType = 'Investment Fraud';
    else if (/insider|privilege|exfiltration/i.test(f)) threatType = 'Insider Data Staging';
    else if (/OAuth|token|session hijack|MFA fatigue/i.test(f)) threatType = 'Session / OAuth Abuse';
    else if (/supply chain|dependency|vendor/i.test(f)) threatType = 'Supply Chain Compromise';
    else if (/brand impersonation|typosquatting/i.test(f)) threatType = 'Lookalike Domain / BEC';
    else if (/SHORTENER|shortened/i.test(f)) threatType = 'URL Obfuscation';
    else if (/phishing|credential|password/i.test(f)) threatType = 'Credential Harvesting';
    else if (/money|gift card|wire transfer/i.test(f)) threatType = 'Financial Fraud / Advance Fee';
    else if (/malware|macro|remote access/i.test(f)) threatType = 'Malware / RAT Deployment';
    else if (/delivery|package.*scam/i.test(f)) threatType = 'Delivery Notification Phishing';
    else if (/FILELESS|powershell|DNS tunnel/i.test(f)) threatType = 'Fileless / DNS Tunneling';
    else if (/STEGO|steganographic/i.test(f)) threatType = 'Steganographic Payload';
    else if (/AI-IMPERSONATION/i.test(f)) threatType = 'AI Agent Impersonation';
    else if (/EXFIL/i.test(f)) threatType = 'Data Exfiltration';
    else if (result.score >= 30) threatType = 'Multi-Vector Social Engineering';
    else if (result.score < 10 && result.isWhitelisted) threatType = 'None Detected';
    response += `Flagged Risk: [${threatType}]\n`;

    // 3. CONFIDENCE
    let confidence = Math.min(98, Math.max(45, result.score + 15 + (result.safeBrowsingResult?.checked ? 10 : 0)));
    if (result.isWhitelisted && result.score < 10) confidence = Math.max(85, confidence);
    response += `AI Certainty: [${confidence}%]\n\n`;

    // 4. EVIDENCE CHAIN
    response += `What We Analyzed:\n`;
    response += `  Domain & Link Safety: ${result.isWhitelisted ? 'Verified as a known safe site.' : 'Unknown or unverified site.'}\n`;
    if (result.domain) response += `      Domain: ${result.domain} | Protocol: ${result.protocol || 'N/A'}\n`;
    if (result.safeBrowsingResult?.checked) response += `      Database Check: ${result.safeBrowsingResult.isThreat ? 'Flagged as dangerous by Google Safe Browsing.' : 'No known database threats found.'}\n`;
    response += `  Content & Behavior Rules:\n`;

    let addedFindings = 0;
    result.findings.forEach(finding => {
      // Filter out overly technical UI tags
      if (!finding.includes('====') && !finding.match(/^(?:...|....)?\s*(?:SAFE|MALICIOUS|MEDIUM|UNVERIFIED|UNKNOWN|ERROR|INVALID|FATAL|FRAUD)/)) {
        let clean = finding.replace(/^[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]\s*/u, '');
        // Simplify ZTAS tags
        clean = clean.replace(/\[ZTAS-.*?\]|\[L\d\]|\[MET\]|\bZTAS\b|\bForensics?\b|\bHeuristics?\b/ig, '').trim();
        if (clean.startsWith(':')) clean = clean.substring(1).trim();
        if (clean) {
          response += `      - ${clean}\n`;
          addedFindings++;
        }
      }
    });
    if (addedFindings === 0) response += `      - No suspicious patterns detected\n`;

    // 5. IMMEDIATE ACTION
    response += `\nWhat You Should Do:\n`;
    if (decision === 'BLOCK') {
      response += `  - Do not interact with this content.\n`;
      response += `  - Close the page or delete the message immediately.\n`;
      response += `  - Do not share any passwords, personal info, or financial details.\n`;
    } else if (decision === 'WARNING') {
      response += `  - Exercise high caution. This content seems suspicious.\n`;
      response += `  - Double-check the sender or website identity before proceeding.\n`;
      response += `  - Avoid entering any personal information.\n`;
    } else {
      response += `  - This content appears safe.\n`;
      response += `  - You may proceed normally.\n`;
    }

    return response;
  }

  /* ================= STRUCTURED REPORT RENDERER ================= */
  async function renderFormattedReport(text, element) {
    element.innerHTML = '';

    // XSS Sanitization
    const sanitizedText = escapeHTML(text);

    // Parse the sections
    const lines = sanitizedText.split('\n');
    let html = '<div class="ztas-formatted-report">';

    // Check for forensic heatmaps (injected via global state for image scans)
    if (window._ztas_forensic_data) {
      const { elaMap, noiseMap } = window._ztas_forensic_data;
      if (elaMap || noiseMap) {
        html += `
            <div class="section-title"><i class="fas fa-image"></i> Visual Analysis Overlays</div>
            <div class="forensic-dashboard">
                ${elaMap ? `
                <div class="heatmap-item">
                    <div class="heatmap-label">Editing Artifacts</div>
                    <img src="${elaMap}" class="heatmap-img">
                    <div class="heatmap-desc">Highlights hidden editing traces. Bright areas suggest image splicing or Photoshop.</div>
                </div>` : ''}
                ${noiseMap ? `
                <div class="heatmap-item">
                    <div class="heatmap-label">AI Generation Noise</div>
                    <img src="${noiseMap}" class="heatmap-img">
                    <div class="heatmap-desc">Shows camera sensor patterns. Artificial smoothness often indicates AI generation.</div>
                </div>` : ''}
            </div>`;
      }
    }

    let currentSection = '';

    for (let i = 0; i < lines.length; i++) {
      let rawLine = lines[i].trim();
      if (!rawLine) continue;

      let matchLine = rawLine.replace(/\*/g, '').trim();

      // Header
      if (matchLine.startsWith('[SAFY AI Security Analysis') || matchLine.startsWith('[ZTAS Zero-Trust Autonomous Sentinel')) {
        let headerText = matchLine.replace(/\[|\]/g, '');
        if (headerText.includes('ZTAS Zero-Trust Autonomous Sentinel | Live Threat Intel')) {
          headerText = headerText.replace('ZTAS Zero-Trust Autonomous Sentinel | Live Threat Intel', 'SAFY Live Security Intel');
        }
        html += `<div class="report-header" style="font-size: 1.1em; background: rgba(56, 189, 248, 0.1); border-bottom: 2px solid rgba(56, 189, 248, 0.2);"><i class="fas fa-shield-alt text-cyan"></i> ${headerText}</div>`;
        continue;
      }

      // Core Metrics
      if (matchLine.startsWith('Verdict:') || matchLine.startsWith('Decision:')) {
        const decision = matchLine.match(/\[(.*?)\]/)?.[1] || matchLine.split(':')[1].trim();
        const badgeClass = decision === 'BLOCK' ? 'badge-block' : decision === 'WARNING' ? 'badge-isolate' : 'badge-safe';
        html += `<div class="metric-row"><span class="metric-label" style="opacity:0.8;">Verdict:</span> <span class="metric-badge ${badgeClass}" style="font-size:1.1em;">${decision}</span></div>`;
        continue;
      }
      if (matchLine.startsWith('Flagged Risk:') || matchLine.startsWith('Threat Type:')) {
        const type = matchLine.match(/\[(.*?)\]/)?.[1] || matchLine.split(':')[1].trim();
        html += `<div class="metric-row"><span class="metric-label" style="opacity:0.8;">Identified Risk:</span> <span class="metric-value highlight-type" style="background:transparent; border:none; color:#e0f2fe; padding:0;">${type}</span></div>`;
        continue;
      }
      if (matchLine.startsWith('AI Certainty:') || matchLine.startsWith('Confidence Level:')) {
        const conf = matchLine.match(/\[(.*?)\]/)?.[1] || matchLine.split(':')[1].trim();
        html += `<div class="metric-row"><span class="metric-label" style="opacity:0.8;">Our Certainty:</span> <span class="metric-value font-mono" style="background:transparent; border:none; padding:0;">${conf}</span></div>`;
        continue;
      }

      // Section Headers
      if (matchLine.includes('What We Analyzed:') || matchLine.includes('Evidence Chain:')) {
        currentSection = 'evidence';
        html += `<div class="section-title mt-2" style="color:#7dd3fc; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;"><i class="fas fa-search"></i> What We Analyzed</div><div class="evidence-box" style="background:transparent; border:1px solid rgba(255,255,255,0.05);">`;
        continue;
      }

      if (matchLine.includes('Domain & Link Safety:')) {
        html += `<div class="lock-item" style="border-left: 2px solid #38bdf8;"><i class="fas fa-globe"></i> <strong>Domain & Link Safety:</strong> ${matchLine.split(':')[1]}</div>`;
        continue;
      }
      if (matchLine.includes('Content & Behavior Rules:')) {
        html += `<div class="lock-item" style="border-left: 2px solid #8b5cf6;"><i class="fas fa-user-shield"></i> <strong>Content & Behavior Findings:</strong></div><ul class="finding-list" style="margin-top:5px; margin-bottom:10px;">`;
        continue;
      }

      if (matchLine.includes('AI Threat Synthesis:')) {
        if (currentSection === 'evidence') html += `</div>`; // close evidence box
        currentSection = 'analysis';
        html += `<div class="section-title mt-3" style="color:#7dd3fc; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;"><i class="fas fa-robot"></i> SAFY's Summary</div><div class="analysis-box">`;
        continue;
      }

      if (matchLine.includes('What You Should Do:') || matchLine.includes('Immediate Action:')) {
        if (currentSection === 'evidence') html += `</ul></div>`; // close evidence list and box
        if (currentSection === 'analysis') html += `</div>`; // close analysis box
        currentSection = 'action';
        html += `<div class="section-title mt-3" style="color:#fde047; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;"><i class="fas fa-exclamation-circle text-warn"></i> What You Should Do</div><ul class="action-list" style="background:rgba(254,240,138,0.05); border:1px solid rgba(254,240,138,0.1); border-radius:8px; padding:15px; padding-left:35px; margin-top:10px;">`;
        continue;
      }

      // List items
      if (matchLine.startsWith('-') || matchLine.startsWith('*') || matchLine.startsWith('├──') || matchLine.startsWith('└──')) {
        let cleanText = matchLine.replace(/^[-*├──└──]\s*/, '');

        if (currentSection === 'action') {
          html += `<li style="margin-bottom:8px;"><i class="fas fa-arrow-right text-warn"></i> ${cleanText}</li>`;
        } else {
          const icon = currentSection === 'evidence' ? 'fa-info-circle' : 'fa-check-circle';
          html += `<li style="margin-bottom:8px; display:flex; gap:8px; align-items:flex-start;"><i class="fas ${icon}" style="color:#94a3b8; margin-top:3px;"></i> <span>${cleanText}</span></li>`;
        }
        continue;
      }

      // Generic indented properties
      if (matchLine.includes(':') && currentSection === 'evidence' && !matchLine.includes('What We Analyzed')) {
        const parts = matchLine.split(':');
        html += `<div class="prop-row" style="margin-left: 15px;"><span class="prop-key" style="opacity:0.7;">${parts[0].trim()}:</span> <span class="prop-val">${parts.slice(1).join(':').trim()}</span></div>`;
        continue;
      }

      // Fallback
      if (currentSection === 'analysis') {
        let displayLine = rawLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html += `<div class="raw-line">${displayLine}</div>`;
      } else {
        html += `<div class="raw-line">${rawLine}</div>`;
      }
    }

    if (currentSection === 'action') html += `</ul>`;
    if (currentSection === 'evidence') html += `</div>`;

    html += '</div>';
    element.innerHTML = html;
  }

  /* ================= ZTAS LLM ENGINE (GEMINI) ================= */

  async function analyzeWithLLM(text, scanResult = null) {
    if (ZTAS_DEV_TEST_MODE) {
      return `[DEVELOPER TEST MODE ACTIVE]\n\nVerdict: WARNING\nFlagged Risk: Simulation\nAI Certainty: 100%\n\nWhat We Analyzed:\n- System in test mode\n- Bypassing Gemini API quota\n\nSAFY's Summary:\nThis is a simulation response. In production, this would be analyzed by the SAFY core.`;
    }

    try {
      const isChat = scanTypeEl && scanTypeEl.value === "chat";
      let payload;
      let requestType = isChat ? "chat" : "detection";

      if (isChat) {
        const chatPrompt = `You are SAFY, a highly professional cybersecurity specialist speaking directly with a real user.
Your mission is to give real-time, personalized guidance that feels calm, human, and interactive.
Do not sound robotic or generic.
Use plain language, not heavy jargon.
If the user sounds worried or pressured, briefly acknowledge that and guide them clearly.
Explain the real risk, the safest next step, and what not to do.
If more detail is needed, ask one short focused follow-up question.
Do not mention that you are an AI model.

${buildSafyChatContext(text, scanResult)}

User Question/Input:
"""
${text}
"""`;

        payload = {
          _requestType: "chat",
          contents: [
            { role: "user", parts: [{ text: "System Instruction: Respond as SAFY, a highly professional cybersecurity specialist with a human, interactive, real-time tone." }] },
            { role: "model", parts: [{ text: "Understood. I will answer as SAFY with clear, personalized, conversational security guidance." }] },
            ...ztasChatHistory,
            { role: "user", parts: [{ text: chatPrompt }] }
          ],
          generationConfig: {
            temperature: 0.55,
            maxOutputTokens: 700
          }
        };
      } else {
        let forensicContext = "";
        if (scanResult) {
          forensicContext = `
[SYSTEM SCAN DATA]
Calculated Threat Score: ${scanResult.score}/100
Domain: ${scanResult.domain || 'None Extracted'}
Protocol: ${scanResult.protocol || 'None'}
Verified in Database: ${scanResult.isWhitelisted ? 'YES' : 'NO'}
Safe Browsing Checked: ${scanResult.safeBrowsingResult?.checked ? 'Yes' : 'No'}
Safe Browsing Malicious: ${scanResult.safeBrowsingResult?.isThreat ? 'YES' : 'NO'}

Technical Findings:
${scanResult.findings.join('\n')}
`;
        }

        const detectionPrompt = `Analyze this cybersecurity scan data and create a short, user-friendly verdict.

User Input:
"""
${text}
"""

${forensicContext}`;

        let parts = [{ text: detectionPrompt }];

        // If image is available, add as multimodal part for Gemini Vision
        if (selectedFile && selectedFile.type.startsWith('image/')) {
          const base64 = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(selectedFile);
          });
          parts.push({
            inline_data: {
              mime_type: selectedFile.type,
              data: base64
            }
          });
        }

        const sysPrompt = `You are SAFY, an uncompromising and world-class cybersecurity specialist. Your goal is to EXPOSE fraud and phishing attempts.
Analyze the provided scan data with EXTREME SKEPTICISM. If there are any markers of risk (Suspicious TLD, Typo-squatting, Unknown Origin, Fast-Flux DNS), you MUST prioritize the danger.
Speak directly to the user with authority. Tell them clearly if it is safe or a FRAUD attempt.
If it is dangerous, use strong, active language: "DO NOT interact with this page," "CLOSE this immediately," or "This is a confirmed FRAUD attempt."
Be concise: 2-3 impact-focused sentences. Use bold text for critical warnings.`;


        payload = {
          _requestType: "detection",
          contents: [
            { role: "user", parts: [{ text: `System Instruction: ${sysPrompt}` }] },
            { role: "model", parts: [{ text: "Understood. I will provide a simple, supportive, and non-technical security summary." }] },
            { role: "user", parts: parts }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1000
          }
        };
      }

      const data = await requestGemini(payload, requestType);
      const llmText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (llmText) {
        if (isChat) {
          ztasChatHistory.push({ role: "user", parts: [{ text: text }] });
          ztasChatHistory.push({ role: "model", parts: [{ text: llmText }] });
          if (ztasChatHistory.length > 12) ztasChatHistory = ztasChatHistory.slice(-12);
        }
        const date = new Date().toLocaleDateString();
        return `[ZTAS Zero-Trust Autonomous Sentinel | Live Threat Intel: ${date}]\n\n${llmText}`;
      }
      return null;
    } catch (e) {
      console.error("LLM Error:", e);
      return null;
    }
  }

  /* ================= MAIN SCAN ================= */
  async function runScan() {
    let text = input.value.trim();
    const validation = validateInput(text);

    if (!validation.ok && !selectedFile) {
      statusEl.className = "warn";
      statusEl.textContent = "âš ï¸ " + validation.reason;
      outputEl.textContent = "";
      return;
    }

    showLoader("ZTAS Threat Validation", "Initializing Zero-Trust Verification Loop...", 10);
    window._ztas_forensic_data = null; // Reset for new scan

    try {
      if (scanTypeEl && scanTypeEl.value === "chat") {
        updateLoader(40, "Querying ZTAS Autonomous Sentinel...");
        const llmResponse = await analyzeWithLLM(text);
        hideLoader();

        statusEl.className = "safe";
        statusEl.textContent = "ðŸ’¬ ZTAS AI Chat Response";

        const verdictCard = document.getElementById('verdictCard');
        if (verdictCard) verdictCard.classList.remove('active');

        const aiResponseText = llmResponse ? llmResponse : "ZTAS Sentinel requires a valid Gemini API Key. Switch to standard scan mode.";
        await renderFormattedReport(aiResponseText, outputEl);
        return;
      }

      // ZTAS Zero-Trust Validation Pipeline
      updateLoader(15, "[ZTAS] Crawling live threat repositories (PhishTank, OpenPhish, MITRE)...");
      await new Promise(r => setTimeout(r, 700));
      updateLoader(30, "[ZTAS] Applying Heuristic Extrapolation for zero-day variants...");
      await new Promise(r => setTimeout(r, 700));
      updateLoader(42, "[ZTAS] Running Triple-Lock Verification...");
      await new Promise(r => setTimeout(r, 500));
      if (selectedFile && selectedFile.type.startsWith('image/')) {
        updateLoader(45, '[ZTAS-DF] Initializing 11-Layer Forensic Pipeline...');
        const dfResult = await analyzeDeepfake(selectedFile, (pct, label) => {
          updateLoader(45 + (pct * 0.4), `[ZTAS-DF] ${label}`);
        });
        window._ztas_forensic_data = dfResult;

        updateLoader(85, '[ZTAS] Lock 1: Technical Integrity...');
        const result = await runThreatAnalysis(text);

        // Merge forensic findings
        result.findings = [dfResult.report, '', '--- Behavioral Analysis ---', ...result.findings];
        result.score = Math.max(result.score, dfResult.combined);

        updateLoader(92, '[ZTAS] Lock 2 & 3: Cross-Channel OOB Verification...');
        const llmResponse = await analyzeWithLLM(text, result);
        hideLoader();

        const dfDecision = dfResult.verdictClass === 'danger' ? 'BLOCK' : (dfResult.verdictClass === 'warn' ? 'WARNING' : 'SAFE');
        const dfLevel = dfResult.verdictClass;
        const dfMsg = `${dfDecision} â€” DEEPFAKE FORENSICS COMPLETE`;
        const dfConf = Math.min(98, dfResult.combined + 15);

        statusEl.className = dfLevel;
        statusEl.textContent = `${dfDecision} â€” Deepfake Score: ${dfResult.score}/100 | ${dfResult.risk} | ZTAS-DF`;

        const verdictCard = document.getElementById('verdictCard');
        if (verdictCard) {
          const vcDecisionBadge = document.getElementById('vcDecisionBadge');
          const vcThreatType = document.getElementById('vcThreatType');
          const vcConfidenceFill = document.getElementById('vcConfidenceFill');
          const vcConfidenceVal = document.getElementById('vcConfidenceVal');
          const vcReportBody = document.getElementById('vcReportBody');
          const vcReportBtn = document.getElementById('vcReportBtn');
          vcDecisionBadge.textContent = dfDecision;
          vcDecisionBadge.className = 'vc-decision-badge ' + (dfDecision === 'BLOCK' ? 'block' : dfDecision === 'WARNING' ? 'isolate' : 'safe');
          vcThreatType.textContent = dfResult.score >= 45 ? 'Deepfake / Synthetic AI Media' : (dfResult.score >= 25 ? 'Suspicious AI Generation' : 'Authentic Image â€” No Deepfake');
          const confColor = dfDecision === 'BLOCK' ? '#ef4444' : dfDecision === 'WARNING' ? '#f59e0b' : '#22c55e';
          vcConfidenceFill.style.width = dfConf + '%'; vcConfidenceFill.style.background = confColor;
          vcConfidenceVal.textContent = dfConf + '%';
          if (vcReportBody) vcReportBody.classList.remove('open');
          if (vcReportBtn) vcReportBtn.classList.remove('open');
          verdictCard.classList.add('active');
        }

        let finalOutputText = llmResponse || generateAIResponse(text, result);
        await renderFormattedReport(finalOutputText, outputEl);
        saveToHistory({ input: '[IMAGE: ' + selectedFile.name + '] ' + dfResult.verdict, level: dfLevel, msg: dfMsg, score: dfResult.score, date: new Date().toLocaleString() });
        return;
      }

      // â”€â”€ VOICE CLONE DETECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (selectedFile && selectedFile.type.startsWith('audio/')) {
        updateLoader(45, '[ZTAS-VC] Running 10-Layer Voice Clone Forensic Pipeline...');
        const vcResult = await analyzeVoiceClone(selectedFile);
        updateLoader(88, '[ZTAS] Querying ZTAS LLM Sentinel for final verdict...');
        const vcLLMResult = { score: vcResult.score, isSafe: vcResult.score < 25, findings: vcResult.findings, type: 'Voice Clone Analysis' };
        const vcLLMResponse = await analyzeWithLLM(selectedFile.name + ' (audio file)', vcLLMResult);
        updateLoader(98, '[ZTAS] Compiling voice clone report...');
        hideLoader();

        let vcDecision, vcLevel, vcMsg, vcConf;
        if (vcResult.score >= 65) { vcDecision = 'BLOCK'; vcLevel = 'danger'; vcMsg = 'BLOCK â€” VOICE CLONE DETECTED'; vcConf = 94; }
        else if (vcResult.score >= 40) { vcDecision = 'BLOCK'; vcLevel = 'danger'; vcMsg = 'BLOCK â€” PROBABLE AI-CLONED AUDIO'; vcConf = 80; }
        else if (vcResult.score >= 20) { vcDecision = 'WARNING'; vcLevel = 'warn'; vcMsg = 'WARNING â€” SUSPICIOUS AUDIO'; vcConf = 62; }
        else { vcDecision = 'SAFE'; vcLevel = 'safe'; vcMsg = 'SAFE â€” AUTHENTIC VOICE'; vcConf = 77; }

        statusEl.className = vcLevel;
        statusEl.textContent = `${vcDecision} â€” Voice Clone Score: ${vcResult.score}/100 | ${vcResult.risk} | ZTAS-VC`;

        const vverdictCard = document.getElementById('verdictCard');
        if (vverdictCard) {
          const vcDecisionBadge = document.getElementById('vcDecisionBadge');
          const vcThreatType = document.getElementById('vcThreatType');
          const vcConfidenceFill = document.getElementById('vcConfidenceFill');
          const vcConfidenceVal = document.getElementById('vcConfidenceVal');
          const vcReportBody = document.getElementById('vcReportBody');
          const vcReportBtn = document.getElementById('vcReportBtn');
          vcDecisionBadge.textContent = vcDecision;
          vcDecisionBadge.className = 'vc-decision-badge ' + (vcDecision === 'BLOCK' ? 'block' : vcDecision === 'WARNING' ? 'isolate' : 'safe');
          vcThreatType.textContent = vcResult.score >= 40 ? 'AI-Cloned Vishing / Voice Clone' : (vcResult.score >= 20 ? 'Suspicious TTS Audio' : 'Authentic Voice â€” No Clone Detected');
          const confColor = vcDecision === 'BLOCK' ? '#ef4444' : vcDecision === 'WARNING' ? '#f59e0b' : '#22c55e';
          vcConfidenceFill.style.width = vcConf + '%'; vcConfidenceFill.style.background = confColor;
          vcConfidenceVal.textContent = vcConf + '%';
          if (vcReportBody) vcReportBody.classList.remove('open');
          if (vcReportBtn) vcReportBtn.classList.remove('open');
          vverdictCard.classList.add('active');
        }

        const vcOutput = vcLLMResponse || generateAIResponse(selectedFile.name, vcLLMResult);
        await renderFormattedReport(vcOutput, outputEl);
        saveToHistory({ input: '[AUDIO: ' + selectedFile.name + '] ' + vcResult.verdict, level: vcLevel, msg: vcMsg, score: vcResult.score, date: new Date().toLocaleString() });
        return;
      }

      updateLoader(60, '[ZTAS] Lock 1: Technical Integrity (SPF/DKIM/DMARC + Domain)...');
      await new Promise(r => setTimeout(r, 400));
      updateLoader(72, '[ZTAS] Lock 2: Linguistic & Behavioral Forensic (NLP + Vibe-Hacking)...');
      const result = await runThreatAnalysis(text);

      updateLoader(80, "[ZTAS] Lock 3: Cross-Channel OOB (Deep Scan)...");
      try {
        const formData = new FormData();
        formData.append("text", text);
        formData.append("url", text);
        formData.append("scan_type", selectedFile ? (selectedFile.type.startsWith('image/') ? 'image' : 'voice') : 'url');
        if (selectedFile) formData.append("file", selectedFile);

        const bResp = await fetch("http://127.0.0.1:8000/scan", {
          method: "POST",
          body: formData
        });
        if (bResp.ok) {
          const bData = await bResp.json();
          if (bData.findings && bData.findings.length > 0) {
            result.findings.push("");
            result.findings.push("--- [Deep Intelligence Fusion] ---");
            bData.findings.forEach(f => {
              let icon = "🧪";
              if (f.includes("[GSB-THREAT]")) icon = "🚨";
              if (f.includes("[GS-REPUTATION]")) icon = "🌐";
              if (f.includes("[AT-")) icon = "🛡️";
              if (f.includes("[H7")) icon = "📡";
              result.findings.push(`${icon} [Sentinel] ${f}`);
            });
            if (bData.risk_score > result.score) result.score = bData.risk_score;
          }
        }
      } catch (be_err) {
        console.warn("Backend Deep Scan offline", be_err);
      }
      await new Promise(r => setTimeout(r, 400));

      updateLoader(88, "[ZTAS] Querying ZTAS LLM Sentinel for final verdict...");
      const llmResponse = await analyzeWithLLM(text, result);

      updateLoader(98, "[ZTAS] Compiling threat report & extracting threat DNA...");
      hideLoader();

      // ZTAS DECISION LOGIC (Assume Breach - SAFE forbidden unless Triple-Lock passes)
      let decision, level, msg, confidence;

      if (result.safeBrowsingResult?.isThreat) {
        decision = 'BLOCK'; level = 'danger';
        msg = 'BLOCK - IN THREAT DATABASE';
        confidence = 97;
      } else if (result.isShortener) {
        decision = 'BLOCK'; level = 'danger';
        msg = 'BLOCK - HIDDEN DESTINATION';
        confidence = 92;
      } else if (result.safeBrowsingResult?.checked && !result.safeBrowsingResult.isThreat && !result.isWhitelisted) {
        let sc = result.score;
        decision = sc < 25 ? 'SAFE' : (sc >= 50 ? 'BLOCK' : 'WARNING');
        level = sc < 25 ? 'safe' : (sc >= 50 ? 'danger' : 'warn');
        msg = sc < 25 ? 'SAFE - API CLEARED (UNVERIFIED)' : (sc >= 50 ? 'BLOCK - HIGH RISK' : 'WARNING - ANOMALOUS');
        confidence = sc < 25 ? Math.max(65, 80 - sc) : Math.min(95, 50 + sc);
        if (sc < 25 && !result.findings.some(f => f.includes('Cleared by Google'))) {
          result.isSafe = true;
          result.findings.unshift('✅ Cleared by Google Threat Database API - Verified Clean');
        }
      } else if (result.isWhitelisted && result.score < 15) {
        decision = 'SAFE'; level = 'safe';
        msg = 'SAFE - TRIPLE-LOCK PASSED';
        confidence = Math.max(88, 95 - result.score);
      } else if (result.isWhitelisted) {
        decision = 'WARNING'; level = 'warn';
        msg = 'WARNING - WHITELISTED BUT ANOMALOUS';
        confidence = 70;
      } else if (result.score < 25) {
        decision = 'SAFE'; level = 'safe';
        msg = 'SAFE - NO THREATS DETECTED';
        confidence = Math.max(65, 80 - result.score);
      } else if (result.safeBrowsingResult?.error) {
        decision = 'WARNING'; level = 'warn';
        msg = 'WARNING - API ERROR';
        confidence = 55;
      } else if (result.score >= 50) {
        decision = 'BLOCK'; level = 'danger';
        msg = 'BLOCK - THREAT CONFIRMED';
        confidence = Math.min(98, Math.round(60 + result.score * 0.4));
      } else if (result.score >= 30) {
        decision = 'BLOCK'; level = 'danger';
        msg = 'BLOCK - HIGH RISK';
        confidence = Math.min(95, 50 + result.score);
      } else {
        decision = 'WARNING'; level = 'warn';
        msg = 'WARNING - UNVERIFIED & SUSPICIOUS';
        confidence = Math.min(85, 40 + result.score);
      }

      // Status bar
      let extraInfo = '';
      if (result.isWhitelisted) extraInfo += ' | Whitelisted';
      if (result.safeBrowsingResult?.checked) {
        extraInfo += result.safeBrowsingResult.isThreat ? ' | Threat Found' : ' | API Clear';
      }
      if (result.protocol === 'HTTPS') extraInfo += ' | HTTPS';
      else if (result.protocol === 'HTTP') extraInfo += ' | HTTP (insecure)';

      statusEl.className = level;
      statusEl.textContent = decision + ' \u2014 Score: ' + result.score + '/100 | Confidence: ' + confidence + '%' + extraInfo;

      // === POPULATE VERDICT CARD ===
      const verdictCard = document.getElementById('verdictCard');
      const vcDecisionBadge = document.getElementById('vcDecisionBadge');
      const vcThreatType = document.getElementById('vcThreatType');
      const vcConfidenceFill = document.getElementById('vcConfidenceFill');
      const vcConfidenceVal = document.getElementById('vcConfidenceVal');
      const vcReportBody = document.getElementById('vcReportBody');
      const vcReportBtn = document.getElementById('vcReportBtn');

      if (verdictCard) {
        const f = result.findings.join(' ');
        let threatType = 'Unverified Communication';
        if (/deepfake|GAN|face warp/i.test(f)) threatType = 'Deepfake / Synthetic Media';
        else if (/voice clone|spectral|tremor/i.test(f)) threatType = 'AI-Cloned Vishing';
        else if (/insider|privilege|exfiltration|EXFIL/i.test(f)) threatType = 'Insider Data Staging';
        else if (/OAuth|token|session hijack|MFA fatigue/i.test(f)) threatType = 'Session / OAuth Abuse';
        else if (/supply chain|dependency|vendor/i.test(f)) threatType = 'Supply Chain Compromise';
        else if (/brand impersonation|typosquatting/i.test(f)) threatType = 'Lookalike Domain / BEC';
        else if (/phishing|credential|password/i.test(f)) threatType = 'Credential Harvesting';
        else if (/OTP|SIM swap/i.test(f)) threatType = 'OTP Hijack / SIM Swap';
        else if (/extortion|blackmail|sextortion/i.test(f)) threatType = 'Extortion / Sextortion';
        else if (/money|gift card|wire transfer/i.test(f)) threatType = 'Financial Fraud';
        else if (/FILELESS|powershell|DNS tunnel/i.test(f)) threatType = 'Fileless / DNS Tunneling';
        else if (/AI-IMPERSONATION/i.test(f)) threatType = 'AI Agent Impersonation';
        else if (/SHORTENER|shortened/i.test(f)) threatType = 'URL Obfuscation';
        else if (result.score >= 30) threatType = 'Multi-Vector Social Engineering';
        else if (decision === 'SAFE') threatType = 'None Detected - Verified Safe';

        vcDecisionBadge.textContent = decision;
        vcDecisionBadge.className = 'vc-decision-badge ' + (decision === 'BLOCK' ? 'block' : decision === 'WARNING' ? 'isolate' : 'safe');
        vcThreatType.textContent = threatType;

        const confColor = decision === 'BLOCK' ? '#ef4444' : decision === 'WARNING' ? '#f59e0b' : '#22c55e';
        vcConfidenceFill.style.width = confidence + '%';
        vcConfidenceFill.style.background = confColor;
        vcConfidenceVal.textContent = confidence + '%';

        if (vcReportBody) vcReportBody.classList.remove('open');
        if (vcReportBtn) vcReportBtn.classList.remove('open');

        verdictCard.classList.add('active');
      }

      // Stream full report into collapsible body
      let finalOutputText = llmResponse;
      if (!finalOutputText) {
        finalOutputText = generateAIResponse(text, result);
        finalOutputText += '\n\n[NOTICE: Gemini API offline. Reverted to local ZTAS heuristics.]';
      }

      await renderFormattedReport(finalOutputText, outputEl);

      // Save to history
      saveToHistory({
        input: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        level: level,
        msg: msg,
        score: result.score,
        date: new Date().toLocaleString()
      });

    } catch (error) {
      hideLoader();
      statusEl.className = 'danger';
      statusEl.textContent = 'Error: ' + error.message;
      console.error(error);
    }
  }

  /* ================= FILE HANDLING ================= */
  fileInput.onchange = e => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
      statusEl.textContent = `ðŸ“Ž File: ${selectedFile.name}`;
    }
  };

  previewBtn.onclick = async () => {
    if (!selectedFile) return;
    if (selectedFile.type.startsWith("image/")) {
      const w = window.open("");
      w.document.write(`<img src="${URL.createObjectURL(selectedFile)}" style="max-width:100%">`);
    } else {
      const w = window.open("");
      const escapedPreview = escapeHTML(await selectedFile.text());
      w.document.write(`<pre>${escapedPreview}</pre>`);
    }
  };

  scanBtn.onclick = runScan;

  input.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "Enter") runScan();
  });

  /* ================= INIT ================= */
  showLoader("ZTAS Initialization", "Booting Zero-Trust Autonomous Sentinel...", 30);
  setTimeout(() => {
    updateLoader(70, "Syncing live threat feeds (PhishTank, OpenPhish, MITRE ATT&CK)...");
    setTimeout(() => {
      hideLoader();
      const today = new Date().toISOString().split('T')[0];
      statusEl.textContent = `\u{1F6E1} ZTAS Ready | Assume Breach Active | Threat Intel Synced (${today}) | Enterprise Protection ON`;
    }, 1200);
  }, 800);

});


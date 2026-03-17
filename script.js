// ============================================================================
// CYBERSECURITY DETECTION SYSTEM - INTERACTIVE JAVASCRIPT
// Professional Website for Google Competition
// ============================================================================

// Hardcoded page-hidden on <body> handles initial state to prevent FOUC

// Hard safety fallback — if nothing reveals the page within 2s, force it visible
setTimeout(function () {
  if (document.body.classList.contains('page-hidden')) {
    document.body.classList.remove('page-hidden');
    document.body.style.opacity = '1';
    document.body.style.transform = 'none';
  }
}, 2000);

// Import AI Analysis Engine
let AIAnalysisEngine, ThreatClassifier;
if (typeof require !== 'undefined') {
  try {
    const { AIAnalysisEngine: Engine, ThreatClassifier: Classifier } = require('./ai-analysis.js');
    AIAnalysisEngine = Engine;
    ThreatClassifier = Classifier;
  } catch (error) {
    AIAnalysisEngine = null;
    ThreatClassifier = null;
  }
} else {
  // Browser environment - scripts loaded via HTML
  AIAnalysisEngine = window.AIAnalysisEngine;
  ThreatClassifier = window.ThreatClassifier;
}

// Global Configuration (declared in index.html inline script; reuse safely)
if (typeof CONFIG === 'undefined') {
  window.CONFIG = {
    apiDelay: 300,
    scanDuration: 3000,
    alertThreshold: 0.7,
    animationDuration: 600,
    aiEnabled: true
  };
}

// State Management (declared in index.html inline script; reuse safely)
if (typeof appState === 'undefined') {
  window.appState = {
    isScanning: false,
    alertLevel: 'safe',
    detectionHistory: [],
    networkStats: { packets: 0, threats: 0, blocked: 0 }
  };
}

// ============================================================================
// SMOOTH SCROLLING AND NAVIGATION
// (Handled by inline script in index.html - skip duplicate registration)
// ============================================================================

// ============================================================================
// HEADER INTERACTIONS
// ============================================================================

const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');
const header = document.querySelector('header');

// Mobile Menu Toggle
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', function () {
    if (navLinks) navLinks.classList.toggle('active');
    this.classList.toggle('active');
    console.log('[v0] Mobile menu toggled');
  });
}

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    if (navLinks) navLinks.classList.remove('active');
    if (mobileMenuBtn) mobileMenuBtn.classList.remove('active');
  });
});

// Sticky Header on Scroll
window.addEventListener('scroll', () => {
  if (header && window.scrollY > 50) {
    header.classList.add('scrolled');
  } else if (header) {
    header.classList.remove('scrolled');
  }
});


// LIVE DETECTION SYSTEM - INTERACTIVE CONSOLE


// Detection System removed


// FEATURES INTERACTIVE CARDS


class FeatureCards {
  constructor() {
    this.cards = document.querySelectorAll('.feature-card');
    this.init();
  }

  init() {
    this.cards.forEach((card, index) => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-8px) scale(1.02)';
        card.style.boxShadow = '0 20px 40px rgba(104, 182, 255, 0.4)';
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
        card.style.boxShadow = '0 10px 30px rgba(104, 182, 255, 0.2)';
      });

      // Stagger animation
      card.style.animation = `slideInUp 0.6s ease-out ${index * 0.1}s both`;
    });
  }
}


// REAL-TIME THREAT SIMULATION CHART


class ThreatChart {
  constructor() {
    this.chartContainer = document.querySelector('.threat-chart');
    this.init();
  }

  init() {
    if (!this.chartContainer) return;

    // Create simple bar chart
    this.updateChart();
    setInterval(() => this.updateChart(), 5000);
  }

  updateChart() {
    const threatTypes = ['Phishing', 'Malware', 'DDoS', 'SQLi', 'XSS'];
    const chartHTML = threatTypes.map(type => {
      const value = Math.floor(Math.random() * 100);
      const percentage = (value / 100) * 100;

      return `
        <div class="chart-bar">
          <div class="bar-label">${type}</div>
          <div class="bar-container">
            <div class="bar-value" style="width: ${percentage}%; background: linear-gradient(90deg, #68b6ff, #4ade80);"></div>
          </div>
          <div class="bar-count">${value}%</div>
        </div>
      `;
    }).join('');

    this.chartContainer.innerHTML = chartHTML;
  }
}


// FORM HANDLING - CONTACT SECTION


class FormHandler {
  constructor() {
    this.form = document.querySelector('.contact-form');
    this.init();
  }

  init() {
    if (!this.form) return;
    if (this.form.id === 'contactForm') return;

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Add focus animations to inputs
    const inputs = this.form.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', function () {
        this.parentElement.classList.add('focused');
      });

      input.addEventListener('blur', function () {
        this.parentElement.classList.remove('focused');
      });
    });
  }

  handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(this.form);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message')
    };

    // Validate
    if (!this.validateForm(data)) {
      this.showMessage('Please fill all fields correctly', 'error');
      return;
    }

    // Simulate sending
    const submitBtn = this.form.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    setTimeout(() => {
      this.showMessage('Message sent successfully! We\'ll get back to you soon.', 'success');
      this.form.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
      console.log('[v0] Form submitted:', data);
    }, 1500);
  }

  validateForm(data) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return data.name && data.email && emailRegex.test(data.email) && data.message;
  }

  showMessage(text, type) {
    const message = document.createElement('div');
    message.className = `form-message message-${type}`;
    message.textContent = text;
    this.form.appendChild(message);

    setTimeout(() => message.remove(), 4000);
  }
}


// STATISTICS COUNTER ANIMATION


class StatisticsCounter {
  constructor() {
    this.stats = document.querySelectorAll('[data-stat]');
    this.init();
  }

  init() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.animated) {
          this.animateCounter(entry.target);
          entry.target.dataset.animated = true;
        }
      });
    }, { threshold: 0.5 });

    this.stats.forEach(stat => observer.observe(stat));
  }

  animateCounter(element) {
    const target = parseInt(element.dataset.stat) || 0;
    let current = 0;
    const increment = target / 60;
    const suffix = element.dataset.suffix || '';

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      element.textContent = Math.floor(current) + suffix;
    }, 30);
  }
}


// SCROLL REVEAL AND PARALLAX SYSTEMS REMOVED AS PER USER REQUEST



// ============================================================================
// MODAL HANDLER
// ============================================================================

class ModalHandler {
  constructor() {
    this.modals = document.querySelectorAll('.modal');
    this.init();
  }

  init() {
    // Close modal when clicking the overlay background
    this.modals.forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal);
      });
    });

    // Close buttons inside modals
    document.querySelectorAll('[data-modal-close], .modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) this.closeModal(modal);
      });
    });
  }

  openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}


// ============================================================================
// THEME TOGGLE
// ============================================================================

class ThemeToggle {
  constructor() {
    this.btn = document.getElementById('themeToggle');
    this.init();
  }

  init() {
    if (!this.btn) return;
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.btn.addEventListener('click', () => this.toggle());
  }

  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }
}


// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

class KeyboardShortcuts {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K - Quick search / go to scanner
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        window.location.href = 'safe.html';
      }

      // Escape - Close any active modals
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
          modal.classList.remove('active');
          modal.setAttribute('aria-hidden', 'true');
          document.body.style.overflow = '';
        });
      }

      // Ctrl/Cmd + L - Quick scan
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        const scanBtn = document.querySelector('.scan-btn');
        if (scanBtn && !scanBtn.disabled) scanBtn.click();
      }
    });
  }
}


// NOTIFICATION SYSTEM

class NotificationSystem {
  static show(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
    `;

    const container = document.querySelector('.notification-container') || this.createContainer();
    container.appendChild(notification);

    setTimeout(() => notification.remove(), duration);
  }

  static createContainer() {
    const container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
  }

  static success(msg) { this.show(msg, 'success'); }
  static error(msg) { this.show(msg, 'error'); }
  static warning(msg) { this.show(msg, 'warning'); }
  static info(msg) { this.show(msg, 'info'); }
}


// INITIALIZATION ON DOM LOAD

document.addEventListener('DOMContentLoaded', () => {
  console.log('[v0] Initializing Cybersecurity Detection System...');

  // Initialize systems
  const initializers = [
    { name: 'FeatureCards', init: () => new FeatureCards() },
    { name: 'ThreatChart', init: () => new ThreatChart() },
    { name: 'FormHandler', init: () => new FormHandler() },
    { name: 'StatisticsCounter', init: () => new StatisticsCounter() },
    { name: 'ModalHandler', init: () => new ModalHandler() },
    { name: 'ThemeToggle', init: () => new ThemeToggle() },
    { name: 'KeyboardShortcuts', init: () => new KeyboardShortcuts() }
  ];

  initializers.forEach(sys => {
    try {
      sys.init();
      console.log(`[v0] ${sys.name} initialized`);
    } catch (e) {
      console.error(`[v0] ${sys.name} failed:`, e);
    }
  });

  console.log('[v0] All systems initialization attempt finished');
});


// ADVANCED CYBER BACKGROUND ANIMATIONS

// Initialize cyber background elements
function initCyberBackground() {
  // Create matrix rain columns
  const matrixRain = document.querySelector('.matrix-rain');
  if (matrixRain) {
    for (let i = 0; i < 20; i++) {
      const column = document.createElement('div');
      column.className = 'matrix-column';
      column.style.left = (i * 5) + '%';
      column.style.animationDelay = Math.random() * 3 + 's';
      matrixRain.appendChild(column);
    }
  }

  // Create floating shapes
  const shapes = document.querySelector('.cyber-shapes');
  if (shapes) {
    // Shapes are already defined in CSS
  }

  // Create energy waves
  const waves = document.querySelector('.energy-wave');
  if (waves) {
    // Waves are already defined in CSS
  }
}


// WINDOW LOAD - POST INITIALIZATION

window.addEventListener('load', () => {
  // console.log('[v0] Page fully loaded');

  // Background deactivated for clean static design
  // initCyberBackground();

  // ── Natural page-open transition (cinematic, not AI-generic) ──
  // The body starts fully invisible via CSS (opacity:0), then we
  // orchestrate: loader fades + drifts up → body content rises in.
  const pageLoader = document.getElementById('pageLoader');

  function revealPage() {
    // If we have our new cinematic loader, we still set up the fail-safe 
    // but revealHeroContent in index.html will handle the primary reveal.
    // We don't return early here to ensure doReveal() is still available.

    // Hard fallback: ensure page is revealed even if JS fails or is blocked
    setTimeout(doReveal, 3000); // 3-second hard timeout

    function doReveal() {
      document.body.classList.remove('page-hidden');
      document.body.style.transition = 'opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)';
      document.body.style.opacity = '1';
      document.body.style.transform = 'translateY(0)';
      setTimeout(() => {
        document.body.style.transition = '';
        document.body.style.transform = '';
      }, 680);
    }

    if (pageLoader) {
      // Fade loader out + drift up, then reveal page
      pageLoader.style.transition = 'opacity 480ms cubic-bezier(0.4,0,0.2,1), transform 480ms cubic-bezier(0.4,0,0.2,1)';
      pageLoader.style.opacity = '0';
      pageLoader.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        if (pageLoader.parentNode) pageLoader.remove();
        doReveal();
      }, 500);
    } else {
      doReveal();
    }
  }

  // Remove loading state fallback
  const loader = document.querySelector('.page-loader');
  if (loader && loader.parentNode) loader.remove();


  revealPage();
});


// ERROR HANDLING

window.addEventListener('error', (event) => {
  console.error('[v0] Runtime error:', event.error);
  NotificationSystem.error('An error occurred - Please check the console');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[v0] Unhandled promise rejection:', event.reason);
});


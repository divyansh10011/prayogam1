'use client';

import { useState, useEffect } from 'react';
import EmergencyChat from './components/EmergencyChat';

export default function Home() {
  const [activeSection, setActiveSection] = useState('home');
  const [heroStats, setHeroStats] = useState({
    rate: 99.8,
    time: 0.2,
    scans: 5124800
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroStats(prev => ({
        rate: 99.8 + (Math.random() * 0.1),
        time: 0.2 + (Math.random() * 0.1),
        scans: prev.scans + Math.floor(Math.random() * 10)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'about', 'platform', 'technology', 'contact'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-cyan-400">SAFE-NET AI</span>
            </div>
            <div className="hidden md:block">
              <div className="flex items-baseline space-x-4">
                {['home', 'about', 'platform', 'technology', 'contact'].map((section) => (
                  <a
                    key={section}
                    href={`#${section}`}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeSection === section
                      ? 'text-cyan-400 bg-cyan-500/10'
                      : 'text-gray-300 hover:text-cyan-400'
                      }`}
                  >
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            SAFE-NET AI
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">
            Advanced Phishing Detection & Cyber Fraud Prevention System
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <div className="p-6 bg-slate-900/50 border border-cyan-500/20 rounded-2xl backdrop-blur-sm">
              <div className="text-3xl font-bold text-cyan-400 mb-1">{heroStats.rate.toFixed(1)}%</div>
              <div className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Detection Rate</div>
            </div>
            <div className="p-6 bg-slate-900/50 border border-cyan-500/20 rounded-2xl backdrop-blur-sm">
              <div className="text-3xl font-bold text-cyan-400 mb-1">{heroStats.time.toFixed(2)}ms</div>
              <div className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Response Time</div>
            </div>
            <div className="p-6 bg-slate-900/50 border border-cyan-500/20 rounded-2xl backdrop-blur-sm">
              <div className="text-3xl font-bold text-cyan-400 mb-1">{(heroStats.scans / 1000000).toFixed(2)}M+</div>
              <div className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Scans Completed</div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-semibold transition-colors">
              Get Started
            </button>
            <button className="px-8 py-3 border border-cyan-500 hover:bg-cyan-500/10 rounded-lg font-semibold transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* About Section (truncated) */}
      <section id="about" className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-cyan-400">About SAFE-NET</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-slate-800/50 rounded-lg border border-cyan-500/20 hover:border-cyan-500/50 transition-colors">
              <h3 className="text-xl font-bold mb-4 text-cyan-400">🛡️ Advanced Protection</h3>
              <p className="text-gray-300">Real-time detection of phishing attempts and cyber threats using state-of-the-art AI technology.</p>
            </div>
            <div className="p-6 bg-slate-800/50 rounded-lg border border-cyan-500/20 hover:border-cyan-500/50 transition-colors">
              <h3 className="text-xl font-bold mb-4 text-cyan-400">🤖 AI-Powered</h3>
              <p className="text-gray-300">Leveraging machine learning algorithms to identify and prevent sophisticated cyber attacks.</p>
            </div>
            <div className="p-6 bg-slate-800/50 rounded-lg border border-cyan-500/20 hover:border-cyan-500/50 transition-colors">
              <h3 className="text-xl font-bold mb-4 text-cyan-400">⚡ Real-Time</h3>
              <p className="text-gray-300">Instant threat detection and response to keep your systems secure 24/7.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section id="platform" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-cyan-400">Our Platform</h2>
          <div className="space-y-8">
            <div className="p-8 bg-slate-800/50 rounded-lg border border-cyan-500/20">
              <h3 className="text-2xl font-bold mb-4 text-cyan-400">Comprehensive Security Suite</h3>
              <p className="text-gray-300 mb-4">Our platform provides end-to-end protection against all forms of cyber threats.</p>
              <ul className="space-y-2 text-gray-300">
                <li>✓ Email Phishing Detection</li>
                <li>✓ Website Security Analysis</li>
                <li>✓ Social Engineering Prevention</li>
                <li>✓ Real-time Threat Intelligence</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-cyan-400">Technology</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 bg-slate-800/50 rounded-lg border border-cyan-500/20">
              <h3 className="text-xl font-bold mb-4 text-cyan-400">Machine Learning</h3>
              <p className="text-gray-300">Advanced neural networks trained on millions of threat patterns.</p>
            </div>
            <div className="p-6 bg-slate-800/50 rounded-lg border border-cyan-500/20">
              <h3 className="text-xl font-bold mb-4 text-cyan-400">Cloud Infrastructure</h3>
              <p className="text-gray-300">Scalable, secure cloud-based architecture for maximum reliability.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-cyan-400">Contact Us</h2>
          <form className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-slate-800 border border-cyan-500/20 rounded-lg focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 bg-slate-800 border border-cyan-500/20 rounded-lg focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Message</label>
              <textarea
                rows={4}
                className="w-full px-4 py-2 bg-slate-800 border border-cyan-500/20 rounded-lg focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full px-8 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-semibold transition-colors"
            >
              Send Message
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-cyan-500/20">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>&copy; 2026 SAFE-NET AI. All rights reserved.</p>
        </div>
      </footer>
      <EmergencyChat />
    </div>
  );
}

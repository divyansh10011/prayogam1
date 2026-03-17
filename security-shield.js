/**
 * SAFETEMP - Professional Code Protection Shield
 * (C) 2026 ZTAS Security Suite
 * Unauthorized copying or modification is strictly prohibited.
 */

(function () {
    'use strict';

    const GEMINI_PROXY_ENDPOINTS = [
        '/api/gemini',
        'http://127.0.0.1:3000/api/gemini',
        'http://localhost:3000/api/gemini'
    ];

    // --- 1. Right-Click Protection ---
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        return false;
    }, false);

    // --- 2. Keyboard Shortcut Blocking ---
    document.addEventListener('keydown', function (e) {
        // Block F12
        if (e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
            e.preventDefault();
            return false;
        }
        // Block Ctrl+U (View Source)
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            return false;
        }
        // Block Ctrl+S (Save Page)
        if (e.ctrlKey && e.keyCode === 83) {
            e.preventDefault();
            return false;
        }
        // Block Ctrl+P (Print)
        if (e.ctrlKey && e.keyCode === 80) {
            e.preventDefault();
            return false;
        }
    }, false);

    // --- 3. Lightweight DevTools Awareness ---
    // Avoid recursive debugger traps because they hurt normal users and can
    // degrade performance across the whole site.
    function detectDevToolsOpen() {
        const widthGap = window.outerWidth - window.innerWidth;
        const heightGap = window.outerHeight - window.innerHeight;
        return widthGap > 160 || heightGap > 160;
    }

    setInterval(function () {
        window.__ZTAS_DEVTOOLS_OPEN__ = detectDevToolsOpen();
    }, 1500);

    /* Loop removed for better stability 
    setInterval(() => {
        console.clear();
    }, 2000);
    */


    // --- 5. Heartbeat for Integrity ---
    window.__ZTAS_SHIELD_ACTIVE__ = true;

    console.log("%c SAFETEMP ZTAS SHIELD ACTIVE ", "background: #00d4ff; color: #000; font-weight: bold; padding: 4px; border-radius: 4px;");

    // --- 6. SAFY Shield Assistant ---
    document.addEventListener('DOMContentLoaded', function () {
        if (!document.querySelector('#capabilitiesSection') || !document.querySelector('.hero')) {
            return;
        }

        if (document.getElementById('emergencyAgentContainer')) {
            return;
        }

        const style = document.createElement('style');
        style.textContent = `
          .emergency-agent-container {
            position: fixed !important;
            right: 24px !important;
            bottom: 24px !important;
            z-index: 100002 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            transform: translateY(18px) scale(0.94) !important;
            transition: opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1), transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.45s ease !important;
          }

          .emergency-agent-container.ready {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
            transform: translateY(0) scale(1) !important;
          }

          .emergency-chat-window,
          .emergency-agent-btn {
            pointer-events: auto !important;
          }

          .safy-scroll-cue {
            max-width: 360px;
            min-width: 280px;
            margin: 0 0 14px auto;
            padding: 14px 18px;
            border-radius: 18px;
            background: linear-gradient(165deg, rgba(8, 12, 24, 0.96), rgba(5, 8, 18, 0.98));
            border: 1px solid rgba(56, 189, 248, 0.24);
            box-shadow: 0 18px 38px rgba(0, 0, 0, 0.35), 0 0 18px rgba(56, 189, 248, 0.08);
            color: rgba(226, 232, 240, 0.97);
            font-size: 0.88rem;
            line-height: 1.55;
            letter-spacing: 0.01em;
            text-align: left;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translateY(10px) scale(0.96);
            transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.28s ease;
          }

          .safy-scroll-cue.active {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: translateY(0) scale(1);
          }

          .safy-scroll-cue strong {
            color: #38bdf8;
            display: inline-block;
            margin-right: 6px;
            font-size: 0.92rem;
          }

        `;
        document.head.appendChild(style);

        const widget = document.createElement('div');
        widget.id = 'emergencyAgentContainer';
        widget.className = 'emergency-agent-container';
        widget.innerHTML = `
          <button class="safy-scroll-cue" id="safyScrollCue" type="button" aria-label="Open SAFY quick guidance">
            <span id="safyScrollCueText"><strong>SAFY:</strong> SAFE-NET helps you scan risky messages, links, and scam attempts before you act.</span>
          </button>

          <div class="emergency-chat-window" id="emergencyChatWindow">
            <div class="chat-header">
              <div class="chat-header-info">
                <span class="chat-icon">&#128737;&#65039;</span>
                <div>
                  <h4 style="display:flex;align-items:center;gap:6px;">SAFY <span class="pulse-dot"></span></h4>
                  <p>Cybersecurity Specialist</p>
                </div>
              </div>
              <button class="close-chat" id="closeChatBtn" type="button" aria-label="Close AI assistant">&times;</button>
            </div>

            <div class="chat-messages" id="chatMessages">
              <div class="message ai-message">
                <div class="msg-avatar">&#129302;</div>
                <div class="msg-content">
                  <strong style="font-family:monospace; font-size:0.7rem; color:#38bdf8;">[SAFY ONLINE]</strong><br>
                  Hello, I am SAFY, your cybersecurity specialist.<br><br>
                  You can scan any message, link, website, QR code, or payment request with our detection system, and I will guide you through the result and the safest next step.
                </div>
              </div>
            </div>

            <div class="chat-options-area">
              <button class="chat-option-btn" data-query="Please review a suspicious phishing email for risk and next steps.">&#128231; <span>Email Review</span></button>
              <button class="chat-option-btn" data-query="Please assess whether this could be a deepfake, voice clone, or impersonation scam.">&#127917; <span>Impersonation</span></button>
              <button class="chat-option-btn" data-query="Please help me handle a possible identity theft or account takeover situation.">&#128272; <span>Account Risk</span></button>
              <button class="chat-option-btn" data-query="Please inspect a suspicious link, QR code, or website before I open it.">&#128279; <span>Link or QR</span></button>
            </div>

            <div class="chat-input-area">
              <input type="text" id="chatInputField" placeholder="Describe the threat or ask a question..." />
              <button id="chatSendBtn" type="button" aria-label="Send message">&#9889;</button>
            </div>
          </div>

          <button class="emergency-agent-btn" id="emergencyAgentBtn" type="button" aria-label="Open AI assistant">
            <span class="btn-icon">&#128737;&#65039;</span>
            <div class="pulse-ring"></div>
          </button>
        `;
        document.body.appendChild(widget);

        let launcherRevealed = false;
        function revealAssistantLauncher() {
            if (launcherRevealed) return;
            launcherRevealed = true;
            widget.classList.add('ready');
        }

        const launcherDelayMs = 2000;
        const pageLoader = document.getElementById('pageLoader');

        if (document.readyState === 'complete') {
            setTimeout(revealAssistantLauncher, launcherDelayMs);
        } else {
            window.addEventListener('load', function () {
                setTimeout(revealAssistantLauncher, launcherDelayMs);
            }, { once: true });
        }

        if (pageLoader) {
            const observeLoaderState = function () {
                if (pageLoader.classList.contains('fade-out')) {
                    if (document.readyState === 'complete') {
                        setTimeout(revealAssistantLauncher, launcherDelayMs);
                    }
                    return true;
                }
                return false;
            };

            if (!observeLoaderState()) {
                const loaderObserver = new MutationObserver(function () {
                    if (observeLoaderState()) {
                        loaderObserver.disconnect();
                    }
                });
                loaderObserver.observe(pageLoader, { attributes: true, attributeFilter: ['class'] });
            }
        }

        const chatWindow = document.getElementById('emergencyChatWindow');
        const agentBtn = document.getElementById('emergencyAgentBtn');
        const closeChatBtn = document.getElementById('closeChatBtn');
        const chatInputField = document.getElementById('chatInputField');
        const chatSendBtn = document.getElementById('chatSendBtn');
        const chatMessages = document.getElementById('chatMessages');
        const safyScrollCue = document.getElementById('safyScrollCue');
        const safyScrollCueText = document.getElementById('safyScrollCueText');
        const chatOptionButtons = Array.from(document.querySelectorAll('.chat-option-btn'));

        if (!chatWindow || !agentBtn || !chatMessages) {
            return;
        }

        const safyHistory = [];
        const safeNetSiteContext = `SAFE-NET is an AI-powered cybersecurity website focused on phishing detection, cyber scam prevention, suspicious link analysis, QR scam checks, impersonation awareness, malware-related guidance, and real-time user safety support.
The website helps users scan and understand risky emails, links, payment requests, websites, and scam scenarios.
If the user asks what the website is about, explain the SAFE-NET platform clearly.
If the user asks about pricing, contact, login, detection, or how the website works, answer that directly before offering extra security help.`;
        const systemPrompt = `You are SAFY, a highly professional cybersecurity specialist for SAFE-NET.
Your role is to guide users in real time about suspicious links, phishing, impersonation, deepfakes, payment fraud, QR scams, OTP theft, malware, account compromise, and SAFE-NET product questions.
Sound calm, expert, practical, and protective.
Use clear language, not heavy jargon.
When the situation is risky, explicitly tell the user not to click, not to pay, not to install anything, and not to share OTPs or passwords.
Give precise next steps and short reasoning.
Speak like a real specialist helping a real person in the moment, not like a scripted bot.
Be warm, interactive, and human in tone.
When helpful, acknowledge stress or urgency, then guide the user step by step.
If you need more detail, ask one focused follow-up question instead of giving a generic answer.
Answer the exact user question first.
Do not misclassify general questions just because they contain words like "website", "site", or "link".
Follow safe defensive cybersecurity guidance only. Do not provide harmful hacking instructions, bypass steps, credential theft help, or anything illegal.
Prefer 4-7 concise sentences or a short action list.`;
        const sessionStartedAt = Date.now();
        const visitorSignals = {
            messagesSent: 0,
            lastSection: 'home'
        };
        const sectionCueCopy = {
            home: '<strong>SAFY:</strong> SAFE-NET is built to help you scan suspicious links, websites, QR codes, and scam messages before you interact.',
            about: '<strong>SAFY:</strong> This section explains SAFE-NET\'s approach: fast phishing detection, scam prevention, and guided security decisions.',
            scenarios: '<strong>SAFY:</strong> These threat scenarios show the kinds of scams and cyberattacks SAFE-NET is designed to help users recognize.',
            contact: '<strong>SAFY:</strong> If you need help, support, or product guidance, SAFE-NET includes a contact path and I can help direct you.'
        };
        let cueTimer = null;
        let lastCueSection = '';
        let lastCueAt = 0;

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatAssistantText(text) {
            return escapeHtml(text)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
        }

        function extractGeminiText(data) {
            const parts = ((((data || {}).candidates || [])[0] || {}).content || {}).parts || [];
            return parts
                .map(function (part) { return typeof part.text === 'string' ? part.text : ''; })
                .filter(Boolean)
                .join('\n')
                .trim();
        }

        function delay(ms) {
            return new Promise(function (resolve) { setTimeout(resolve, ms); });
        }

        function buildVisitorContext() {
            const minutesOnPage = Math.max(1, Math.round((Date.now() - sessionStartedAt) / 60000));
            return [
                'Visitor Context:',
                '- Current page section: ' + visitorSignals.lastSection,
                '- Minutes on page: ' + minutesOnPage,
                '- Messages sent in this session: ' + visitorSignals.messagesSent,
                '- User may be anxious and wants a fast, trustworthy answer.'
            ].join('\n');
        }

        function hideScrollCue() {
            if (!safyScrollCue) return;
            safyScrollCue.classList.remove('active');
        }

        function showScrollCue(message) {
            if (!safyScrollCue || !safyScrollCueText || !launcherRevealed || chatWindow.classList.contains('active')) {
                return;
            }

            safyScrollCueText.innerHTML = message;
            safyScrollCue.classList.add('active');

            if (cueTimer) {
                clearTimeout(cueTimer);
            }

            cueTimer = setTimeout(function () {
                hideScrollCue();
            }, 4200);
        }

        function appendMessage(sender, text, isHtml) {
            const msg = document.createElement('div');
            msg.className = 'message ' + sender + '-message';
            const content = isHtml ? text : escapeHtml(text);
            msg.innerHTML = '<div class="msg-avatar">' + (sender === 'ai' ? '&#129302;' : '&#128100;') + '</div><div class="msg-content">' + content + '</div>';
            chatMessages.appendChild(msg);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function showThinking() {
            const id = 'thinking-' + Date.now();
            const thinking = document.createElement('div');
            thinking.id = id;
            thinking.className = 'message ai-message';
            thinking.innerHTML = '<div class="msg-avatar">&#129302;</div><div class="msg-content"><strong style="color:#38bdf8; font-family:monospace; font-size:0.7rem;">[SAFY ANALYZING]</strong><div class="thinking-indicator"><span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span></div></div>';
            chatMessages.appendChild(thinking);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return id;
        }

        function removeThinking(id) {
            const node = document.getElementById(id);
            if (node) node.remove();
        }

        function buildLocalShieldResponse(userInput) {
            const text = String(userInput || '').trim();
            const lower = text.toLowerCase();

            function respond(title, steps, followUp) {
                return '**' + title + '**\n\n' + steps.map(function (step, index) {
                    return (index + 1) + '. ' + step;
                }).join('\n') + (followUp ? '\n\n' + followUp : '');
            }

            if (!text) {
                return respond(
                    'SAFY guidance',
                    [
                        'Tell me what happened: hacked account, suspicious link, scam message, malware, payment fraud, or identity theft.',
                        'If you have a message, email, URL, QR code, or website, scan it with the detection system first if possible.',
                        'If this is urgent or money is involved, tell me that and I will prioritize the first containment steps.'
                    ],
                    'Start with one detail: what exactly got affected?'
                );
            }

            if (/^(hi|hello|hey|hii|yo)\b/.test(lower)) {
                return '**SAFY is here.** I can help with hacked accounts, phishing, scams, malware, identity theft, suspicious links, payment fraud, QR scams, deepfakes, and device compromise. Tell me what happened, and I will guide you step by step.';
            }

            if (/(what.*website|what.*site|what is safe-net|what does safe-net do|what your website is about|about your website|about this website|what is this platform|what is this website|tell me about.*website|tell me about safe-net)/.test(lower)) {
                return respond(
                    'About SAFE-NET',
                    [
                        'SAFE-NET is a cybersecurity platform focused on phishing detection, scam prevention, suspicious link analysis, QR-code risk checks, and guidance for threats like impersonation, malware, and account compromise.',
                        'It is designed to help users scan risky content and understand what action to take before clicking, paying, logging in, or sharing sensitive information.',
                        'SAFY is the on-site specialist that explains results and gives real-time safety guidance.'
                    ],
                    'If you want, I can also explain the detection system, pricing flow, login flow, or how to use the scanner.'
                );
            }

            if (/(pricing|price|plan|plans|subscription|cost|how much)/.test(lower)) {
                return respond(
                    'SAFE-NET pricing help',
                    [
                        'SAFE-NET has a pricing section for plan and package details.',
                        'If you are evaluating the platform, the key areas to compare are detection features, response guidance, and the type of protection you need.',
                        'You can also review the scanner and support flow before choosing a plan.'
                    ],
                    'If you want, ask me whether you should look at pricing, detection, or support first.'
                );
            }

            if (/(login|sign in|sign-in|account access|profile|register|sign up)/.test(lower) && /(website|site|safe-net|platform|scanner|detection)/.test(lower)) {
                return respond(
                    'SAFE-NET account access',
                    [
                        'You can use the login flow to access your SAFE-NET account features.',
                        'If you are having trouble signing in, I can help you narrow down whether it looks like a password issue, account recovery issue, or possible compromise.'
                    ],
                    'Tell me whether you need login help or security help for the account.'
                );
            }

            if (/(contact|support|email|phone|reach|talk to team)/.test(lower) && /(website|site|safe-net|platform|scanner|pricing)/.test(lower)) {
                return respond(
                    'SAFE-NET contact help',
                    [
                        'SAFE-NET includes a contact path for reaching the team about support, questions, or security issues.',
                        'If your issue is urgent and security-related, tell me what happened first and I will help you with the fastest safe next step.'
                    ],
                    'If you want, I can help you decide whether this is a support request, product question, or security incident.'
                );
            }

            if (/(hack|hacked|breach|compromis|account taken|account stolen|got hacked|unauthorized|someone logged in|account recovery|locked out)/.test(lower)) {
                return respond(
                    'Possible compromise: act now',
                    [
                        'From a clean device, change the password for the affected account first, then change the password for the email account linked to it.',
                        'Sign out of other sessions, remove unknown devices, and check whether the recovery email, phone number, forwarding rules, or backup codes were changed.',
                        'Turn on two-factor authentication using an authenticator app, not SMS if you have a stronger option.',
                        'If banking, crypto, business email, or payments are involved, contact the provider immediately and report unauthorized access.',
                        'Keep screenshots, login alerts, transaction IDs, and timestamps so you have evidence if recovery or fraud reporting is needed.'
                    ],
                    'Tell me what got hacked: email, Instagram, WhatsApp, bank, phone, laptop, or something else.'
                );
            }

            if (/(phish|email|mail|sender|inbox|attachment|spoof)/.test(lower)) {
                return respond(
                    'Phishing or email scam review',
                    [
                        'Do not click the link, download the attachment, or reply yet.',
                        'Check the sender address carefully for misspellings, strange domains, and mismatched reply-to addresses.',
                        'Treat urgency, password resets, invoice pressure, and OTP requests as strong warning signs.',
                        'Open the official website separately instead of using the email link if you need to verify the claim.'
                    ],
                    'Paste the exact email text or sender domain and I will help break down the risk signals.'
                );
            }

            if (/(url|link|domain|website|site|http|https|bit\.ly|tinyurl|redirect)/.test(lower)) {
                return respond(
                    'Link and website safety check',
                    [
                        'Do not open the link again until it is verified.',
                        'Look for misspelled brands, extra subdomains, shortened URLs, fake login pages, and unexpected downloads.',
                        'If you already opened it, do not enter passwords, payment details, OTPs, or card information.',
                        'Use the official app or official website you type yourself to confirm whether the request is real.'
                    ],
                    'Send me the exact URL text if you want a more targeted risk review.'
                );
            }

            if (/(otp|code|password|passcode|login|signin|verify account|credential|2fa|auth|mfa)/.test(lower)) {
                return respond(
                    'Credential and OTP protection',
                    [
                        'Never share passwords, OTPs, verification codes, or approval prompts with anyone claiming to be support, banking staff, or police.',
                        'If you already shared them, change the password immediately, sign out of other sessions, and enable strong two-factor authentication.',
                        'Check account recovery settings and recent login history for changes you did not make.'
                    ],
                    'If you already entered details on a page, tell me which account was affected so I can give the right recovery order.'
                );
            }

            if (/(upi|payment|invoice|bank|refund|gift card|transfer|crypto|investment|wallet|venmo|paypal|card|credit card|debit card)/.test(lower)) {
                return respond(
                    'Payment fraud or financial scam',
                    [
                        'Do not send money, share card details, approve payment requests, or scan payment QR codes based only on a call, text, or email.',
                        'Verify the request inside the official banking or payment app, or by calling a number you already trust.',
                        'If money was sent or a card was exposed, contact the bank or payment provider immediately to freeze, dispute, or report fraud.',
                        'Change related passwords if the scam also involved a login page or recovery message.'
                    ],
                    'Tell me whether this is a bank transfer, UPI, card payment, crypto, or refund scam.'
                );
            }

            if (/(deepfake|voice|clone|video|audio|call|ceo|boss|impersonat)/.test(lower)) {
                return respond(
                    'Impersonation, deepfake, or voice clone risk',
                    [
                        'Do not trust voice, video, caller ID, or a familiar face by itself.',
                        'Pause the interaction and verify identity through a number or channel you already know is real.',
                        'If they ask for urgency, secrecy, money, OTPs, or gift cards, treat it as high risk until independently confirmed.'
                    ],
                    'If you want, describe what they asked for and I will help you judge the pressure tactics.'
                );
            }

            if (/(qr|scan code|barcode)/.test(lower)) {
                return respond(
                    'QR scam warning',
                    [
                        'Do not scan random or replaced QR codes on posters, parking meters, menus, or courier slips unless you trust the source.',
                        'Preview the destination URL before entering any details or making payment.',
                        'Treat QR codes that lead to login pages, wallet approvals, or urgent payment pages as high risk.'
                    ],
                    'If you have the destination URL or where the QR came from, send that detail next.'
                );
            }

            if (/(apk|exe|download|file|app|software|install|update|document|pdf|zip|ransomware|malware|virus|trojan|infected)/.test(lower)) {
                return respond(
                    'Possible malware or malicious file',
                    [
                        'Stop opening the file or installer and disconnect from sensitive accounts if you think it executed.',
                        'Run a trusted security scan and check for unknown apps, browser extensions, scheduled tasks, or startup entries.',
                        'If it involved company data, banking, or remote access tools, isolate the device from the network until reviewed.',
                        'Change passwords from a clean device if you typed them after the infection.'
                    ],
                    'Tell me whether this happened on phone, Windows laptop, Mac, or browser, and whether the file was opened.'
                );
            }

            if (/(phone hacked|mobile hacked|sim swap|sim card|android|iphone|device hacked|laptop hacked|computer hacked|remote access|anydesk|teamviewer)/.test(lower)) {
                return respond(
                    'Device compromise or remote access concern',
                    [
                        'Disconnect the device from Wi-Fi or mobile data if you think active abuse is happening.',
                        'Remove unknown remote-access apps, browser extensions, and recently installed profiles or certificates.',
                        'Change important passwords from a different clean device, starting with email, banking, and primary messaging accounts.',
                        'If a SIM swap is suspected, call the carrier immediately and place extra protection on the line.'
                    ],
                    'Tell me whether the affected device is a phone, laptop, or browser so I can narrow the recovery steps.'
                );
            }

            if (/(wifi|router|network|dns|public wifi|home network|firewall)/.test(lower)) {
                return respond(
                    'Wi-Fi or network security help',
                    [
                        'Change the router admin password if it still uses the default or an old weak password.',
                        'Use WPA2 or WPA3, update router firmware, and disable remote administration unless you truly need it.',
                        'Avoid logging into banking or sensitive accounts on unknown public Wi-Fi without a trusted VPN.'
                    ],
                    'If the issue is a router warning, DNS hijack, or public Wi-Fi concern, tell me which one.'
                );
            }

            if (/(popup|pop-up|microsoft support|apple support|tech support|your device is infected|call now|browser locked)/.test(lower)) {
                return respond(
                    'Tech support scam or fake security alert',
                    [
                        'Do not call the number, install the software, or allow remote access.',
                        'Close the browser tab, clear recent browser data if needed, and reopen the browser normally.',
                        'If you already gave access, disconnect the device, uninstall the remote-access tool, and change important passwords from a clean device.'
                    ],
                    'If they connected to your device already, tell me that immediately and I will switch to containment steps.'
                );
            }

            if (/(identity|aadhaar|pan|ssn|kyc|passport|document|personal info|doxx|leak|breach notice|data leak)/.test(lower)) {
                return respond(
                    'Identity theft or exposed personal data',
                    [
                        'Do not upload more documents until the request is verified through an official source.',
                        'Monitor financial accounts, account recovery changes, and new verification requests closely.',
                        'Change passwords for accounts tied to the exposed email or phone number, and add stronger two-factor authentication.',
                        'If official IDs were exposed, follow the issuer or national reporting process for fraud monitoring or reissue where applicable.'
                    ],
                    'Tell me which data was exposed: ID document, email, phone number, bank info, or full KYC.'
                );
            }

            if (/(romance|job scam|courier|parcel|delivery|customs|sextortion|blackmail|telegram scam|whatsapp scam|investment scam|pig butchering)/.test(lower)) {
                return respond(
                    'Social-engineering scam warning',
                    [
                        'Stop responding, do not send money, and do not move the conversation to another app under pressure.',
                        'Do not share ID documents, selfies, OTPs, wallet approvals, or advance fees.',
                        'Keep screenshots and account names in case you need to report or block the scam.'
                    ],
                    'Tell me what kind of scam it looks like and whether money or account access is already involved.'
                );
            }

            if (/(safe\?|is this safe|can i trust|legit|genuine|real or fake|is this real)/.test(lower)) {
                return respond(
                    'Quick cybersecurity triage',
                    [
                        'Treat urgency, secrecy, payment pressure, login prompts, OTP requests, and unexpected downloads as major warning signs.',
                        'Verify through an official website or contact channel that you open yourself, not the one in the message.',
                        'Do not share credentials or send money until the request is independently confirmed.'
                    ],
                    'If you send the exact message, link, screenshot text, or situation, I can give a sharper judgment.'
                );
            }

            return respond(
                'SAFY cybersecurity support',
                [
                    'I can help with hacked accounts, phishing, suspicious links, malware, payment fraud, identity theft, deepfakes, Wi-Fi security, fake alerts, and recovery steps.',
                    'If you have a message, URL, email text, QR code destination, or account issue, share the exact details so I can guide you more precisely.',
                    'If there is immediate risk to money, email, banking, or your main phone number, say that first so I can prioritize containment.'
                ],
                'Start with one line: what happened, and what system or account was affected?'
            );
        }

        async function queryGeminiViaProxy(payload) {
            let lastError = null;

            for (let i = 0; i < GEMINI_PROXY_ENDPOINTS.length; i++) {
                const endpoint = GEMINI_PROXY_ENDPOINTS[i];
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error('Gemini proxy failed at ' + endpoint + ' with status ' + response.status);
                    }

                    const data = await response.json();
                    return extractGeminiText(data);
                } catch (error) {
                    lastError = error;
                }
            }

            throw lastError || new Error('No Gemini proxy endpoint responded.');
        }

        async function queryAssistant(userInput) {
            const payload = {
                _requestType: 'chat',
                contents: [
                    { role: 'user', parts: [{ text: 'System Instruction: ' + systemPrompt + '\n\nSAFE-NET Context:\n' + safeNetSiteContext }] },
                    { role: 'model', parts: [{ text: 'Understood. I will respond as SAFY, a highly professional cybersecurity specialist with a human, interactive tone.' }] }
                ].concat(safyHistory).concat([
                    { role: 'user', parts: [{ text: buildVisitorContext() + '\n\nUser Message:\n' + userInput }] }
                ]),
                generationConfig: {
                    temperature: 0.55,
                    maxOutputTokens: 360
                }
            };

            try {
                const proxyText = await queryGeminiViaProxy(payload);
                if (proxyText) {
                    return { text: proxyText, source: 'proxy' };
                }
            } catch (error) {
                console.warn('Shield AI proxy path unavailable:', error);
            }

            return { text: buildLocalShieldResponse(userInput), source: 'local' };
        }

        function openAssistant(options) {
            const opts = options || {};
            revealAssistantLauncher();
            hideScrollCue();
            chatWindow.classList.add('active');
            if (opts.message) {
                const introText = opts.ping
                    ? '<strong>[PROACTIVE ALERT]</strong><br><br>' + escapeHtml(opts.message)
                    : formatAssistantText(opts.message);
                appendMessage('ai', introText, true);
            }
            requestAnimationFrame(function () {
                if (chatInputField) chatInputField.focus();
            });
        }

        async function sendMessage(text) {
            if (!text) return;

            visitorSignals.messagesSent += 1;
            appendMessage('user', text, false);
            if (chatInputField) chatInputField.value = '';

            const thinkingId = showThinking();

            try {
                const result = await queryAssistant(text);
                removeThinking(thinkingId);

                if (result && result.text) {
                    safyHistory.push({ role: 'user', parts: [{ text: text }] });
                    safyHistory.push({ role: 'model', parts: [{ text: result.text }] });

                    if (safyHistory.length > 12) {
                        safyHistory.splice(0, safyHistory.length - 12);
                    }

                    appendMessage('ai', formatAssistantText(result.text), true);
                } else {
                    appendMessage('ai', '<strong>[SAFY]</strong><br><br>I could not generate a response from the current input. Please try again with a little more detail.', true);
                }
            } catch (error) {
                console.error('Shield AI error:', error);
                removeThinking(thinkingId);
                appendMessage('ai', formatAssistantText(buildLocalShieldResponse(text)), true);
            }
        }

        agentBtn.addEventListener('click', function () {
            chatWindow.classList.toggle('active');
            if (chatWindow.classList.contains('active')) {
                hideScrollCue();
            }
            if (chatWindow.classList.contains('active') && chatInputField) {
                chatInputField.focus();
            }
        });

        if (closeChatBtn) {
            closeChatBtn.addEventListener('click', function () {
                chatWindow.classList.remove('active');
            });
        }

        if (safyScrollCue) {
            safyScrollCue.addEventListener('click', function () {
                openAssistant({
                    ping: true,
                    message: 'You can ask me about SAFE-NET, scan-related questions, phishing, scams, account compromise, or any cybersecurity concern.'
                });
            });
        }

        chatOptionButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                sendMessage(btn.getAttribute('data-query') || '');
            });
        });

        if (chatSendBtn) {
            chatSendBtn.addEventListener('click', function () {
                sendMessage(chatInputField ? chatInputField.value.trim() : '');
            });
        }

        if (chatInputField) {
            chatInputField.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    sendMessage(chatInputField.value.trim());
                }
            });
        }

        window.addEventListener('scroll', function () {
            const sections = ['contact', 'scenarios', 'about', 'home'];
            for (let i = 0; i < sections.length; i++) {
                const section = document.getElementById(sections[i]);
                if (section && window.scrollY >= section.offsetTop - 180) {
                    visitorSignals.lastSection = sections[i];
                    break;
                }
            }

            if (!launcherRevealed || chatWindow.classList.contains('active') || window.scrollY < 120) {
                return;
            }

            const now = Date.now();
            if (visitorSignals.lastSection !== lastCueSection || now - lastCueAt > 14000) {
                lastCueSection = visitorSignals.lastSection;
                lastCueAt = now;
                showScrollCue(sectionCueCopy[visitorSignals.lastSection] || sectionCueCopy.home);
            }
        }, { passive: true });

        window.openSAFY = openAssistant;
        window.__ZTAS_SHIELD_OPEN_SAFY__ = openAssistant;
    });

})();

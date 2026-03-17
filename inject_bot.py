import sys, re, os

# 1. Read the source from index.html and style.css
try:
    with open('index.html', 'r', encoding='utf-8') as f:
        index_content = f.read()
    with open('style.css', 'r', encoding='utf-8') as f:
        style_content = f.read()
except FileNotFoundError as e:
    print(f"Error: Required file missing: {e}")
    sys.exit(1)

# Extract Bot HTML
html_match = re.search(r'(<!-- Emergency AI Agent Bubble & Chat Window -->.*?<div class="emergency-agent-container".*?</div>\s*</div>)', index_content, re.DOTALL)
if not html_match:
     html_match = re.search(r'(<div class="emergency-agent-container".*?</div>\s*</div>)', index_content, re.DOTALL)

# Extract Bot Script
logic_match = re.search(r'(<!-- Emergency AI Agent Logic.*?)(?=\s*</body>)', index_content, re.DOTALL)

# Extract Bot CSS from style.css
# We look for the section between EMERGENCY AI AGENT BUBBLE and the next section or ultra premium mobile optimizations
css_match = re.search(r'(/\* =+ EMERGENCY AI AGENT BUBBLE =+ \*/.*?)(?=\s*/\* =+ ULTRA PREMIUM MOBILE OPTIMIZATIONS)', style_content, re.DOTALL)
if not css_match:
    # Fallback search if comments changed
    css_match = re.search(r'(.emergency-agent-container \{.*?)(?=\s*/\* =+)', style_content, re.DOTALL)

if html_match and logic_match and css_match:
    bot_html = html_match.group(0).strip()
    bot_logic = logic_match.group(0).strip()
    bot_css = css_match.group(0).strip()
    
    # Also include the mobile styles for the bot from style.css
    mobile_css_match = re.search(r'/\* Emergency AI Agent Chat Window \*/.*?\}\s*\}', style_content, re.DOTALL)
    if mobile_css_match:
        bot_css += "\n\n/* Mobile Styles */\n@media (max-width: 768px) {\n" + mobile_css_match.group(0).strip() + "\n}"
    
    print("Extracted Bot Components: HTML, Logic, and CSS.")
    
    target_files = ['safe.html', 'login.html', 'signup.html']
    for target in target_files:
        if not os.path.exists(target):
            continue
            
        with open(target, 'r', encoding='utf-8') as f:
            tgt_content = f.read()
            
        # 1. Inject/Update CSS
        if '/* AI Bot Styles */' in tgt_content or '.emergency-agent-container' in tgt_content:
            # Try to replace existing block if it has our marker
            tgt_content = re.sub(r'/\* AI Bot Styles \*/.*?(?=</style>)', f'/* AI Bot Styles */\n{bot_css}\n    ', tgt_content, flags=re.DOTALL)
        else:
            # Inject into the last style block
            if '</style>' in tgt_content:
                # Find the last </style>
                parts = tgt_content.rsplit('</style>', 1)
                tgt_content = parts[0] + f'\n    /* AI Bot Styles */\n{bot_css}\n    </style>' + parts[1]
            else:
                # Create a new style block in head
                tgt_content = tgt_content.replace('</head>', f'<style>\n/* AI Bot Styles */\n{bot_css}\n</style>\n</head>')

        # 2. Inject/Update HTML
        if 'emergency-agent-container' in tgt_content:
            # Replace existing HTML block
            # We match the whole section from start comment to container end
            tgt_content = re.sub(r'<!-- Emergency AI Agent Bubble & Chat Window -->.*?<div class="emergency-agent-container".*?</div>\s*</div>', bot_html, tgt_content, flags=re.DOTALL) or \
                          re.sub(r'<div class="emergency-agent-container".*?</div>\s*</div>', bot_html, tgt_content, flags=re.DOTALL)
        else:
            # Inject before body close
            tgt_content = tgt_content.replace('</body>', '\n' + bot_html + '\n\n</body>')

        # 3. Inject/Update Logic
        if 'Emergency AI Agent Logic' in tgt_content:
            # Replace existing script block
            tgt_content = re.sub(r'<!-- Emergency AI Agent Logic.*?</body>', bot_logic + '\n</body>', tgt_content, flags=re.DOTALL)
        else:
            # Inject before body close
            tgt_content = tgt_content.replace('</body>', '\n' + bot_logic + '\n</body>')

        with open(target, 'w', encoding='utf-8') as f:
            f.write(tgt_content)
        print(f"Propagated components to {target}")
else:
    if not html_match: print("Failed to extract HTML")
    if not logic_match: print("Failed to extract Logic")
    if not css_match: print("Failed to extract CSS")

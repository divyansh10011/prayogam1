import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('safe.js', 'rb') as f:
    content = f.read().decode('utf-8')

# Remove the stray '  }' that sits between the ZTAS LLM ENGINE comment and analyzeWithLLM
STRAY = '  /* ================= ZTAS LLM ENGINE (GEMINI) ================= */\n  }\n\n  async function analyzeWithLLM'
FIXED = '  /* ================= ZTAS LLM ENGINE (GEMINI) ================= */\n\n  async function analyzeWithLLM'

if STRAY in content:
    content = content.replace(STRAY, FIXED, 1)
    print('Removed stray } before analyzeWithLLM')
else:
    # Try with \r\n
    STRAY2 = '  /* ================= ZTAS LLM ENGINE (GEMINI) ================= */\r\n  }\r\n\r\n  async function analyzeWithLLM'
    FIXED2 = '  /* ================= ZTAS LLM ENGINE (GEMINI) ================= */\r\n\r\n  async function analyzeWithLLM'
    if STRAY2 in content:
        content = content.replace(STRAY2, FIXED2, 1)
        print('Removed stray } before analyzeWithLLM (CRLF variant)')
    else:
        # Mixed line endings - find and remove by position
        COMMENT = '  /* ================= ZTAS LLM ENGINE (GEMINI) ================= */'
        LLM_FN  = '  async function analyzeWithLLM'
        c_pos = content.find(COMMENT)
        l_pos = content.find(LLM_FN, c_pos)
        if c_pos != -1 and l_pos != -1:
            between = content[c_pos + len(COMMENT):l_pos]
            print(f'Between comment and LLM fn: {repr(between)}')
            # Remove any standalone } in between
            cleaned = '\n\n'
            content = content[:c_pos + len(COMMENT)] + cleaned + content[l_pos:]
            print('Removed stray } (position-based)')
        else:
            print(f'ERROR: Could not find markers. c_pos={c_pos}, l_pos={l_pos}')

# Verify depth
def smart_depth(text):
    depth = 0
    in_string = None
    in_block_comment = False
    for line in text.splitlines():
        in_line_comment = False
        j = 0
        while j < len(line):
            ch = line[j]
            if in_block_comment:
                if ch == '*' and j+1 < len(line) and line[j+1] == '/':
                    in_block_comment = False; j += 2; continue
                j += 1; continue
            if in_line_comment: break
            if in_string:
                if ch == '\\': j += 2; continue
                if ch == in_string: in_string = None
                j += 1; continue
            if ch == '/' and j+1 < len(line):
                if line[j+1] == '/': in_line_comment = True; break
                if line[j+1] == '*': in_block_comment = True; j += 2; continue
            if ch in ('"', "'", '`'): in_string = ch; j += 1; continue
            if ch == '{': depth += 1
            elif ch == '}': depth -= 1
            j += 1
    return depth

depth = smart_depth(content)
print(f'Brace depth after fix: {depth}')

if depth == 0:
    with open('safe.js', 'wb') as f:
        f.write(content.encode('utf-8'))
    print('Saved. File is balanced.')
elif depth == -1:
    print('Still -1, there is another stray } somewhere. NOT saving until that is found.')
else:
    print(f'Unexpected depth {depth}. Saving anyway for inspection.')
    with open('safe.js', 'wb') as f:
        f.write(content.encode('utf-8'))

import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('safe.js', 'rb') as f:
    content = f.read().decode('utf-8')
lines = content.splitlines(keepends=True)
print(f'Lines: {len(lines)}')

# Find the stray } before analyzeWithLLM
MARKER = 'async function analyzeWithLLM'
pos = content.find(MARKER)
if pos != -1:
    line_start = content.rfind('\n', 0, pos) + 1
    # Show 6 lines before it
    snippet = content[max(0, line_start - 400):line_start]
    snippet_lines = snippet.splitlines()
    print(f'Lines before analyzeWithLLM:')
    for l in snippet_lines[-8:]:
        print(f'  {repr(l[:80])}')
else:
    print('analyzeWithLLM not found')

# Quick brace depth check
def smart_depth(text):
    depth = 0
    in_string = None
    in_block_comment = False
    for i, line in enumerate(text.splitlines()):
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
            if ch == '/' and j+1 < len(line):
                prev = line[:j].rstrip()
                if prev and prev[-1] in '=(/[!&|,{};:?,><^~':
                    j += 1
                    while j < len(line):
                        if line[j] == '\\': j += 2; continue
                        if line[j] == '/': j += 1
                        while j < len(line) and line[j].isalpha(): j += 1
                        break
                    j += 1; continue
            if ch in ('"', "'", '`'): in_string = ch; j += 1; continue
            if ch == '{': depth += 1
            elif ch == '}': depth -= 1
            j += 1
    return depth

print(f'\nCurrent brace depth: {smart_depth(content)}')

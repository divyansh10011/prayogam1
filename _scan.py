import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('safe.js', 'rb') as f:
    content = f.read().decode('utf-8')

lines = content.splitlines(keepends=True)
print(f'Lines: {len(lines)}')

# Full state-machine brace tracker — report every depth change at top level
depth = 0
in_string = None
in_block_comment = False

depth_history = []  # (line_num, depth_after_line)

for i, line in enumerate(lines):
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
    depth_history.append((i+1, depth))

print(f'Final depth: {depth}')

# Find ALL places where depth goes down to 0 (function closes at top level)
print('\nAll depth 1->0 transitions (function closes):')
prev_d = 0
for ln, d in depth_history:
    if prev_d == 1 and d == 0:
        print(f'  L{ln}: {lines[ln-1].strip()[:70]}')
    if prev_d == 0 and d == -1:
        print(f'  L{ln} EXTRA CLOSE (depth -1): {lines[ln-1].strip()[:70]}')
    if prev_d == -1 and d == -2:
        print(f'  L{ln} EXTRA CLOSE (depth -2): {lines[ln-1].strip()[:70]}')
    prev_d = d

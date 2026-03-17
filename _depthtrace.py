import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('safe.js', 'rb') as f:
    content = f.read().decode('utf-8')

lines = content.splitlines(keepends=True)
print(f'Lines: {len(lines)}')

# Use the bracecheck2 tool approach - more reliable
# Track depth at each line (no regex confusion)
# Only track { and } outside strings and comments

def get_line_depths(text):
    lines_list = text.splitlines(keepends=True)
    depths = []
    depth = 0
    in_string = None
    string_char = None
    in_block_comment = False
    
    for i, line in enumerate(lines_list):
        line_start_depth = depth
        in_line_comment = False
        j = 0
        s = line.rstrip('\r\n')
        
        while j < len(s):
            ch = s[j]
            if in_block_comment:
                if ch == '*' and j+1 < len(s) and s[j+1] == '/':
                    in_block_comment = False; j += 2; continue
                j += 1; continue
            if in_line_comment: break
            if in_string:
                if ch == '\\': j += 2; continue
                if ch == in_string and in_string != '`': 
                    in_string = None; j += 1; continue
                if in_string == '`' and ch == '`':
                    in_string = None; j += 1; continue
                j += 1; continue
            if ch == '/':
                if j+1 < len(s):
                    if s[j+1] == '/': in_line_comment = True; j += 2; continue
                    if s[j+1] == '*': in_block_comment = True; j += 2; continue
            if ch in ('"', "'", '`'): in_string = ch; j += 1; continue
            if ch == '{': depth += 1
            elif ch == '}': depth -= 1
            j += 1
        depths.append((i+1, line_start_depth, depth, s[:60]))
    return depths

depths = get_line_depths(content)

# Show depth around renderFormattedReport (L4067 area) and the area right after
print('\nDepth around renderFormattedReport for-loop (L4140-4200):')
for ln, d_start, d_end, text in depths[4139:4200]:
    marker = ' <<<' if d_end < d_start else ''
    print(f'  L{ln}: start={d_start} end={d_end} | {text[:60]}{marker}')

print(f'\nFinal depth: {depths[-1][2]}')

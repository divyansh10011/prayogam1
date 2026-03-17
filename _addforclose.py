import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('safe.js', 'rb') as f:
    content = f.read().decode('utf-8')

# The for loop inside renderFormattedReport is missing its closing }
# After the else { html += ...; } at line 4190-4191
# we need to add '    }' to close the for loop
# before the 'if (currentSection === ...' cleanup lines

MARKER = "      } else {\r\n        html += `<div class=\"raw-line\">${rawLine}</div>`;\r\n      }\r\n\r\n    if (currentSection === 'action')"
FIXED  = "      } else {\r\n        html += `<div class=\"raw-line\">${rawLine}</div>`;\r\n      }\r\n    }\r\n\r\n    if (currentSection === 'action')"

if MARKER in content:
    content = content.replace(MARKER, FIXED, 1)
    print('Added missing for-loop closing brace')
else:
    # Try with mixed endings
    MARKER2 = "      } else {\n        html += `<div class=\"raw-line\">${rawLine}</div>`;\n      }\r\n\r\n    if (currentSection === 'action')"
    FIXED2  = "      } else {\n        html += `<div class=\"raw-line\">${rawLine}</div>`;\n      }\n    }\r\n\r\n    if (currentSection === 'action')"
    if MARKER2 in content:
        content = content.replace(MARKER2, FIXED2, 1)
        print('Added missing for-loop closing brace (mixed variant)')
    else:
        # Find by position between the else-close and the if(currentSection
        ELSE_CLOSE = "      } else {\r\n        html += `<div class=\"raw-line\">${rawLine}</div>`;\r\n      }"
        CURRENT_SECTION = "\r\n\r\n    if (currentSection === 'action') html +="
        pos1 = content.rfind(ELSE_CLOSE)
        pos2 = content.find(CURRENT_SECTION, pos1) if pos1 != -1 else -1
        print(f'else-close at: {pos1}, currentSection at: {pos2}')
        if pos1 != -1 and pos2 != -1:
            between = content[pos1 + len(ELSE_CLOSE):pos2]
            print(f'Between: {repr(between)}')
            # Insert the for-loop close
            insert_pos = pos1 + len(ELSE_CLOSE)
            content = content[:insert_pos] + '\r\n    }' + content[insert_pos:]
            print('Added missing for-loop closing brace (position-based)')

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

with open('safe.js', 'wb') as f:
    f.write(content.encode('utf-8'))
print(f'Saved. Lines: {len(content.splitlines())}')

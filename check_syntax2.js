const fs = require('fs');
const code = fs.readFileSync('safe.js', 'utf8');
const lines = code.split('\n');

const start = 2555; // 0-indexed for 2556
const end = 3496;

function check(limit) {
  const section = lines.slice(start, limit).join('\n');
  try {
    new Function(section);
    return true; // syntactically valid (meaning braces/parens etc. that are opened are closed OR if we truncate, it might say unexpected end of input)
  } catch(e) {
    if (e.message.includes('Unexpected token ') && e.message !== "Unexpected token '}'" && !e.message.includes('end of input')) {
        // If it's a structural error like unexpected string or something
        return false;
    }
    // We expect "Unexpected end of input" if we slice in the middle of a function
    return true; 
  }
}

// Better way: Look for unmatched delimiters specifically in this range
function checkDelimiters(from, to) {
    let state = 'code';
    let parens = 0, braces = 0, brackets = 0;
    
    for (let i = from; i < to; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        const next = j < line.length - 1 ? line[j+1] : '';
        
        switch (state) {
          case 'code':
            if (c === '/' && next === '/') { state = 'line_comment'; j++; }
            else if (c === '/' && next === '*') { state = 'block_comment'; j++; }
            else if (c === "'") state = 'string_single';
            else if (c === '"') state = 'string_double';
            else if (c === '`') state = 'template';
            
            else if (c === '(') parens++;
            else if (c === ')') {
                parens--;
                if (parens < 0) {
                    console.log(`Unmatched ')' at line ${i+1}`);
                    return;
                }
            }
            else if (c === '{') braces++;
            else if (c === '}') braces--;
            else if (c === '[') brackets++;
            else if (c === ']') brackets--;
            break;
            
          case 'string_single':
            if (c === '\\') j++;
            else if (c === "'") state = 'code';
            break;
          case 'string_double':
            if (c === '\\') j++;
            else if (c === '"') state = 'code';
            break;
          case 'template':
            if (c === '\\') j++;
            else if (c === '$' && next === '{') { braces++; j++; state = 'code'; }
            else if (c === '`') state = 'code';
            break;
          case 'block_comment':
            if (c === '*' && next === '/') { state = 'code'; j++; }
            break;
        }
      }
      if (state === 'line_comment') state = 'code';
    }
    console.log(`Region ${from+1}-${to}: parens=${parens}, braces=${braces}, brackets=${brackets}, state=${state}`);
}

checkDelimiters(start, end);

// Another way: wrap it in async function and pass it to node
const fullFunction = lines.slice(start, end).join('\n');
try {
  const vm = require('vm');
  new vm.Script(fullFunction);
  console.log("No syntax error in analyzeMessage when compiled in isolation (though this is unlikely given previous output).");
} catch(e) {
  console.log("Error when compiling analyzeMessage in isolation: ", e.message);
  
  // Try to find the exact line by checking lines backwards
  for(let i = end - 1; i >= start; i--) {
      // replace the line with empty
      const testLines = lines.slice(start, end);
      testLines[i - start] = '';
      try {
          new vm.Script(testLines.join('\n'));
          console.log(`Removing line ${i+1} fixes the error!`);
          console.log(`Line was: ${lines[i]}`);
      } catch(e) {
          // still error
      }
  }
}

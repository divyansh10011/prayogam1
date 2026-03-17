const fs = require('fs');
const code = fs.readFileSync('safe.js', 'utf8');
const lines = code.split('\n');

const start = 2555; // 0-indexed for 2556
const end = 3496;

let state = 'code';
let stringStart = -1;

for (let i = start; i < end; i++) {
  const line = lines[i];
  const oldState = state;
  let lineChanges = false;
  
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    const next = j < line.length - 1 ? line[j+1] : '';
    
    switch (state) {
      case 'code':
        if (c === '/' && next === '/') { j++; break; } // skip rest of line
        else if (c === '/' && next === '*') { state = 'block_comment'; j++; }
        else if (c === "'") { state = 'string_single'; stringStart = i; lineChanges = true; }
        else if (c === '"') { state = 'string_double'; stringStart = i; }
        else if (c === '`') { state = 'template'; stringStart = i; }
        break;
      case 'string_single':
        if (c === '\\') j++;
        else if (c === "'") { state = 'code'; lineChanges = true; }
        break;
      case 'string_double':
        if (c === '\\') j++;
        else if (c === '"') state = 'code';
        break;
      case 'template':
        if (c === '\\') j++;
        else if (c === '$' && next === '{') { j++; state = 'code'; } // naive
        else if (c === '`') state = 'code';
        break;
      case 'block_comment':
        if (c === '*' && next === '/') { state = 'code'; j++; }
        break;
    }
    if (state === 'code' && c === '/' && next === '/') break;
  }
  
  // Single and double quotes cannot span multiple lines unless escaped at the end
  if (state === 'string_single' && !line.endsWith('\\')) {
      console.log(`Unclosed single quote started at line ${stringStart + 1}:`);
      console.log(`> ${lines[stringStart]}`);
      break;
  }
}

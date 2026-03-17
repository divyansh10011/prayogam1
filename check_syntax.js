const fs = require('fs');
const code = fs.readFileSync('safe.js', 'utf8');

// Use esprima or acorn to get exact error location
// Since we can't install, let's use Node VM with better error handling
const vm = require('vm');

try {
  // Check as a script (not module)
  new vm.Script(code, { filename: 'safe.js' });
  console.log('No syntax errors!');
} catch(e) {
  // Get line/col from the error
  const match = e.stack.match(/safe\.js:(\d+)/);
  if (match) {
    const errLine = parseInt(match[1]);
    console.log(`Error at line ${errLine}: ${e.message}`);
    const lines = code.split('\n');
    for (let i = Math.max(0, errLine-5); i <= Math.min(lines.length-1, errLine+2); i++) {
      const marker = (i+1 === errLine) ? '>>>' : '   ';
      console.log(`${marker} ${i+1}: ${lines[i].trimEnd().substring(0, 150)}`);
    }
  } else {
    console.log(e.message);
    console.log(e.stack);
  }
}

// Also try detecting the problem by wrapping each function separately 
// Find the analyzeMessage function which was mentioned as problematic
const lines = code.split('\n');
const analyzeMessageStart = lines.findIndex(l => l.includes('async function analyzeMessage'));
const analyzeDeepfakeStart = lines.findIndex(l => l.includes('async function analyzeDeepfake'));
const analyzeVoiceCloneStart = lines.findIndex(l => l.includes('async function analyzeVoiceClone'));

console.log(`\nanalyzeMessage starts at line ${analyzeMessageStart + 1}`);
console.log(`analyzeDeepfake starts at line ${analyzeDeepfakeStart + 1}`);
console.log(`analyzeVoiceClone starts at line ${analyzeVoiceCloneStart + 1}`);

// Check if the issue is between analyzeMessage and analyzeDeepfake
// Try to parse that section
function checkSection(start, end, label) {
  const section = lines.slice(start, end).join('\n');
  try {
    new Function(section);
    console.log(`${label} (lines ${start+1}-${end}): OK`);
  } catch(e) {
    console.log(`${label} (lines ${start+1}-${end}): ERROR - ${e.message}`);
  }
}

checkSection(analyzeMessageStart, analyzeDeepfakeStart, 'analyzeMessage section');
checkSection(analyzeDeepfakeStart, analyzeVoiceCloneStart, 'analyzeDeepfake section');
checkSection(analyzeVoiceCloneStart, analyzeVoiceCloneStart + 160, 'analyzeVoiceClone section');

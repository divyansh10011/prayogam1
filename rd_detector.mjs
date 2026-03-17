import { RealityDefender } from '@realitydefender/realitydefender';
import fs from 'fs';

const apiKey = 'rd_de444730658d3ff8_f939137b6f7c318b030e482614d9d060';
const realityDefender = new RealityDefender({ apiKey });

const filePath = process.argv[2];

if (!filePath || !fs.existsSync(filePath)) {
    console.error(JSON.stringify({ success: false, error: "File not found" }));
    process.exit(1);
}

async function run() {
    try {
        const result = await realityDefender.detect({ filePath });
        console.log(JSON.stringify({ success: true, result }));
    } catch (error) {
        console.error(JSON.stringify({ success: false, error: error.message || String(error) }));
        process.exit(1);
    }
}
run();

import { splitLargeNote } from './lib/ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
async function run() {
  try {
    const text = "VISVESVARAYA TECHNOLOGICAL UNIVERSITY\nJNANASANGAMA, BELAGAVI - 590018, KARNATAKA\n\nA Project Report on\nHEART SIM: 3D Interactive Heart Simulator".repeat(50);
    const splits = await splitLargeNote(text);
    console.log("Success! Splits:", splits.length);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();

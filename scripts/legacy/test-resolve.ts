import { GeminiService } from "./server/gemini.js";

const service = new GeminiService();
// We can test if it succeeds with gemini-2.5-flash
async function test() {
  try {
    const res = await service.generateDescription("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
    console.log("SUCCESS:", res);
  } catch (e: any) {
    console.log("FAILED:", e.message);
  }
}
test();

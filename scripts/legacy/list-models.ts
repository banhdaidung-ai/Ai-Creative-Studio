import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.list();
    console.log("Response structure:", JSON.stringify(response, null, 2));
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}
run();

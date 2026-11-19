import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello'
    });
    console.log("GEMINI_API_KEY is VALID:", response.text);
  } catch (e) {
    console.error("GEMINI_API_KEY is INVALID:", e.message);
  }
}
run();

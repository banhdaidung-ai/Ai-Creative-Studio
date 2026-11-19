import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello'
    });
    console.log("API_KEY is VALID:", response.text);
  } catch (e) {
    console.error("API_KEY is INVALID:", e.message);
  }
}
run();

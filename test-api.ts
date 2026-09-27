import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    console.log("Using key:", process.env.GEMINI_API_KEY);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello'
    });
    console.log("SUCCESS:", response.text);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
run();

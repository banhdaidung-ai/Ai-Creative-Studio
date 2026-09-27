import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: 'Hello'
    });
    console.log("SUCCESS:", response.text);
  } catch (e: any) {
    console.error("ERROR MESSAGE:", e.message);
  }
}
run();

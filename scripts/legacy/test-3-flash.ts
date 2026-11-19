import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Hello'
    });
    console.log("SUCCESS:", response.text);
  } catch (e: any) {
    console.error("ERROR TYPE:", e.constructor.name);
    console.error("ERROR MESSAGE:", e.message);
  }
}
run();

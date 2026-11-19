import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Latest news about fashion in 2026',
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    console.log("SUCCESS! Answer:", response.text?.substring(0, 200));
    console.log("Grounding metadata:", JSON.stringify(response.candidates?.[0]?.groundingMetadata, null, 2)?.substring(0, 300));
  } catch (e: any) {
    console.error("ERROR MESSAGE:", e.message);
  }
}
run();

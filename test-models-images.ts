import { GoogleGenAI } from "@google/genai";

const models = [
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
];

async function run() {
  const key = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: key });

  for (const model of models) {
    try {
      console.log(`\n--- Testing model: ${model} ---`);
      const response = await ai.models.generateContent({
        model: model,
        contents: 'A beautiful cat',
        config: {
          imageConfig: {
            aspectRatio: '1:1',
          }
        }
      });
      console.log(`SUCCESS for ${model}: Got response!`);
      // check if we got image bytes
      let gotImage = false;
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData) gotImage = true;
        }
      }
      console.log(`Got image? ${gotImage}`);
    } catch (e: any) {
      console.error(`FAILED for ${model}:`, e.message);
    }
  }
}
run();

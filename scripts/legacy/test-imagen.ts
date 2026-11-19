import { GoogleGenAI } from "@google/genai";

async function run() {
  try {
    const key = process.env.GEMINI_API_KEY;
    console.log("Testing generateImages with key starting with:", key ? key.substring(0, 8) : "missing");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: 'A beautiful sunset over the mountains',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });
    console.log("SUCCESS:", response.generatedImages?.[0]?.image?.imageBytes ? "Got image bytes" : "No image bytes");
  } catch (e: any) {
    console.error("ERROR TYPE:", e.constructor.name);
    console.error("ERROR MESSAGE:", e.message);
    if (e.status) console.error("ERROR STATUS:", e.status);
    if (e.error) console.error("ERROR DETAILS:", JSON.stringify(e.error));
  }
}
run();

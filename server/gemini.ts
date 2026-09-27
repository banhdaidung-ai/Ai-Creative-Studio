
// ... existing imports ...
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Vertex AI REST API types
interface VertexResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
    finishReason?: string;
    groundingMetadata?: any;
  }>;
}

export const ANGLE_CONFIGS = [
    // ... existing configs
    { id: 'full', name: "TOÀN THÂN (FULL BODY)", desc: "Góc máy rộng, thấy toàn bộ.", promptDesc: "Wide angle, full body shot showing the entire outfit and shoes. Validating fit and drape.", userDesc: "Walking confidently towards the camera, one hand swinging naturally, looking slightly to the side with a clear, sharp face." },
    { id: 'medium', name: "TRUNG CẢNH (MEDIUM SHOT)", desc: "Ngang đùi, tập trung dáng.", promptDesc: "Medium shot, from waist up. Focus on upper body garment details and layering.", userDesc: "Standing relaxed, weight shifted to one leg, hands in pockets. Face is the focal point, sharp and detailed." },
    { id: 'close', name: "CẬN CẢNH (CLOSE-UP)", desc: "Ngang ngực, rõ biểu cảm.", promptDesc: "Close up portrait. Focus on fabric texture, collar details, and accessories near face.", userDesc: "Looking over the shoulder, slight smile. Face features are high definition and perfectly preserved." },
    { id: 'macro', name: "CHI TIẾT (MACRO/DETAIL)", desc: "Cận chất liệu vải.", promptDesc: "Extreme close up macro shot of the fabric texture and stitching details.", userDesc: "Hand holding the lapel or adjusting a button to show fabric quality." },
    { id: 'low', name: "GÓC THẤP (LOW ANGLE)", desc: "Góc máy từ dưới lên.", promptDesc: "Low angle, dynamic fashion pose. Creating a heroic, elongated look.", userDesc: "Power stance, legs slightly apart. Face remains undistorted and clear, looking down at the camera with a fierce expression." },
    { id: 'back', name: "GÓC SAU (BACK VIEW)", desc: "Chi tiết lưng trang phục.", promptDesc: "Full body shot from behind to showcase back details of the garment.", userDesc: "Walking away from camera, turning head slightly back over shoulder to connect with viewer. Profile of face is visible and accurate." },
    { id: 'sitting', name: "DÁNG NGỒI (SITTING)", desc: "Thoải mái trên ghế/bục.", promptDesc: "Full body shot, model sitting on a simple stool or apple box. Casual and relaxed vibe.", userDesc: "Sitting with legs crossed, leaning forward slightly. Face is sharp, natural expression." },
    { id: 'profile', name: "GÓC NGHIÊNG (PROFILE)", desc: "Form dáng nhìn ngang.", promptDesc: "Side profile full body shot. Highlighting the silhouette and cut of the clothes.", userDesc: "Standing sideways, looking straight ahead. Profile facial features match the front view identity perfectly." },
    { id: 'dynamic', name: "CHUYỂN ĐỘNG (DYNAMIC)", desc: "Tạo cảm giác bay bổng.", promptDesc: "Dynamic fashion shot capturing natural movement.", userDesc: "Walking forward energetically, clothes flowing naturally. Face remains perfectly stable, sharp, and undistorted despite motion." },
    { id: 'high', name: "GÓC CAO (HIGH ANGLE)", desc: "Góc máy từ trên xuống.", promptDesc: "High angle shot looking down at model. Focusing on outfit coordination.", userDesc: "Looking up at camera, one hand on hip. Face is clear and accurately proportioned." }
];

export const MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-lite-image', name: 'Nano Banana Lite', desc: 'Tốc độ nhanh, tác vụ cơ bản.', tier: 'standard' },
  { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2', desc: 'Chất lượng cao, đa dạng tỉ lệ, tìm kiếm.', tier: 'pro' },
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro', desc: 'Chi tiết cao, suy luận phức tạp.', tier: 'pro' },
  { id: 'imagen-4.0-generate-001', name: 'Imagen 4', desc: 'Nghệ thuật cao cấp, photorealistic.', tier: 'pro' }
];

export const isKeyInvalid = (key?: string): boolean => {
  if (!key) return true;
  const k = key.trim();
  return k === '' || 
         k.includes('AI Studio Free Tier') || 
         k.includes('null') || 
         k.includes('undefined') || 
         k.includes('Default') ||
         (!k.startsWith('AIza') && !k.startsWith('AQ.')) || 
         k.length < 25;
};

export const isFreeTierKey = (key?: string): boolean => {
  if (!key) return true;
  const k = key.trim();
  return k.startsWith('AQ.') || 
         k === process.env.API_KEY || 
         k.includes('AI Studio Free Tier') || 
         isKeyInvalid(k);
};

export class GeminiService {
  constructor(private customKey?: string, private vertexConfig?: { projectId: string, location: string, accessToken: string }) {}

  private getApiKey(): string {
    if (!isKeyInvalid(this.customKey)) {
      console.log(`[GeminiService] Using customKey from client: ${this.customKey!.substring(0, 4)}...`);
      return this.customKey!.trim();
    }
    
    if (!isKeyInvalid(process.env.GEMINI_API_KEY)) {
      console.log(`[GeminiService] Using process.env.GEMINI_API_KEY: ${process.env.GEMINI_API_KEY!.substring(0, 4)}...`);
      return process.env.GEMINI_API_KEY!;
    }

    if (!isKeyInvalid(process.env.API_KEY)) {
      console.log(`[GeminiService] Using process.env.API_KEY: ${process.env.API_KEY!.substring(0, 4)}...`);
      return process.env.API_KEY!;
    }

    console.log("[GeminiService] No API key found!");
    return '';
  }

  private getVertexConfig() {
    if (this.vertexConfig && this.vertexConfig.projectId && this.vertexConfig.accessToken) {
      return this.vertexConfig;
    }
    const projectId = process.env.VERTEX_PROJECT_ID || '';
    const location = process.env.VERTEX_LOCATION || 'us-central1';
    const accessToken = process.env.VERTEX_ACCESS_TOKEN || '';
    return { projectId, location, accessToken };
  }

  public getClient(customKey?: string): GoogleGenAI {
     // Fallback to Google AI (API Key)
     const keyToUse = (customKey && !isKeyInvalid(customKey)) ? customKey.trim() : this.getApiKey();
     const maskedKey = keyToUse.length > 8 
        ? `${keyToUse.substring(0, 4)}...${keyToUse.substring(keyToUse.length - 4)}`
        : 'INVALID_KEY';
     console.log(`[GeminiService] Initializing Google AI client. Key: ${maskedKey}`);
     return new GoogleGenAI({ apiKey: keyToUse });
  }

  private getNormalizedAspectRatio(ratio: string): string {
    const supportedRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    const trimmed = (ratio || '').trim();
    if (supportedRatios.includes(trimmed)) {
        return trimmed;
    }
    const mappings: Record<string, string> = {
        '4:5': '3:4',
        '2:3': '3:4',
        '3:2': '4:3',
    };
    return mappings[trimmed] || '1:1';
  }

  private async callModel(params: {
    model: string;
    contents: any;
    config?: any;
    tools?: any;
    toolConfig?: any;
  }): Promise<GenerateContentResponse> {
    const { projectId, location, accessToken } = this.getVertexConfig();
    
    if (projectId && accessToken) {
        console.log(`[GeminiService] Calling Vertex AI REST API: ${params.model}`);
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${params.model}:streamGenerateContent`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: Array.isArray(params.contents) ? params.contents : [params.contents],
                    generationConfig: params.config,
                    systemInstruction: params.config?.systemInstruction ? { parts: [{ text: params.config.systemInstruction }] } : undefined,
                    tools: params.tools,
                    toolConfig: params.toolConfig
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `Vertex API error: ${response.status}`);
            }

            const results: VertexResponse[] = await response.json();
            
            // Combine results
            const text = results.map(r => r.candidates?.[0]?.content?.parts?.map(p => p.text).join('')).join('');
            const candidates = results[results.length - 1]?.candidates || [];
            
            return {
                text,
                candidates,
                groundingMetadata: candidates[0]?.groundingMetadata
            } as any;
        } catch (e: any) {
            console.error("Vertex AI call failed", e);
            throw e;
        }
    }

    // Google AI Studio (API Key) Fallback
    const ai = this.getClient();
    let modelToUse = params.model;
    
    const currentKey = this.getApiKey();
    const isSandboxFreeKey = isFreeTierKey(currentKey);
    const isImageModel = modelToUse.includes('image') || modelToUse.includes('imagen');

    // Check if we are trying to use a Pro/unsupported model on standard free key.
    // gemini-3.1-pro-preview has a quota of 0 on free keys. We map it to gemini-3-flash-preview.
    if (modelToUse.includes('pro') && !isImageModel && isSandboxFreeKey) {
        console.log(`[GeminiService] Free key detected. Mapping text model '${modelToUse}' to 'gemini-3-flash-preview'`);
        modelToUse = 'gemini-3-flash-preview';
    }

    // Clone params to use updated model name
    const updatedParams: any = {
        ...params,
        model: modelToUse
    };

    // Google Search Grounding tool is not supported on Free Tier keys and throws 429 quota errors.
    // If we have a tools array containing googleSearch, strip it to prevent failure.
    if (isSandboxFreeKey) {
        if (updatedParams.config && updatedParams.config.tools) {
            console.log("[GeminiService] Free key detected. Stripping googleSearch tools to prevent 429 quota errors");
            const filteredTools = updatedParams.config.tools.filter((t: any) => !t.googleSearch);
            if (filteredTools.length === 0) {
                delete updatedParams.config.tools;
            } else {
                updatedParams.config.tools = filteredTools;
            }
        }
        if (updatedParams.tools) {
            console.log("[GeminiService] Free key detected. Stripping googleSearch tools from direct tools parameter to prevent 429 quota errors");
            const filteredTools = updatedParams.tools.filter((t: any) => !t.googleSearch);
            if (filteredTools.length === 0) {
                delete updatedParams.tools;
            } else {
                updatedParams.tools = filteredTools;
            }
        }
    }

    try {
      return await ai.models.generateContent(updatedParams);
    } catch (e: any) {
      const errorMsg = e.message?.toLowerCase() || '';
      const isKeyError = errorMsg.includes('api_key_invalid') || 
                         errorMsg.includes('api key not valid') || 
                         errorMsg.includes('invalid api key') || 
                         e.status === 400;
      if (this.customKey && isKeyError) {
         console.warn("[GeminiService] Custom API key failed in callModel. Falling back to workspace key...");
         const fallbackService = new GeminiService(undefined, this.vertexConfig);
         return await fallbackService.callModel(params);
      }
      throw e;
    }
  }

  async validateVertexConfig(projectId: string, location: string, accessToken: string): Promise<boolean> {
    if (!projectId) throw new Error("Vui lòng nhập Project ID.");
    if (!accessToken) throw new Error("Vui lòng nhập Access Token.");
    
    try {
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-1.5-flash:streamGenerateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
      }
      return true;
    } catch (e: any) {
      console.error("[GeminiService] Vertex AI validation failed", e);
      throw new Error(`Lỗi cấu hình Vertex AI: ${e.message || 'Không thể kết nối'}`, { cause: e });
    }
  }

  async validateApiKey(key: string): Promise<boolean> {
    const cleanedKey = key.trim();
    if (!cleanedKey) throw new Error("Vui lòng nhập API Key.");
    
    const keyPrefix = cleanedKey.substring(0, 4);
    console.log(`[GeminiService] VALIDATING KEY: ${keyPrefix}... (Length: ${cleanedKey.length})`);
    
    // 1. Strict format check to prevent random strings from hitting the API
    // Google API keys always start with AIza or AQ.
    if ((!cleanedKey.startsWith('AIza') && !cleanedKey.startsWith('AQ.')) || cleanedKey.length < 25) {
       console.log("[GeminiService] Key failed format check");
       throw new Error(`[Key: ${keyPrefix}...] API Key không hợp lệ. Key Google chuẩn bắt đầu bằng 'AIza' hoặc 'AQ.' và có độ dài hợp lệ.`);
    }

    // 2. Use direct fetch for validation to ensure absolute isolation from SDK/Env fallbacks
    try {
      console.log("[GeminiService] Sending direct fetch validation request...");
      // Using gemini-3-flash-preview which is recommended
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${cleanedKey}`;
      const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 5 }
          })
      });

      const data = await response.json();

      if (response.ok) {
        console.log("[GeminiService] Direct validation SUCCESS");
        return true;
      }

      // Handle API errors directly
      const error = data.error || {};
      const rawMsg = error.message || 'Unknown error';
      const status = error.status || response.status;
      
      console.error(`[GeminiService] Direct validation FAILED -> Status: ${status}, Msg: ${rawMsg}`);

      if (status === 400 || rawMsg.toLowerCase().includes('invalid')) {
         throw new Error(`[Key: ${keyPrefix}...] API Key không hợp lệ. Vui lòng kiểm tra lại.`);
      }

      if (status === 'NOT_FOUND' || status === 404) {
         throw new Error(`[Key: ${keyPrefix}...] Lỗi: Không tìm thấy Model hoặc API chưa được bật. Hãy đảm bảo bạn đã bật 'Generative Language API' trong Google Cloud Console.`);
      }

      const friendlyMsg = this.getFriendlyErrorMessage({ message: rawMsg, status: status });
      throw new Error(`[Key: ${keyPrefix}...] ${friendlyMsg}`);
    } catch (e: any) {
      if (e.message?.includes('[Key:')) throw e; // Re-throw our formatted errors
      
      console.error("[GeminiService] Network/Fetch error during validation", e);
      throw new Error(`[Key: ${keyPrefix}...] Lỗi kết nối đến Google API. Vui lòng kiểm tra mạng hoặc VPN.`, { cause: e });
    }
  }

  async generateDescription(imageBase64: string): Promise<string> {
    try {
        const response = await this.callModel({
            model: 'gemini-3.1-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } },
                    { text: "Identify the main subject of this image in 3-5 words (e.g., 'Woman in red dress', 'Running shoes'). Return ONLY the subject name." }
                ]
            }
        });
        return response.text?.trim() || "Main subject";
    } catch (e) {
        console.error("Description generation failed", e);
        throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  async analyzeFashionImage(imageBase64: string): Promise<string> {
    const models = ['gemini-3.1-pro-preview', 'gemini-3-flash-preview'];
    
    let lastError: any = null;
    for (const model of models) {
        try {
            const response = await this.callModel({
                model: model,
                contents: {
                    parts: [
                        { inlineData: { mimeType: 'image/png', data: imageBase64 } },
                        { text: "Analyze this fashion image. Describe the garment type, color, material, pattern, and style in a concise prompt format for an AI image generator. Focus on the clothing only. Example: 'A navy blue silk button-down shirt with a subtle floral pattern, slim fit, professional style.' Return ONLY the prompt text." }
                    ]
                }
            });
            return response.text?.trim() || "";
        } catch (e) {
            console.warn(`Fashion analysis failed with model ${model}, trying next...`, e);
            lastError = e;
        }
    }
    throw new Error(this.getFriendlyErrorMessage(lastError), { cause: lastError });
  }

  async refineImage(
    originalImageBase64: string,
    maskImageBase64: string,
    prompt: string,
    config: { 
        aspectRatio: string; 
        imageSize?: string;
        negativePrompt?: string;
        seed?: number;
        cfgScale?: number;
        referenceImages?: string[];
    }
  ): Promise<string | undefined> {
    const models = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'];
    
    let finalPrompt = `Edit this image based on the provided mask. The white area in the mask indicates where the changes should occur. 
    Instruction: ${prompt}. 
    Maintain the style, lighting, camera angle, and overall aesthetic of the original image. Ensure the transition between the edited area and the original image is seamless and natural.`;

    if (config.referenceImages && config.referenceImages.length > 0) {
        finalPrompt += `\n\nREFERENCE_IMAGES_GUIDANCE: Use the provided reference images as a visual guide for the style, colors, patterns, or specific objects to be generated in the masked area.`;
    }

    if (config.negativePrompt) {
        finalPrompt += `\n\nNEGATIVE_PROMPT: ${config.negativePrompt}. Avoid these elements in the edited area.`;
    }

    const parts: any[] = [
        { inlineData: { mimeType: 'image/png', data: originalImageBase64 } },
        { inlineData: { mimeType: 'image/png', data: maskImageBase64 } },
    ];

    if (config.referenceImages) {
        config.referenceImages.forEach(img => {
            parts.push({ inlineData: { mimeType: 'image/png', data: img } });
        });
    }

    parts.push({ text: finalPrompt });

    for (const model of models) {
        try {
            const response = await this.callModel({
                model: model,
                contents: { parts },
                config: {
                    imageConfig: { aspectRatio: this.getNormalizedAspectRatio(config.aspectRatio), imageSize: config.imageSize || '1K' },
                    temperature: config.cfgScale ? (config.cfgScale / 10) : 0.5,
                    seed: config.seed
                }
            });
            
            for (const candidate of response.candidates || []) {
                if (candidate.content?.parts) {
                    for (const part of candidate.content.parts) {
                        if (part.inlineData) return part.inlineData.data;
                    }
                }
            }
        } catch (e) {
            console.warn(`Image refinement failed with model ${model}, trying next...`, e);
            if (model === models[models.length - 1]) {
                throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
            }
        }
    }
    return undefined;
  }

  async generateVariation(
    imageBase64: string,
    config: {
        modelId: string;
        aspectRatio: string;
        imageSize?: string;
        negativePrompt?: string;
        seed?: number;
        cfgScale?: number;
    }
  ): Promise<string | undefined> {
    const prompt = "Generate a variation of this image. Maintain the same subject, clothing, and overall composition, but change the pose, lighting, or background slightly to create a fresh look. Keep the character identity consistent.";
    return this.generateImage(prompt, config, [imageBase64]);
  }

  async analyzeImageForPrompt(imageBase64: string): Promise<string | undefined> {
    const prompt = "Analyze this fashion image and provide a detailed, professional photography prompt that describes the model, clothing, pose, lighting, and background. Keep it concise but descriptive. Output ONLY the prompt text.";
    
    try {
        const response = await this.callModel({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } },
                    { text: prompt }
                ]
            }
        });
        return response.text?.trim();
    } catch (e: any) {
        console.error("Image analysis failed", e);
        throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }
  async generateImage(
    prompt: string,
    config: {
      modelId: string;
      aspectRatio: string;
      imageSize?: string;
      negativePrompt?: string;
      seed?: number;
      cfgScale?: number;
    },
    referenceImagesBase64: string[] = []
  ): Promise<string | undefined> {
    const client = this.getClient();
    
    // Handle Imagen 4 specifically
    if (config.modelId === 'imagen-4.0-generate-001') {
        const { projectId, location, accessToken } = this.getVertexConfig();
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000; // 2 seconds
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        if (projectId && accessToken) {
            console.log("[GeminiService] Attempting Imagen on Vertex AI REST API...");
            let lastError;
            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${config.modelId}:predict`;
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            instances: [{ prompt: prompt }],
                            parameters: {
                                sampleCount: 1,
                                aspectRatio: config.aspectRatio,
                            }
                        })
                    });

                    if (response.status === 503) {
                        throw new Error("503");
                    }

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error?.message || `Vertex Imagen error: ${response.status}`);
                    }

                    const result = await response.json();
                    const base64Image = result.predictions?.[0]?.bytesBase64Encoded;
                    if (base64Image) return base64Image;
                    throw new Error("Vertex Imagen returned no image data.");
                } catch (e: any) {
                    lastError = e;
                    if (e.message === "503" && i < MAX_RETRIES - 1) {
                        console.warn(`Vertex AI high demand, retrying in ${RETRY_DELAY}ms... (attempt ${i + 1}/${MAX_RETRIES})`);
                        await sleep(RETRY_DELAY * (i + 1));
                        continue;
                    }
                    throw e;
                }
            }
            throw lastError;
        } else {
            let lastError;
            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    const response = await client.models.generateImages({
                        model: 'imagen-4.0-generate-001',
                        prompt: prompt,
                        config: {
                            numberOfImages: 1,
                            outputMimeType: 'image/jpeg',
                            aspectRatio: config.aspectRatio,
                        },
                    });
                    return response.generatedImages[0].image.imageBytes;
                } catch (e: any) {
                    lastError = e;
                    const errorMessage = e.message || "";
                    if ((errorMessage.includes('503') || e.status === 503) && i < MAX_RETRIES - 1) {
                        console.warn(`Google AI high demand, retrying in ${RETRY_DELAY}ms... (attempt ${i + 1}/${MAX_RETRIES})`);
                        await sleep(RETRY_DELAY * (i + 1));
                        continue;
                    }
                    
                    const isKeyError = errorMessage.toLowerCase().includes('api_key_invalid') || 
                                       errorMessage.toLowerCase().includes('api key not valid') || 
                                       errorMessage.toLowerCase().includes('invalid api key') || 
                                       e.status === 400;
                    if (this.customKey && isKeyError) {
                        console.warn("[GeminiService] Custom API key failed in generateImages. Falling back to workspace key.");
                        const fallbackService = new GeminiService(undefined, this.vertexConfig);
                        return await fallbackService.generateImage(prompt, config, referenceImagesBase64);
                    }
                    
                    throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
                }
            }
            throw lastError;
        }
    }

    const parts: any[] = [];
    
    // Add reference images if any
    referenceImagesBase64.forEach((ref) => {
       parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
    });

    // Construct enhanced prompt with negative constraints if provided
    let finalPrompt = prompt;
    if (config.negativePrompt) {
        finalPrompt += `\n\nNEGATIVE_PROMPT: ${config.negativePrompt}. Avoid these elements at all costs.`;
    }

    parts.push({ text: finalPrompt });
    
    const apiConfig: any = {
        imageConfig: { 
            aspectRatio: this.getNormalizedAspectRatio(config.aspectRatio),
        },
        temperature: config.cfgScale ? (config.cfgScale / 10) : 0.4,
        seed: config.seed
    };
    if (config.modelId.includes('pro') && config.imageSize) {
        apiConfig.imageConfig.imageSize = config.imageSize;
    }

    try {
        const response = await this.callModel({
            model: config.modelId,
            contents: { parts },
            config: apiConfig
        });
        
        for (const candidate of response.candidates || []) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) return part.inlineData.data;
                }
            }
        }
        throw new Error("Không nhận được dữ liệu ảnh từ AI.");
    } catch (e: any) {
        console.error("Image generation failed", e);
        throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  async generateSegmentationMask(
    imageBase64: string, 
    tier: 'standard' | 'pro' = 'standard',
    options?: { imageSize?: string }
  ): Promise<string | undefined> {
    const model = tier === 'pro' ? 'gemini-3.1-flash-image' : 'gemini-3.1-flash-lite-image';
    
    const prompt = `
    Role: Professional Image Matting & Segmentation Expert.
    Task: Generate a high-fidelity alpha matte (segmentation mask) for the foreground subject.

    STRICT OUTPUT REQUIREMENTS:
    1. **Format**: Black and White image ONLY. 
       - White (#FFFFFF) = Foreground Subject.
       - Black (#000000) = Background.
    2. **Subject**: Include the person, all clothing, shoes, hair, and held accessories.
    3. **Precision & Quality**: 
       - Edges must be RAZOR SHARP and match the subject's boundary exactly.
       - **Hair & Fur**: Capture fine details and strands. Use grayscale values at the edges for soft transitions (anti-aliasing) if needed, but the core must be solid white.
       - **Transparency**: For sheer fabrics (lace, mesh), reflect opacity in the mask brightness if possible, or treat as solid for cutout safety.
       - **No Artifacts**: Ensure the mask is clean, with no noise or stray pixels in the background area.
       - **Contrast**: High contrast between subject and background.
    4. **Safety**: Do not regenerate or hallucinate new features. Just create the silhouette mask of the EXISTING subject.
    `;
    
    const apiConfig: any = {
        temperature: 0.1, // Lower temperature for more consistent mask
        topP: 0.95,
        topK: 40
    };

    if (tier === 'pro') {
        apiConfig.imageConfig = { 
            imageSize: options?.imageSize || '2K' // Default to 2K for Pro for better edge detail
        };
    }
    
    try {
      const response = await this.callModel({
        model: model,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
            { text: prompt }
          ]
        },
        config: apiConfig
      });

      for (const candidate of response.candidates || []) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) return part.inlineData.data;
          }
        }
      }
      throw new Error("Không nhận được dữ liệu mask từ AI.");
    } catch (e: any) {
      if (tier === 'pro' && (e.message?.includes('permission denied') || e.message?.includes('403'))) {
          console.warn("Pro mask permission denied, falling back...");
          return this.generateSegmentationMask(imageBase64, 'standard');
      }
      console.error("Mask generation failed", e);
      throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  // Alias for backward compatibility if needed, but we will update call sites.
  async removeBackground(
    imageBase64: string, 
    tier: 'standard' | 'pro' = 'standard',
    config?: any
  ): Promise<string | undefined> {
      return this.generateSegmentationMask(imageBase64, tier, config);
  }

  async detectObject(imageBase64: string, objectDescription: string): Promise<{ box_2d: number[] }[]> {
    const prompt = `Detect the ${objectDescription} in this image. Return the bounding box as [ymin, xmin, ymax, xmax] in normalized coordinates (0-1000). Output a JSON array of objects, each with a "box_2d" key. Example: [{"box_2d": [100, 200, 300, 400]}]`;
    
    try {
      const response = await this.callModel({
        model: 'gemini-3-flash-preview',
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { data: imageBase64, mimeType: 'image/png' } }
          ]
        }],
        config: {
          responseMimeType: 'application/json',
        }
      });

      const text = response.text || '[]';
      const data = JSON.parse(text);
      // Handle different possible JSON structures from the model
      if (Array.isArray(data)) return data.map(d => ({ box_2d: d.box_2d || d }));
      if (data.box_2d) return [data];
      if (data.objects) return data.objects;
      return [];
    } catch (e: any) {
      console.error("[GeminiService] detectObject failed", e);
      throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  async editImage(
    modelImageBase64: string,
    prompt: string,
    referenceImagesBase64: string[] = [],
    config: {
      modelId: string;
      aspectRatio: string;
      imageSize?: string;
      negativePrompt?: string;
      seed?: number;
      cfgScale?: number;
    }
  ): Promise<string | undefined> {
    const parts: any[] = [];
    
    parts.push({ inlineData: { mimeType: 'image/png', data: modelImageBase64 } });
    referenceImagesBase64.forEach((ref) => {
       parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
    });

    const enhancedPrompt = `
    Role: Expert Fashion CGI Artist & Virtual Try-On Specialist.
    Task: Replace or Edit the model's outfit based on the provided Reference Garment(s).

    STRICT VISUAL REQUIREMENTS:
    1. **GARMENT FIDELITY (CRITICAL)**:
       - You MUST replicate the Reference Garment EXACTLY. 
       - **TEXTURE**: Preserve the exact fabric weave, roughness, sheen, and material weight (e.g., if it's silk, it must look like silk; if denim, it must have denim texture).
       - **COLOR**: Maintain the EXACT RGB color profile of the reference. Do not shift hue, saturation, or brightness unless strictly necessary for lighting integration.
       - **DETAILS**: Preserve ALL distinct details: buttons, zippers, logos, patterns, stitching, pockets, and collar shape.

    2. **PHOTOREALISM & INTEGRATION**:
       - The result must look like a high-end fashion photograph.
       - Ensure realistic lighting interaction (shadows, highlights, reflections) between the garment and the model's environment.
       - Natural drape and fit on the model's body shape (folds, tension points).

    3. **IDENTITY PRESERVATION**:
       - Do not change the model's face, skin tone, body type, or background unless explicitly instructed.

    Instruction: "${prompt}"
    `;

    parts.push({ text: enhancedPrompt });

    const modelName = config.modelId === 'gemini-2.5-flash-image' ? 'gemini-3.1-flash-lite-image' : config.modelId;
    const imageConfig: any = { aspectRatio: this.getNormalizedAspectRatio(config.aspectRatio) };
    const selectedModel = MODEL_OPTIONS.find(m => m.id === modelName);
    const tier = selectedModel?.tier || 'standard';
    if (tier === 'pro' && config.imageSize) imageConfig.imageSize = config.imageSize;

    const apiConfig: any = {
        imageConfig,
        temperature: 0.4, 
        topK: 40,
        topP: 0.90
    };

    try {
      const response = await this.callModel({
        model: modelName,
        contents: { parts },
        config: apiConfig
      });

      for (const candidate of response.candidates || []) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
              if (part.inlineData) return part.inlineData.data;
          }
        }
      }
      return undefined;
    } catch (e: any) {
        if (tier === 'pro' && (e.message?.includes('permission denied') || e.message?.includes('403'))) {
            console.warn("Pro edit permission denied, falling back...");
            const standardModel = MODEL_OPTIONS.find(m => m.tier === 'standard')?.id || 'gemini-3.1-flash-lite-image';
            return this.editImage(modelImageBase64, prompt, referenceImagesBase64, { ...config, modelId: standardModel });
        }
        throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  async generateSingleAngle(
      modelImageBase64: string,
      angleId: string,
      referenceImagesBase64: string[] = [],
      config: { 
        modelId: string;
        aspectRatio: string; 
        imageSize?: string;
        customPrompt?: string;
        faceImageBase64?: string;
        backImageBase64?: string;
        stylePrompt?: string;
      }
  ): Promise<string | null> {
    const selectedModel = MODEL_OPTIONS.find(m => m.id === config.modelId) || MODEL_OPTIONS[0];
    const tier = selectedModel?.tier || 'standard';
    const modelName = config.modelId === 'gemini-2.5-flash-image' ? 'gemini-3.1-flash-lite-image' : config.modelId;
    
    const angleConfig = ANGLE_CONFIGS.find(a => a.id === angleId);
    if (!angleConfig) return null;

    const parts: any[] = [];
    parts.push({ inlineData: { mimeType: 'image/png', data: modelImageBase64 } });
    
    // Add specialized references
    if (config.faceImageBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: config.faceImageBase64 } });
    }
    if (config.backImageBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: config.backImageBase64 } });
    }

    referenceImagesBase64.forEach((ref) => {
        parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
    });

    const poseInstruction = config.customPrompt || angleConfig.userDesc;

    let extraInstructions = "";
    if (config.faceImageBase64) {
        extraInstructions += "\n       - **FACE REFERENCE (HIGHEST PRIORITY)**: You are provided with a dedicated close-up face reference image. You MUST use this image as the ABSOLUTE GROUND TRUTH for the model's facial features, eyes, nose, mouth, and skin texture. Copy the face structure exactly.";
    }
    if (config.backImageBase64) {
        extraInstructions += "\n       - **BACK REFERENCE**: A specific reference image for the back of the outfit has been provided. Use it for accurate back details.";
    }

    const styleInstruction = config.stylePrompt ? `\n       - **STYLE/ATMOSPHERE**: ${config.stylePrompt}` : "";

    const prompt = `
    Role: Elite Fashion CGI Artist & Virtual Photographer specializing in Consistent Character Identity.
    Task: Re-render the subject in a new angle (**${angleConfig.name}**) while strictly enforcing FACIAL IDENTITY and OUTFIT FIDELITY.

    CRITICAL PRIORITY: FACE & IDENTITY PRESERVATION
    1. **FACE INTEGRITY (ABSOLUTE PRIORITY)**:
       - The output face MUST match the source model's identity perfectly (Bone structure, eye shape, nose, lips).
       - **DO NOT** beautify, cartoonize, or alter the model's ethnicity or age.
       - **DO NOT** allow the face to distort, melt, or blur, even if the body is in motion (Dynamic Poses). The face must remain sharp and high-resolution.
       - **EYES MUST BE PERFECT**: Ensure eyes are symmetrical, pupils are round, and gaze is natural. No cross-eyed or wandering eyes.
       - **MOTION FREEZE**: Even if the pose implies movement (walking, running), the face must be rendered with a high shutter speed look—crisp, clear, and focused.
       - If the new angle reveals the side profile, ensure it anatomically matches the front view.
       - Maintain skin texture, lighting interaction on the skin, and specific facial marks.

    2. **POSE & PHOTOGRAPHY**:
       - Execute the requested pose: "${poseInstruction}".
       - Ensure correct anatomy (fingers, limbs) without artifacts.
       - Lighting should be professional and consistent with the chosen style.
       
    3. **OUTFIT & TEXTURE FIDELITY**:
       - The garment texture (e.g., denim, silk, cotton) must be indistinguishable from the source.
       - Maintain exact logos, patterns, and seam details.
       - Ensure the fabric drapes and folds naturally according to the new pose.${extraInstructions}
       
    ${styleInstruction}

    NEGATIVE PROMPT (AVOID THESE):
    Distorted face, blurry face, low quality face, melted eyes, asymmetric eyes, cross-eyed, plastic skin, bad anatomy, missing fingers, extra fingers, cartoon, illustration, painting, different person, face swap failure, low resolution, jpeg artifacts, motion blur on face, deformed features.
    `;

    parts.push({ text: prompt });

    const apiConfig: any = {
        imageConfig: { aspectRatio: this.getNormalizedAspectRatio(config.aspectRatio) },
        // Lower temperature slightly to 0.35 for more deterministic/stable facial features
        temperature: 0.35, 
        topK: 40,
        topP: 0.90,
    };
    if (tier === 'pro') apiConfig.imageConfig.imageSize = config.imageSize || '1K';

    try {
        const response = await this.callModel({
            model: modelName,
            contents: { parts },
            config: apiConfig
        });

        for (const candidate of response.candidates || []) {
            if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) return part.inlineData.data;
                }
            }
        }
        return null;
    } catch (e: any) {
        if (tier === 'pro' && (e.message?.includes('permission denied') || e.message?.includes('403'))) {
            const standardModel = MODEL_OPTIONS.find(m => m.tier === 'standard')?.id || 'gemini-3.1-flash-lite-image';
            return this.generateSingleAngle(modelImageBase64, angleId, referenceImagesBase64, { ...config, modelId: standardModel });
        }
        return null; 
    }
  }

  async upscaleImage(
    imageBase64: string,
    targetSize: '2K' | '4K',
    aspectRatio: string = '1:1'
  ): Promise<string | undefined> {
    const model = 'gemini-3.1-flash-image';

    const prompt = `
    Role: High-End Image Upscaler & Detail Enhancer.
    Task: Upscale the provided image to ${targetSize} resolution.

    Requirements:
    1. RESOLUTION: Generate the output strictly at ${targetSize}.
    2. FIDELITY: Preserve the EXACT content, composition, pose, face, and clothing of the original image. Do not change the subject.
    3. ENHANCEMENT: Sharpen details, refine textures (skin, fabric), and remove any compression artifacts or blurriness.
    4. STYLE: Photorealistic, cinematic lighting.
    `;

    try {
      const response = await this.callModel({
        model: model,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
            { text: prompt }
          ]
        },
        config: {
          imageConfig: {
            imageSize: targetSize,
            aspectRatio: aspectRatio
          },
          temperature: 0.3
        }
      });

      for (const candidate of response.candidates || []) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) return part.inlineData.data;
          }
        }
      }
      return undefined;
    } catch (e) {
      console.error("Upscaling failed", e);
      throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  async generateVideo(
    prompt: string, 
    imageBase64?: string,
    options: { resolution: '720p' | '1080p', aspectRatio: '16:9' | '9:16' } = { resolution: '1080p', aspectRatio: '16:9' }
  ): Promise<string | null> {
    const { projectId } = this.getVertexConfig();
    
    // Video generation is currently only supported via Google AI (API Key)
    if (projectId) {
      console.warn("[GeminiService] Video generation is not yet supported via Vertex AI. Falling back to Google AI if API Key is available.");
    }

    const keyToUse = this.getApiKey();
    if (!keyToUse) throw new Error("Vui lòng cấu hình API Key để sử dụng tính năng tạo Video.");
    
    const ai = new GoogleGenAI({ apiKey: keyToUse });
    const config: any = { numberOfVideos: 1, resolution: options.resolution, aspectRatio: options.aspectRatio };
    
    // Switch to lite model for better reliability
    const params: any = { model: 'veo-3.1-lite-generate-preview', prompt: prompt, config: config };
    
    if (imageBase64) {
      params.image = { imageBytes: imageBase64, mimeType: 'image/png' };
    }
    
    const operation = await ai.models.generateVideos(params);
    let currentOp = operation;
    while (!currentOp.done) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Increased polling to 10s
      currentOp = await ai.operations.getVideosOperation({operation: currentOp});
    }

    // Check for errors in the operation response to handle failures
    if (currentOp.error) {
      const errorMsg = (currentOp.error as any).message || "Video generation failed due to safety filters or model limits.";
      throw new Error(this.getFriendlyErrorMessage({ message: errorMsg }), { cause: currentOp.error });
    }

    const responseBody = currentOp.response || (currentOp as any).result;
    const downloadLink = responseBody?.generatedVideos?.[0]?.video?.uri;
    
    if (!downloadLink) {
        // Explicitly throw so the UI catches it as an error
        throw new Error(this.getFriendlyErrorMessage({ message: "Video generation completed but no video link returned (likely blocked or empty response)." }), { cause: new Error("No download link") });
    }
    
    const response = await fetch(`${downloadLink}&key=${keyToUse}`);
    if (!response.ok) throw new Error(this.getFriendlyErrorMessage({ message: "Failed to fetch video content from Google Storage" }), { cause: new Error(`Fetch failed with status ${response.status}`) });
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${response.headers.get('content-type') || 'video/mp4'};base64,${base64}`;
  }

  async searchChat(prompt: string): Promise<{ text: string; sources?: {uri:string, title:string}[] }> {
    try {
      const response = await this.callModel({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      });
      const text = response.text || "No response generated.";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => chunk.web).filter((web: any) => web).map((web: any) => ({ uri: web.uri, title: web.title }));
      return { text, sources };
    } catch (e: any) {
      throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  private getFriendlyErrorMessage(error: any): string {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.code || (error.response?.status) || '';
    
    console.log(`[GeminiService] Formatting error: ${message} (Status: ${status})`);

    if (message.includes('503') || message.includes('high demand')) {
      return 'Hệ thống đang quá tải (503). Vui lòng thử lại sau ít phút nhé!';
    }
    if (message.includes('permission denied') || message.includes('403') || message.includes('api_key_invalid') || message.includes('invalid api key') || message.includes('api key not valid')) {
      return 'API Key không hợp lệ hoặc chưa được thiết lập. Vui lòng kiểm tra lại trong Settings -> Secrets hoặc phần cài đặt API Key.';
    }
    if (message.includes('location_not_supported') || message.includes('location not supported')) {
      return 'Vùng địa lý của bạn hiện chưa được hỗ trợ API này.';
    }
    if (message.includes('safety')) {
      return 'Nội dung yêu cầu có thể vi phạm chính sách an toàn.';
    }
    if (message.includes('spending cap') || message.includes('spending_cap')) {
      return 'Dự án đã chạm ngưỡng giới hạn chi tiêu (Spending Cap - 429). Hãy kiểm tra Google Cloud Console.';
    }
    if (message.includes('limit: 0') || message.includes('free_tier') || message.includes('paid plan') || message.includes('only available on paid plans') || message.includes('upgrade your account')) {
      if (message.includes('image') || message.includes('veo') || message.includes('lyria') || message.includes('imagen') || message.includes('try-on') || message.includes('generation')) {
        return 'Tính năng tạo, chỉnh sửa hoặc xử lý ảnh/video/nhạc (Mô hình Gemini Image, Imagen, Veo, Lyria) chỉ khả dụng với tài khoản Gemini API trả phí (gói Pay-As-You-Go đã kích hoạt thanh toán). Gói Miễn phí (Free Tier) hiện tại có hạn mức bằng 0 cho các tính năng này. Vui lòng thiết lập API Key trả phí của bạn trong Settings -> Secrets để tiếp tục sử dụng.';
      }
      return 'Tính năng này yêu cầu tài khoản Gemini API trả phí (gói Pay-As-You-Go). Gói Miễn phí (Free Tier) hiện tại có hạn mức bằng 0 cho mô hình này. Vui lòng nâng cấp tài khoản của bạn hoặc đổi sang API Key trả phí trong Settings -> Secrets.';
    }
    if (message.includes('quota') || message.includes('429') || status === 429 || status === 'RESOURCE_EXHAUSTED') {
      return 'Bạn đã hết hạn mức sử dụng (Quota - 429). Nếu bạn đang dùng gói Miễn phí (Free Tier), xin lưu ý các mô hình tạo/chỉnh sửa ảnh yêu cầu gói Trả phí (Paid Plan). Vui lòng nâng cấp tài khoản của bạn hoặc đổi API Key trả phí khác.';
    }
    if (message.includes('max tokens') || message.includes('token limit')) {
      return 'Yêu cầu quá dài hoặc vượt quá giới hạn xử lý của mô hình.';
    }
    
    return `Lỗi hệ thống: ${error.message || 'Đã có lỗi xảy ra'}. (Mã: ${status})`;
  }

  async generateCreativePrompts(
    ideaDescription: string,
    referenceImages: string[]
  ): Promise<Array<{
    title_vn: string;
    title_en: string;
    description_vn: string;
    prompt_en: string;
    prompt_vn: string;
  }>> {
    const parts: any[] = [];

    // Add reference images
    referenceImages.forEach((ref) => {
        parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
    });

    // Add text prompt
    const prompt = `
    Role: Professional AI Prompt Engineer and Creative Director for Fashion & Art.
    
    Task: Based on the provided user description ("${ideaDescription}") and any reference images, generate 3 DISTINCT, HIGH-QUALITY creative concepts for AI image generation (Midjourney/Stable Diffusion/Gemini style).
    
    Requirements:
    1. Analyze the style, subject, and lighting from references (if any).
    2. Create 3 different variations (e.g., one cinematic, one studio fashion, one artistic/abstract).
    3. Output STRICTLY a JSON array with 3 objects.
    4. Each object must have:
       - title_vn: A short, catchy title in Vietnamese.
       - title_en: A short, catchy title in English.
       - description_vn: A brief explanation (1 sentence) of why this concept works, in Vietnamese.
       - prompt_en: The actual detailed prompt in English (include lighting, camera angle, texture, style keywords).
       - prompt_vn: The translation of the prompt in Vietnamese.

    Output format:
    [
      { "title_vn": "...", "title_en": "...", "description_vn": "...", "prompt_en": "...", "prompt_vn": "..." },
      ...
    ]
    `;
    parts.push({ text: prompt });

    try {
        const response = await this.callModel({
            model: 'gemini-3.1-pro-preview',
            contents: { parts },
            config: {
                responseMimeType: 'application/json',
                temperature: 0.7,
                systemInstruction: "Generate 3 concise, high-quality creative concepts in JSON format. Keep descriptions and prompts brief and focused."
            }
        });

        const text = response.text || "[]";
        // Clean markdown code blocks if present
        const cleanJson = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("Prompt generation failed", e);
        throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  async enhancePrompt(prompt: string): Promise<string> {
    try {
      const response = await this.callModel({
        model: 'gemini-3.1-pro-preview',
        contents: `Rewrite the following simple image generation prompt into a detailed, professional, and descriptive fashion photography prompt. Keep it in English.\nOriginal: "${prompt}"`,
        config: { temperature: 0.7 }
      });
      return response.text ? response.text.trim() : prompt;
    } catch (e) {
      console.error("Enhance prompt failed", e);
      return prompt;
    }
  }
}

export const geminiService = new GeminiService();

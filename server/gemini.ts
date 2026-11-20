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

export interface VideoGenerationOptions {
  model?: 'gemini-omni-1.2-flash' | 'veo-3.1-lite-generate-preview' | string;
  mode?: 'standard' | 'interpolation' | 'ingredients' | 'extend' | 'edit';
  resolution?: '360p' | '720p' | '1080p' | '4k';
  aspectRatio?: '16:9' | '9:16';
  duration?: number;
  endFrameBase64?: string;
  referenceImagesBase64?: string[];
  sourceVideoBase64?: string;
  regenerateAudio?: boolean;
}

export const ANGLE_CONFIGS = [
  { id: 'front', name: "TRỰC DIỆN (FRONT)", desc: "Góc máy cơ bản, toàn thân.", promptDesc: "Full body, front view straight on camera. Standard fashion lookbook pose.", userDesc: "Standing straight, facing the camera with a confident, natural look. Face is perfectly clear and sharp." },
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
  { id: 'gemini-nano-banana-2.1', name: 'Nano Banana 2.1', desc: 'Mới nhất — hỗ trợ tới 14 ảnh tham chiếu, độ phân giải 1K–4K.', tier: 'pro' },
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro', desc: 'Chi tiết Studio cao cấp, suy luận bố cục sâu.', tier: 'pro' },
  { id: 'gemini-3.1-flash-lite-image', name: 'Nano Banana 2 Lite', desc: 'Tốc độ siêu nhanh, tối ưu chi phí.', tier: 'standard' },
  { id: 'imagen-4.0-generate-001', name: 'Imagen 4', desc: 'Tạo ảnh nghệ thuật thuần văn bản, photorealistic.', tier: 'pro' }
];

export const normalizeModelId = (modelId?: string): string => {
  if (!modelId) return 'gemini-nano-banana-2.1';
  if (modelId === 'gemini-3.1-flash-image') return 'gemini-nano-banana-2.1';
  if (modelId === 'gemini-2.5-flash-image') return 'gemini-3.1-flash-lite-image';
  if (modelId === 'google-flow-nano-banana-pro') return 'gemini-3-pro-image';
  if (modelId === 'google-flow-nano-banana-2' || modelId === 'google-flow-nano-banana-2.1') return 'gemini-nano-banana-2.1';
  if (modelId === 'google-flow-nano-banana-2-lite') return 'gemini-3.1-flash-lite-image';
  return modelId;
};

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

function stripDataUriPrefix(raw: string, fallbackMime = 'image/png'): { data: string; mimeType: string } {
  const trimmed = (raw || '').trim();
  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      return { mimeType: match[1], data: match[2].replace(/\s+/g, '') };
    }
    const afterComma = trimmed.split(',')[1] || '';
    return { mimeType: fallbackMime, data: afterComma.replace(/\s+/g, '') };
  }
  return { mimeType: fallbackMime, data: trimmed.replace(/\s+/g, '') };
}

function isImageGenerationModel(modelId: string): boolean {
  const m = modelId.toLowerCase();
  return m.includes('nano-banana') || m.includes('-image') || m.includes('imagen');
}

function isModernThinkingModel(modelId: string): boolean {
  const m = modelId.toLowerCase();
  return m.startsWith('gemini-4-') || m.startsWith('gemini-3.5-flash-lite') || m.includes('nano-banana-2.1');
}

export class GeminiService {
  constructor(private customKey?: string, private vertexConfig?: { projectId: string; location: string; accessToken: string }) {}

  private getApiKey(): string {
    if (!isKeyInvalid(this.customKey)) {
      return this.customKey!.trim();
    }
    if (!isKeyInvalid(process.env.GEMINI_API_KEY)) {
      return process.env.GEMINI_API_KEY!.trim();
    }
    if (!isKeyInvalid(process.env.API_KEY)) {
      return process.env.API_KEY!.trim();
    }
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

  public getClient(customKey?: string, apiVersion?: string): GoogleGenAI {
    const keyToUse = (customKey && !isKeyInvalid(customKey)) ? customKey.trim() : this.getApiKey();
    if (apiVersion) {
      return new GoogleGenAI({ apiKey: keyToUse, httpOptions: { apiVersion } });
    }
    return new GoogleGenAI({ apiKey: keyToUse });
  }

  private getNormalizedAspectRatio(ratio: string): string {
    const supportedRatios = ['1:1', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'];
    const trimmed = (ratio || '').trim();
    if (supportedRatios.includes(trimmed)) {
      return trimmed;
    }
    const mappings: Record<string, string> = {
      '4:5': '3:4',
      '5:4': '4:3',
    };
    return mappings[trimmed] || '1:1';
  }

  private convertContentsToInteractionInput(contents: any): string | Array<any> {
    if (typeof contents === 'string') {
      return contents;
    }

    const items = Array.isArray(contents) ? contents : [contents];
    const blocks: Array<any> = [];

    for (const item of items) {
      if (!item) continue;
      if (typeof item === 'string') {
        blocks.push({ type: 'text', text: item });
        continue;
      }
      const parts = Array.isArray(item.parts) ? item.parts : [item];
      for (const part of parts) {
        if (!part) continue;
        if (typeof part.text === 'string') {
          blocks.push({ type: 'text', text: part.text });
        } else if (part.inlineData && part.inlineData.data) {
          const cleaned = stripDataUriPrefix(part.inlineData.data, part.inlineData.mimeType || 'image/png');
          if (cleaned.mimeType.startsWith('video/')) {
            blocks.push({ type: 'video', data: cleaned.data, mime_type: cleaned.mimeType });
          } else {
            blocks.push({ type: 'image', data: cleaned.data, mime_type: cleaned.mimeType });
          }
        }
      }
    }

    return blocks.length === 1 && blocks[0].type === 'text' ? blocks[0].text : blocks;
  }

  private async fetchMediaUriAsBase64(uri: string, apiKey: string): Promise<{ data: string; mimeType: string }> {
    const separator = uri.includes('?') ? '&' : '?';
    const response = await fetch(`${uri}${separator}key=${encodeURIComponent(apiKey)}`, {
      headers: apiKey ? { 'x-goog-api-key': apiKey } : undefined,
    });
    if (!response.ok) {
      throw new Error(`Không thể tải media từ Google URI (HTTP ${response.status})`);
    }
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = typeof Buffer !== 'undefined'
      ? Buffer.from(arrayBuffer).toString('base64')
      : btoa(binary);
    return { data: base64, mimeType };
  }

  private async callModel(params: {
    model: string;
    contents: any;
    config?: any;
    tools?: any;
    toolConfig?: any;
  }): Promise<GenerateContentResponse> {
    const { projectId, location, accessToken } = this.getVertexConfig();
    const normalizedModel = isImageGenerationModel(params.model)
      ? normalizeModelId(params.model)
      : params.model;

    // 1. Vertex AI REST Branch (with parameter sanitization for Gemini 4 / 3.5 Flash-Lite)
    if (projectId && accessToken) {
      console.log(`[GeminiService] Calling Vertex AI REST API: ${normalizedModel}`);
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${normalizedModel}:streamGenerateContent`;

      const vertexGenConfig: Record<string, any> = { ...(params.config || {}) };
      delete vertexGenConfig.systemInstruction;
      delete vertexGenConfig.tools;
      delete vertexGenConfig.thinkingLevel;
      if (isModernThinkingModel(normalizedModel)) {
        delete vertexGenConfig.temperature;
        delete vertexGenConfig.topP;
        delete vertexGenConfig.topK;
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: Array.isArray(params.contents) ? params.contents : [params.contents],
            generationConfig: Object.keys(vertexGenConfig).length > 0 ? vertexGenConfig : undefined,
            systemInstruction: params.config?.systemInstruction
              ? { parts: [{ text: params.config.systemInstruction }] }
              : undefined,
            tools: params.tools || params.config?.tools,
            toolConfig: params.toolConfig,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error?.message || `Vertex API error: ${response.status}`);
        }

        const results: VertexResponse[] = await response.json();
        const text = results.map(r => r.candidates?.[0]?.content?.parts?.map(p => p.text).join('')).join('');
        const candidates = results[results.length - 1]?.candidates || [];

        return {
          text,
          candidates,
          groundingMetadata: candidates[0]?.groundingMetadata,
        } as any;
      } catch (e: any) {
        console.error("Vertex AI call failed", e);
        throw e;
      }
    }

    // 2. Google AI Studio Branch via Official Interactions API (@google/genai >= 3.6.1)
    const currentKey = this.getApiKey();
    const isSandboxFreeKey = isFreeTierKey(currentKey);
    const isImageModel = isImageGenerationModel(normalizedModel);
    let modelToUse = normalizedModel;

    // Map heavy reasoning models to fast daily driver on free-tier keys
    if (
      !isImageModel &&
      isSandboxFreeKey &&
      (modelToUse === 'gemini-4-carbon' || modelToUse === 'gemini-4-argon' || modelToUse.includes('pro'))
    ) {
      modelToUse = 'gemini-4-hydrogen';
    }

    const ai = this.getClient();
    const input = this.convertContentsToInteractionInput(params.contents);
    const generationConfig: Record<string, any> = {};

    if (typeof params.config?.seed === 'number') {
      generationConfig.seed = params.config.seed;
    }

    if (modelToUse.startsWith('gemini-4-')) {
      const requestedThinking = params.config?.thinkingLevel;
      generationConfig.thinking_level =
        requestedThinking && requestedThinking !== 'minimal' ? requestedThinking : 'medium';
    } else if (modelToUse.startsWith('gemini-3.5-flash-lite')) {
      generationConfig.thinking_level = params.config?.thinkingLevel || 'low';
    } else if (modelToUse === 'gemini-nano-banana-2.1') {
      generationConfig.thinking_level = params.config?.thinkingLevel || 'medium';
    } else if (!isModernThinkingModel(modelToUse) && typeof params.config?.temperature === 'number') {
      generationConfig.temperature = params.config.temperature;
    }

    let responseFormat: any = undefined;
    if (isImageModel) {
      const imgFormat: Record<string, any> = { type: 'image' };
      if (params.config?.imageConfig?.aspectRatio) {
        imgFormat.aspect_ratio = params.config.imageConfig.aspectRatio;
      }
      if (params.config?.imageConfig?.imageSize) {
        imgFormat.image_size = params.config.imageConfig.imageSize;
      }
      responseFormat = [imgFormat];
    } else if (params.config?.responseMimeType === 'application/json') {
      responseFormat = {
        type: 'text',
        mime_type: 'application/json',
        ...(params.config?.responseSchema ? { schema: params.config.responseSchema } : {}),
      };
    }

    const rawTools = params.tools || params.config?.tools;
    const interactionTools: Array<any> = [];
    if (Array.isArray(rawTools) && !isSandboxFreeKey) {
      for (const t of rawTools) {
        if (t?.googleSearch || t?.type === 'google_search') {
          interactionTools.push({ type: 'google_search' });
        }
      }
    }

    const interactionReq: Record<string, any> = {
      model: modelToUse,
      input,
    };
    if (params.config?.systemInstruction) {
      interactionReq.system_instruction = params.config.systemInstruction;
    }
    if (responseFormat) {
      interactionReq.response_format = responseFormat;
    }
    if (Object.keys(generationConfig).length > 0) {
      interactionReq.generation_config = generationConfig;
    }
    if (interactionTools.length > 0) {
      interactionReq.tools = interactionTools;
    }

    try {
      const interaction: any = await ai.interactions.create(interactionReq as any);
      const parts: Array<any> = [];
      const textChunks: string[] = [];
      const groundingChunks: Array<any> = [];

      for (const step of interaction?.steps || []) {
        if (step?.type === 'google_search_result' && Array.isArray(step.results)) {
          for (const item of step.results) {
            if (item?.url || item?.uri) {
              groundingChunks.push({
                web: { uri: item.url || item.uri, title: item.title || 'Nguồn tham khảo' },
              });
            }
          }
        }

        if (step?.type === 'model_output' && Array.isArray(step.content)) {
          for (const block of step.content) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              textChunks.push(block.text);
              parts.push({ text: block.text });
              if (Array.isArray(block.annotations)) {
                for (const ann of block.annotations) {
                  if (ann?.url || ann?.uri) {
                    groundingChunks.push({
                      web: { uri: ann.url || ann.uri, title: ann.title || 'Nguồn tham khảo' },
                    });
                  }
                }
              }
            } else if (block?.type === 'image') {
              let imgData = block.data;
              let imgMime = block.mime_type || 'image/png';
              if (!imgData && block.uri) {
                const fetched = await this.fetchMediaUriAsBase64(block.uri, currentKey);
                imgData = fetched.data;
                imgMime = fetched.mimeType;
              }
              if (imgData) {
                parts.push({
                  inlineData: {
                    mimeType: imgMime,
                    data: imgData,
                  },
                });
              }
            }
          }
        }
      }

      const combinedText = textChunks.join('');
      const groundingMetadata = groundingChunks.length > 0 ? { groundingChunks } : undefined;

      return {
        text: combinedText,
        candidates: [
          {
            content: { parts },
            groundingMetadata,
          },
        ],
        groundingMetadata,
      } as any;
    } catch (e: any) {
      const errorMsg = e.message?.toLowerCase() || '';
      const isKeyError =
        errorMsg.includes('api_key_invalid') ||
        errorMsg.includes('api key not valid') ||
        errorMsg.includes('invalid api key') ||
        e.status === 400;
      if (this.customKey && isKeyError) {
        console.warn("[GeminiService] Custom API key failed in Interactions API. Falling back to workspace key...");
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
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-3.5-flash-lite:streamGenerateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
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
    if ((!cleanedKey.startsWith('AIza') && !cleanedKey.startsWith('AQ.')) || cleanedKey.length < 25) {
      throw new Error(`[Key: ${keyPrefix}...] API Key không hợp lệ. Key Google chuẩn bắt đầu bằng 'AIza' hoặc 'AQ.' và có độ dài hợp lệ.`);
    }

    try {
      const url = 'https://generativelanguage.googleapis.com/v1/interactions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanedKey,
          'Api-Revision': '2026-05-20',
        },
        body: JSON.stringify({
          model: 'gemini-3.5-flash-lite',
          input: 'ping',
          generation_config: {
            thinking_level: 'minimal',
            max_output_tokens: 16,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return true;
      }

      const error = data.error || {};
      const rawMsg = error.message || 'Unknown error';
      const status = error.status || response.status;

      if (status === 400 || rawMsg.toLowerCase().includes('invalid')) {
        throw new Error(`[Key: ${keyPrefix}...] API Key không hợp lệ. Vui lòng kiểm tra lại.`);
      }

      if (status === 'NOT_FOUND' || status === 404) {
        throw new Error(`[Key: ${keyPrefix}...] Lỗi: Không tìm thấy Model hoặc API chưa được bật. Hãy đảm bảo bạn đã bật 'Generative Language API' trong Google Cloud Console.`);
      }

      const friendlyMsg = this.getFriendlyErrorMessage({ message: rawMsg, status });
      throw new Error(`[Key: ${keyPrefix}...] ${friendlyMsg}`);
    } catch (e: any) {
      if (e.message?.includes('[Key:')) throw e;
      throw new Error(`[Key: ${keyPrefix}...] Lỗi kết nối đến Google API. Vui lòng kiểm tra mạng hoặc VPN.`, { cause: e });
    }
  }

  async generateDescription(imageBase64: string): Promise<string> {
    try {
      const response = await this.callModel({
        model: 'gemini-3.5-flash-lite',
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
    const models = ['gemini-4-hydrogen', 'gemini-3.5-flash-lite'];

    let lastError: any = null;
    for (const model of models) {
      try {
        const response = await this.callModel({
          model,
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

  async reviewImage(imageBase64: string): Promise<{ pass: boolean; score?: number; reason?: string }> {
    const { projectId, accessToken } = this.getVertexConfig();
    const apiKey = this.getApiKey();

    // 1. Calibrated QC via Gemini Decision 1 (v1beta Decisions API — 0 output tokens)
    if (!projectId && !accessToken && apiKey) {
      try {
        const ai = this.getClient(undefined, 'v1beta');
        const cleaned = stripDataUriPrefix(imageBase64, 'image/png');
        const decisionRes: any = await ai.decisions.create(
          {
            model: 'models/gemini-decision-1',
            input: [{ type: 'image', data: cleaned.data, mime_type: cleaned.mimeType as any }],
            questions: {
              anatomical_pass: {
                type: 'noul',
                instructions:
                  'Inspect this AI-generated fashion image for severe anatomical deformities (extra/missing limbs, severely melted or distorted face, grotesque hands) or broken floating garments.',
                criteria: {
                  true_description: 'The model face, hands, limbs, and garment drape look natural and commercially usable.',
                  false_description: 'Severe anatomical deformity, melted facial features, extra limbs, or broken garment rendering.',
                },
              },
              studio_score: {
                type: 'score',
                instructions: 'Score overall commercial fashion photography quality from 0 to 4.',
                criteria: [
                  'Unusable severe deformity or glitch',
                  'Noticeable facial or hand distortion',
                  'Acceptable quality with minor imperfections',
                  'Good commercial lookbook quality',
                  'Flawless studio-grade fashion photography',
                ],
              },
            },
          }
        );

        const passAns = decisionRes?.answers?.anatomical_pass;
        const scoreAns = decisionRes?.answers?.studio_score;
        if (passAns && typeof passAns.noul === 'number') {
          let weightedScore = Math.round(passAns.noul * 100);
          if (scoreAns?.probabilities) {
            let expected = 0;
            for (const [lvl, prob] of Object.entries(scoreAns.probabilities)) {
              expected += (Number(lvl) / 4) * Number(prob);
            }
            weightedScore = Math.round(expected * 100);
          }
          const passed = passAns.noul >= 0.45 && weightedScore >= 45;
          return {
            pass: passed,
            score: weightedScore,
            reason: passed ? undefined : `Điểm QC thấp (${weightedScore}%) — phát hiện biến dạng hình thể/trang phục`,
          };
        }
      } catch (decisionErr) {
        console.warn('[GeminiService] gemini-decision-1 unavailable, falling back to gemini-4-hydrogen QC:', decisionErr);
      }
    }

    // 2. Fallback multimodal QC via Gemini 4 Hydrogen
    const prompt = `You are a strict Quality Control expert for AI-generated fashion images.
Inspect this generated image for major anatomical deformities (extra fingers, missing limbs, severely distorted faces) or severe rendering glitches (floating clothing, disconnected body parts).
If the image looks reasonably natural and anatomically correct, respond EXACTLY with 'PASS'.
If there is a severe deformity or glitch, respond with 'FAIL: [Brief reason in Vietnamese, max 10 words]'.`;

    try {
      const response = await this.callModel({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
            { text: prompt }
          ]
        }
      });
      const text = response.text?.trim() || "";
      if (text.startsWith('FAIL')) {
        return { pass: false, score: 35, reason: text.replace('FAIL:', '').replace('FAIL', '').trim() || 'Lỗi dị dạng' };
      }
      return { pass: true, score: 92 };
    } catch (e: any) {
      console.error("Auto-review failed", e);
      return { pass: true };
    }
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
    const models = ['gemini-nano-banana-2.1', 'gemini-3.1-flash-lite-image'];

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
      config.referenceImages.slice(0, 12).forEach(img => {
        parts.push({ inlineData: { mimeType: 'image/png', data: img } });
      });
    }

    parts.push({ text: finalPrompt });

    for (const model of models) {
      try {
        const response = await this.callModel({
          model,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: this.getNormalizedAspectRatio(config.aspectRatio),
              imageSize: config.imageSize || '1K',
            },
            seed: config.seed,
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
        model: 'gemini-4-hydrogen',
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
      thinkingLevel?: 'minimal' | 'medium' | 'high';
    },
    referenceImagesBase64: string[] = []
  ): Promise<string | undefined> {
    const client = this.getClient();
    const effectiveModel = normalizeModelId(config.modelId);

    // Handle Imagen 4 specifically
    if (effectiveModel === 'imagen-4.0-generate-001') {
      const { projectId, location, accessToken } = this.getVertexConfig();
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 2000;
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      if (projectId && accessToken) {
        let lastError;
        for (let i = 0; i < MAX_RETRIES; i++) {
          try {
            const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${effectiveModel}:predict`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                instances: [{ prompt }],
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
              const error = await response.json().catch(() => ({}));
              throw new Error(error.error?.message || `Vertex Imagen error: ${response.status}`);
            }

            const result = await response.json();
            const base64Image = result.predictions?.[0]?.bytesBase64Encoded;
            if (base64Image) return base64Image;
            throw new Error("Vertex Imagen returned no image data.");
          } catch (e: any) {
            lastError = e;
            if (e.message === "503" && i < MAX_RETRIES - 1) {
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
            const response: any = await client.models.generateImages({
              model: 'imagen-4.0-generate-001',
              prompt,
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: config.aspectRatio,
              },
            });
            return response.generatedImages?.[0]?.image?.imageBytes;
          } catch (e: any) {
            lastError = e;
            const errorMessage = e.message || "";
            if ((errorMessage.includes('503') || e.status === 503) && i < MAX_RETRIES - 1) {
              await sleep(RETRY_DELAY * (i + 1));
              continue;
            }

            const isKeyError =
              errorMessage.toLowerCase().includes('api_key_invalid') ||
              errorMessage.toLowerCase().includes('api key not valid') ||
              errorMessage.toLowerCase().includes('invalid api key') ||
              e.status === 400;
            if (this.customKey && isKeyError) {
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
    // Nano Banana 2.1 supports up to 14 reference images
    referenceImagesBase64.slice(0, 14).forEach((ref) => {
      parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
    });

    let finalPrompt = prompt;
    if (config.negativePrompt) {
      finalPrompt += `\n\nNEGATIVE_PROMPT: ${config.negativePrompt}. Avoid these elements at all costs.`;
    }

    parts.push({ text: finalPrompt });

    const apiConfig: any = {
      imageConfig: {
        aspectRatio: this.getNormalizedAspectRatio(config.aspectRatio),
      },
      seed: config.seed,
      thinkingLevel: config.thinkingLevel,
    };
    const selectedModel = MODEL_OPTIONS.find(m => m.id === effectiveModel);
    if ((selectedModel?.tier === 'pro' || effectiveModel === 'gemini-nano-banana-2.1') && config.imageSize) {
      apiConfig.imageConfig.imageSize = config.imageSize;
    }

    try {
      const response = await this.callModel({
        model: effectiveModel,
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
    const model = tier === 'pro' ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

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
      thinkingLevel: 'minimal',
    };

    if (tier === 'pro') {
      apiConfig.imageConfig = {
        imageSize: options?.imageSize || '2K'
      };
    }

    try {
      const response = await this.callModel({
        model,
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
        return this.generateSegmentationMask(imageBase64, 'standard');
      }
      console.error("Mask generation failed", e);
      throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

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
        model: 'gemini-4-hydrogen',
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

      const text = (response.text || '[]').replace(/```json|```/g, '').trim();
      const data = JSON.parse(text);
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
      thinkingLevel?: 'minimal' | 'medium' | 'high';
    }
  ): Promise<string | undefined> {
    const parts: any[] = [];

    parts.push({ inlineData: { mimeType: 'image/png', data: modelImageBase64 } });
    referenceImagesBase64.slice(0, 13).forEach((ref) => {
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

    const modelName = normalizeModelId(config.modelId);
    const imageConfig: any = { aspectRatio: this.getNormalizedAspectRatio(config.aspectRatio) };
    const selectedModel = MODEL_OPTIONS.find(m => m.id === modelName);
    const tier = selectedModel?.tier || 'standard';
    if ((tier === 'pro' || modelName === 'gemini-nano-banana-2.1') && config.imageSize) {
      imageConfig.imageSize = config.imageSize;
    }

    const apiConfig: any = {
      imageConfig,
      seed: config.seed,
      thinkingLevel: config.thinkingLevel || 'medium',
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
    const modelName = normalizeModelId(config.modelId);
    const selectedModel = MODEL_OPTIONS.find(m => m.id === modelName) || MODEL_OPTIONS[0];
    const tier = selectedModel?.tier || 'standard';

    const angleConfig = ANGLE_CONFIGS.find(a => a.id === angleId);
    if (!angleConfig) return null;

    const parts: any[] = [];
    parts.push({ inlineData: { mimeType: 'image/png', data: modelImageBase64 } });

    if (config.faceImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: config.faceImageBase64 } });
    }
    if (config.backImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: config.backImageBase64 } });
    }

    referenceImagesBase64.slice(0, 11).forEach((ref) => {
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
      thinkingLevel: 'medium',
    };
    if (tier === 'pro' || modelName === 'gemini-nano-banana-2.1') {
      apiConfig.imageConfig.imageSize = config.imageSize || '1K';
    }

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
    const model = 'gemini-nano-banana-2.1';

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
        model,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
            { text: prompt }
          ]
        },
        config: {
          imageConfig: {
            imageSize: targetSize,
            aspectRatio: this.getNormalizedAspectRatio(aspectRatio)
          },
          thinkingLevel: 'high'
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
    options: VideoGenerationOptions = { resolution: '1080p', aspectRatio: '16:9', duration: 10, model: 'gemini-omni-1.2-flash' }
  ): Promise<string | null> {
    const { projectId } = this.getVertexConfig();
    if (projectId) {
      console.warn("[GeminiService] Video generation prefers Google AI Studio API Key if available.");
    }

    const keyToUse = this.getApiKey();
    if (!keyToUse) throw new Error("Vui lòng cấu hình API Key để sử dụng tính năng tạo Video.");

    const requestedModel = options.model || 'gemini-omni-1.2-flash';
    const aspectRatio = options.aspectRatio || '16:9';
    const resolution = options.resolution || '1080p';
    const mode = options.mode || 'standard';

    // 1. Primary Modern Path: Gemini Omni 1.2 Flash via Interactions API (background=true)
    if (requestedModel !== 'veo-3.1-lite-generate-preview') {
      const ai = new GoogleGenAI({ apiKey: keyToUse });
      const rawDuration = typeof options.duration === 'number' ? Math.round(options.duration) : 10;
      const isTenSecCapped = mode === 'interpolation' || mode === 'extend' || Boolean(options.endFrameBase64);
      const clampedSeconds = Math.max(3, Math.min(isTenSecCapped ? 10 : 15, rawDuration));

      const inputBlocks: Array<any> = [];

      if ((mode === 'extend' || mode === 'edit') && options.sourceVideoBase64) {
        const cleanedVideo = stripDataUriPrefix(options.sourceVideoBase64, 'video/mp4');
        inputBlocks.push({
          type: 'video',
          data: cleanedVideo.data,
          mime_type: cleanedVideo.mimeType,
        });
      }

      if (mode === 'interpolation' && imageBase64 && options.endFrameBase64) {
        const startImg = stripDataUriPrefix(imageBase64, 'image/jpeg');
        const endImg = stripDataUriPrefix(options.endFrameBase64, 'image/jpeg');
        inputBlocks.push({ type: 'image', data: startImg.data, mime_type: startImg.mimeType });
        inputBlocks.push({ type: 'image', data: endImg.data, mime_type: endImg.mimeType });
      } else if (mode === 'ingredients' && options.referenceImagesBase64 && options.referenceImagesBase64.length > 0) {
        for (const ref of options.referenceImagesBase64.slice(0, 6)) {
          const cleanedRef = stripDataUriPrefix(ref, 'image/jpeg');
          inputBlocks.push({ type: 'image', data: cleanedRef.data, mime_type: cleanedRef.mimeType });
        }
      } else if (imageBase64) {
        const startImg = stripDataUriPrefix(imageBase64, 'image/jpeg');
        inputBlocks.push({ type: 'image', data: startImg.data, mime_type: startImg.mimeType });
      }

      // Also attach optional reference images during video editing or extension (up to 6 supported on Omni 1.2 Flash)
      if ((mode === 'edit' || mode === 'extend') && options.referenceImagesBase64?.length) {
        for (const ref of options.referenceImagesBase64.slice(0, 6)) {
          const cleanedRef = stripDataUriPrefix(ref, 'image/jpeg');
          inputBlocks.push({ type: 'image', data: cleanedRef.data, mime_type: cleanedRef.mimeType });
        }
      }

      // Build clean natural-language prompt (NO deprecated <FIRST_FRAME> / <IMAGE_REF_*> tags)
      let effectivePrompt = prompt.trim();
      if (mode === 'interpolation' && imageBase64 && options.endFrameBase64) {
        effectivePrompt = `Create a smooth cinematic transition starting from the first uploaded image as the opening keyframe and ending seamlessly on the second uploaded image as the final keyframe. ${effectivePrompt}`;
      } else if (mode === 'ingredients' && options.referenceImagesBase64?.length) {
        effectivePrompt = `Using the uploaded reference images to preserve exact character identity, outfit details, and scene aesthetics across every frame: ${effectivePrompt}`;
      } else if (mode === 'extend' && options.sourceVideoBase64) {
        effectivePrompt = `Continue and extend the uploaded video naturally from its final moment with consistent subject identity, motion, lighting, and audio: ${effectivePrompt || 'smoothly continue the cinematic motion'}`;
      } else if (mode === 'edit' && options.sourceVideoBase64) {
        const audioDirective = options.regenerateAudio
          ? 'Generate fresh synchronized ambient and scene audio matching the new visual edit.'
          : 'Preserve the original timing and natural audio continuity where appropriate.';
        effectivePrompt = `Edit the uploaded video according to this instruction: ${effectivePrompt}. ${audioDirective}`;
      } else if (imageBase64) {
        effectivePrompt = `Starting from the uploaded image as the opening frame, animate the scene naturally: ${effectivePrompt}`;
      }

      inputBlocks.push({ type: 'text', text: effectivePrompt });

      try {
        let interaction: any = await ai.interactions.create({
          model: 'gemini-omni-1.2-flash',
          input: inputBlocks.length === 1 && inputBlocks[0].type === 'text' ? inputBlocks[0].text : inputBlocks,
          response_format: {
            type: 'video',
            duration: `${clampedSeconds}s`,
            aspect_ratio: aspectRatio,
            resolution: resolution as any,
          },
          background: true,
        } as any);

        const maxPollMs = 8 * 60 * 1000; // 8 minutes max
        const startPoll = Date.now();
        while (
          interaction &&
          (interaction.status === 'in_progress' || interaction.status === 'queued') &&
          Date.now() - startPoll < maxPollMs
        ) {
          await new Promise(resolve => setTimeout(resolve, 6000));
          interaction = await ai.interactions.get(interaction.id);
        }

        if (interaction?.status === 'failed' || interaction?.error) {
          const errMsg = interaction?.error?.message || 'Gemini Omni 1.2 Flash gặp lỗi khi tạo video.';
          throw new Error(this.getFriendlyErrorMessage({ message: errMsg }));
        }

        for (const step of interaction?.steps || []) {
          if (step?.type === 'model_output' && Array.isArray(step.content)) {
            for (const block of step.content) {
              if (block?.type === 'video') {
                if (block.data) {
                  return `data:${block.mime_type || 'video/mp4'};base64,${block.data}`;
                }
                if (block.uri) {
                  const fetched = await this.fetchMediaUriAsBase64(block.uri, keyToUse);
                  return `data:${fetched.mimeType.startsWith('video/') ? fetched.mimeType : 'video/mp4'};base64,${fetched.data}`;
                }
              }
            }
          }
        }

        throw new Error(this.getFriendlyErrorMessage({ message: "Gemini Omni 1.2 Flash hoàn tất nhưng không trả về dữ liệu video (có thể bị chặn bởi bộ lọc an toàn)." }));
      } catch (omniErr: any) {
        console.error("[GeminiService] Omni 1.2 Flash failed:", omniErr);
        throw new Error(this.getFriendlyErrorMessage(omniErr), { cause: omniErr });
      }
    }

    // 2. Optional Veo 3.1 Lite Path
    const ai = new GoogleGenAI({ apiKey: keyToUse });
    const veoRes = resolution === '1080p' ? '1080p' : '720p';
    const config: any = { numberOfVideos: 1, resolution: veoRes, aspectRatio };
    const params: any = { model: 'veo-3.1-lite-generate-preview', prompt, config };

    if (imageBase64) {
      const cleaned = stripDataUriPrefix(imageBase64, 'image/png');
      params.image = { imageBytes: cleaned.data, mimeType: cleaned.mimeType };
    }

    const operation = await ai.models.generateVideos(params);
    let currentOp = operation;
    while (!currentOp.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      currentOp = await ai.operations.getVideosOperation({ operation: currentOp });
    }

    if (currentOp.error) {
      const errorMsg = (currentOp.error as any).message || "Video generation failed due to safety filters or model limits.";
      throw new Error(this.getFriendlyErrorMessage({ message: errorMsg }), { cause: currentOp.error });
    }

    const responseBody = currentOp.response || (currentOp as any).result;
    const downloadLink = responseBody?.generatedVideos?.[0]?.video?.uri;

    if (!downloadLink) {
      throw new Error(this.getFriendlyErrorMessage({ message: "Video generation completed but no video link returned." }));
    }

    const fetched = await this.fetchMediaUriAsBase64(downloadLink, keyToUse);
    return `data:${fetched.mimeType.startsWith('video/') ? fetched.mimeType : 'video/mp4'};base64,${fetched.data}`;
  }

  async searchChat(
    prompt: string,
    previousInteractionId?: string
  ): Promise<{ text: string; sources?: { uri: string; title: string }[]; interactionId?: string }> {
    const { projectId, accessToken } = this.getVertexConfig();
    const apiKey = this.getApiKey();

    if (!projectId && !accessToken && apiKey) {
      try {
        const ai = this.getClient();
        const isFree = isFreeTierKey(apiKey);
        const model = isFree ? 'gemini-4-hydrogen' : 'gemini-4-argon';
        const req: Record<string, any> = {
          model,
          input: prompt,
          system_instruction:
            'Bạn là YODY Knowledge — chuyên gia tư vấn xu hướng thời trang, chất liệu, bảng màu thương mại và công nghệ sáng tạo năm 2026. Trả lời bằng tiếng Việt súc tích, chuyên nghiệp, có gợi ý bảng màu/chất liệu thực tế để đưa vào thiết kế.',
          generation_config: { thinking_level: 'medium' },
        };
        if (previousInteractionId) {
          req.previous_interaction_id = previousInteractionId;
        }
        if (!isFree) {
          req.tools = [{ type: 'google_search' }];
        }

        const interaction: any = await ai.interactions.create(req as any);
        const textChunks: string[] = [];
        const sources: { uri: string; title: string }[] = [];

        for (const step of interaction?.steps || []) {
          if (step?.type === 'google_search_result' && Array.isArray(step.results)) {
            for (const item of step.results) {
              const uri = item?.url || item?.uri;
              if (uri && !sources.some(s => s.uri === uri)) {
                sources.push({ uri, title: item.title || 'Nguồn Web' });
              }
            }
          }
          if (step?.type === 'model_output' && Array.isArray(step.content)) {
            for (const block of step.content) {
              if (block?.type === 'text' && typeof block.text === 'string') {
                textChunks.push(block.text);
                if (Array.isArray(block.annotations)) {
                  for (const ann of block.annotations) {
                    const uri = ann?.url || ann?.uri;
                    if (uri && !sources.some(s => s.uri === uri)) {
                      sources.push({ uri, title: ann.title || 'Nguồn Web' });
                    }
                  }
                }
              }
            }
          }
        }

        return {
          text: textChunks.join('') || 'Không có phản hồi.',
          sources: sources.length > 0 ? sources : undefined,
          interactionId: interaction?.id,
        };
      } catch (e: any) {
        throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
      }
    }

    try {
      const response = await this.callModel({
        model: 'gemini-4-argon',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      });
      const text = response.text || "Không có phản hồi.";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks
        ?.map((chunk: any) => chunk.web)
        .filter((web: any) => web)
        .map((web: any) => ({ uri: web.uri, title: web.title }));
      return { text, sources };
    } catch (e: any) {
      throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  async relightSubjectWithBackground(
    subjectBase64: string,
    bgPromptOrImage: string,
    isBgImage = false,
    aspectRatio = '3:4'
  ): Promise<string | undefined> {
    const parts: any[] = [];
    const cleanedSubj = stripDataUriPrefix(subjectBase64, 'image/png');
    parts.push({ inlineData: { mimeType: cleanedSubj.mimeType, data: cleanedSubj.data } });

    let relightInstruction: string;
    if (isBgImage && bgPromptOrImage) {
      const cleanedBg = stripDataUriPrefix(bgPromptOrImage, 'image/png');
      parts.push({ inlineData: { mimeType: cleanedBg.mimeType, data: cleanedBg.data } });
      relightInstruction = `Composite the foreground subject from the first image seamlessly into the background environment from the second image.
      CRITICAL REQUIREMENTS:
      1. Preserve 100% of the subject's facial identity, body pose, proportions, and exact clothing details/colors/logos.
      2. Match ambient light temperature, subtle rim lighting along hair/shoulders, and natural floor contact shadows so the subject looks physically photographed inside that exact environment.`;
    } else {
      relightInstruction = `Place the foreground subject into this new studio/lifestyle environment: "${bgPromptOrImage}".
      CRITICAL REQUIREMENTS:
      1. Preserve 100% of the subject's facial identity, body pose, proportions, and exact clothing details/colors/logos.
      2. Harmonize directional lighting, subtle rim light on hair and fabric edges, and cast realistic soft contact shadows onto the ground.`;
    }

    parts.push({ text: relightInstruction });

    try {
      const response = await this.callModel({
        model: 'gemini-nano-banana-2.1',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: this.getNormalizedAspectRatio(aspectRatio),
            imageSize: '1K',
          },
          thinkingLevel: 'medium',
        },
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
      throw new Error(this.getFriendlyErrorMessage(e), { cause: e });
    }
  }

  async generateVoiceoverTTS(
    scriptText: string,
    voiceStyle = 'Warm, luxury commercial fashion narrator with clear studio diction',
    voiceName = 'Kore'
  ): Promise<string> {
    const keyToUse = this.getApiKey();
    if (!keyToUse) {
      throw new Error('Vui lòng cấu hình Gemini API Key để tạo giọng đọc thuyết minh AI (Gemini 3.8 TTS).');
    }

    const ai = this.getClient();
    const cleanScript = (scriptText || '').trim();
    if (!cleanScript) {
      throw new Error('Nội dung kịch bản thuyết minh không được để trống.');
    }

    const models = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];
    let lastErr: any = null;

    for (const model of models) {
      try {
        const interaction: any = await ai.interactions.create({
          model,
          input: [
            {
              type: 'text',
              text: cleanScript,
              annotations: [
                {
                  type: 'speech_metadata',
                  speaker: 'Narrator',
                  style: voiceStyle,
                },
              ],
            },
          ],
          response_format: [{ type: 'audio', mime_type: 'audio/wav' }],
          generation_config: {
            speech_config: [{ speaker: 'Narrator', voice: voiceName }],
          },
        } as any);

        for (const step of interaction?.steps || []) {
          if (step?.type === 'model_output' && Array.isArray(step.content)) {
            for (const block of step.content) {
              if (block?.type === 'audio') {
                if (block.data) {
                  return `data:${block.mime_type || 'audio/wav'};base64,${block.data}`;
                }
                if (block.uri) {
                  const fetched = await this.fetchMediaUriAsBase64(block.uri, keyToUse);
                  return `data:${fetched.mimeType.startsWith('audio/') ? fetched.mimeType : 'audio/wav'};base64,${fetched.data}`;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[GeminiService] TTS failed with ${model}, trying fallback...`, err);
        lastErr = err;
      }
    }

    throw new Error(this.getFriendlyErrorMessage(lastErr || { message: 'Không thể tạo giọng đọc AI.' }));
  }

  private getFriendlyErrorMessage(error: any): string {
    const message = error?.message?.toLowerCase() || '';
    const status = error?.status || error?.code || error?.response?.status || '';

    if (message.includes('503') || message.includes('high demand')) {
      return 'Hệ thống đang quá tải (503). Vui lòng thử lại sau ít phút nhé!';
    }
    if (message.includes('permission denied') || message.includes('403') || message.includes('api_key_invalid') || message.includes('invalid api key') || message.includes('api key not valid')) {
      return 'API Key không hợp lệ hoặc chưa được thiết lập. Vui lòng kiểm tra lại trong phần cài đặt API Key.';
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
      if (message.includes('image') || message.includes('veo') || message.includes('omni') || message.includes('nano-banana') || message.includes('lyria') || message.includes('imagen') || message.includes('try-on') || message.includes('generation')) {
        return 'Tính năng tạo, chỉnh sửa hoặc xử lý ảnh/video (Nano Banana 2.1, Imagen 4, Omni 1.2 Flash, Veo) yêu cầu tài khoản Gemini API trả phí (Pay-As-You-Go) hoặc dùng miễn phí qua tab Google Flow.';
      }
      return 'Tính năng này yêu cầu tài khoản Gemini API trả phí (gói Pay-As-You-Go). Gói Miễn phí (Free Tier) hiện tại có hạn mức bằng 0 cho mô hình này.';
    }
    if (message.includes('quota') || message.includes('429') || status === 429 || status === 'RESOURCE_EXHAUSTED') {
      return 'Bạn đã hết hạn mức sử dụng (Quota - 429). Vui lòng nâng cấp tài khoản, đổi API Key trả phí khác hoặc chuyển sang Google Flow.';
    }
    if (message.includes('max tokens') || message.includes('token limit')) {
      return 'Yêu cầu quá dài hoặc vượt quá giới hạn xử lý của mô hình.';
    }

    return error?.message?.startsWith('Tính năng') || error?.message?.startsWith('Bạn đã hết') || error?.message?.startsWith('API Key')
      ? error.message
      : `Lỗi hệ thống: ${error?.message || 'Đã có lỗi xảy ra'}. ${status ? `(Mã: ${status})` : ''}`.trim();
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

    referenceImages.forEach((ref) => {
      parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
    });

    const prompt = `
    Role: Professional AI Prompt Engineer and Creative Director for Fashion & Art.

    Task: Based on the provided user description ("${ideaDescription}") and any reference images, generate 3 DISTINCT, HIGH-QUALITY creative concepts for AI image generation (Nano Banana 2.1 / Imagen 4 studio style).

    Requirements:
    1. Analyze the style, subject, and lighting from references (if any).
    2. Create 3 different variations (e.g., one cinematic, one studio fashion, one artistic/editorial).
    3. Output STRICTLY a JSON array with 3 objects.
    4. Each object must have:
       - title_vn: A short, catchy title in Vietnamese.
       - title_en: A short, catchy title in English.
       - description_vn: A brief explanation (1 sentence) of why this concept works, in Vietnamese.
       - prompt_en: The actual detailed prompt in English (include lighting, camera angle, texture, style keywords).
       - prompt_vn: The translation of the prompt in Vietnamese.
    `;
    parts.push({ text: prompt });

    try {
      const response = await this.callModel({
        model: 'gemini-4-argon',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          systemInstruction: "Generate 3 concise, high-quality creative concepts in JSON format. Keep descriptions and prompts focused."
        }
      });

      const text = response.text || "[]";
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
        model: 'gemini-4-hydrogen',
        contents: `Rewrite the following simple image or video generation prompt into a detailed, professional, and descriptive commercial fashion prompt in English. Return ONLY the rewritten prompt text.\nOriginal: "${prompt}"`,
      });
      return response.text ? response.text.trim() : prompt;
    } catch (e) {
      console.error("Enhance prompt failed", e);
      return prompt;
    }
  }
}

export const geminiService = new GeminiService();

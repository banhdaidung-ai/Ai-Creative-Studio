
// ... existing imports ...
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

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
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash', tier: 'standard', desc: 'Nhanh, tiết kiệm' },
    { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash', tier: 'pro', desc: 'Chất lượng cao (Mặc định)' },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro', tier: 'pro', desc: 'Siêu thực, chi tiết' },
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4.0', tier: 'pro', desc: 'Nghệ thuật, Studio' },
];

export class GeminiService {
  private getApiKey(): string {
    // Trim whitespace to prevent "Permission Denied" due to formatting
    const localKey = localStorage.getItem('gemini_api_key');
    if (localKey) return localKey.trim();
    return process.env.API_KEY || '';
  }

  public getClient(): GoogleGenAI {
     return new GoogleGenAI({ apiKey: this.getApiKey() });
  }

  async generateDescription(imageBase64: string): Promise<string> {
    const ai = this.getClient();
    try {
        const response = await ai.models.generateContent({
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
        return "Main subject";
    }
  }

  async generateImage(
    prompt: string,
    config: {
      modelTier: 'standard' | 'pro';
      aspectRatio: string;
      imageSize?: string;
      modelId?: string;
    },
    referenceImagesBase64: string[] = []
  ): Promise<string | undefined> {
    const ai = this.getClient();
    const modelId = config.modelId || (config.modelTier === 'pro' ? 'gemini-3.1-flash-image-preview' : 'gemini-2.5-flash-image');
    
    // Handle Imagen models
    if (modelId.startsWith('imagen-')) {
        try {
            const response = await ai.models.generateImages({
                model: modelId,
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: config.aspectRatio as any,
                },
            });
            const base64 = response.generatedImages[0]?.image.imageBytes;
            return base64;
        } catch (e) {
            console.error("Imagen generation failed", e);
            throw e;
        }
    }

    const parts: any[] = [];
    
    // Add reference images if any
    referenceImagesBase64.forEach((ref) => {
       parts.push({ inlineData: { mimeType: 'image/png', data: ref } });
    });

    parts.push({ text: prompt });
    
    const apiConfig: any = {
        imageConfig: { aspectRatio: config.aspectRatio },
        temperature: 0.4
    };
    if (config.modelTier === 'pro' && config.imageSize) {
        apiConfig.imageConfig.imageSize = config.imageSize;
    }

    try {
        const response = await ai.models.generateContent({
            model: modelId,
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
        // Fallback for Permission Denied on Pro models
        if (config.modelTier === 'pro' && (e.message?.includes('permission denied') || e.message?.includes('403'))) {
            console.warn("Pro model permission denied, falling back to standard model...");
            return this.generateImage(prompt, { ...config, modelTier: 'standard' }, referenceImagesBase64);
        }
        console.error("Image generation failed", e);
        throw e;
    }
  }

  async generateSegmentationMask(
    imageBase64: string, 
    tier: 'standard' | 'pro' = 'standard',
    options?: { imageSize?: string, modelId?: string }
  ): Promise<string | undefined> {
    const ai = this.getClient();
    let model = options?.modelId || (tier === 'pro' ? 'gemini-3.1-flash-image-preview' : 'gemini-2.5-flash-image');
    
    // Force Gemini models for segmentation as Imagen doesn't support generateContent
    if (model.startsWith('imagen-')) {
        model = tier === 'pro' ? 'gemini-3.1-flash-image-preview' : 'gemini-2.5-flash-image';
    }
    
    const prompt = `
    Role: Professional Image Matting & Segmentation Expert.
    Task: Generate a high-fidelity alpha matte (segmentation mask) for the foreground subject.

    STRICT OUTPUT REQUIREMENTS:
    1. **Format**: Pure Black and White image ONLY. 
       - White (#FFFFFF) = Foreground Subject (The person, clothes, objects held).
       - Black (#000000) = Everything else (Background).
    2. **Subject**: Include the person, all clothing, shoes, hair, and held accessories.
    3. **Precision**: 
       - Edges must be SHARP and match the subject's boundary exactly.
       - No halos, no glowing edges, no artifacts.
       - **Hair**: Capture fine details but keep the mask solid white for the main body of hair.
    4. **Safety**: Do not regenerate or hallucinate new features. Just create the silhouette mask of the EXISTING subject.
    `;
    
    const apiConfig: any = {
        temperature: 0.2 
    };

    if (tier === 'pro' && options?.imageSize) {
        apiConfig.imageConfig = { imageSize: options.imageSize };
    }
    
    try {
      const response = await ai.models.generateContent({
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
      return undefined;
    } catch (e: any) {
      if (tier === 'pro' && (e.message?.includes('permission denied') || e.message?.includes('403'))) {
          console.warn("Pro mask permission denied, falling back...");
          return this.generateSegmentationMask(imageBase64, 'standard');
      }
      console.error("Mask generation failed", e);
      throw e;
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

  async editImage(
    modelImageBase64: string,
    prompt: string,
    referenceImagesBase64: string[] = [],
    config: {
      modelTier: 'standard' | 'pro';
      aspectRatio: string;
      imageSize?: string;
      modelId?: string;
    }
  ): Promise<string | undefined> {
    const ai = this.getClient();
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
       - **TEXTURE**: Preserve the exact fabric weave, roughness, sheen, and material weight.
       - **COLOR**: Maintain the EXACT RGB color profile of the reference. Do not shift hue, saturation, or brightness.
       - **DETAILS**: Preserve ALL distinct details: buttons, zippers, logos, patterns, stitching, pockets, and collar shape.

    2. **PHOTOREALISM & INTEGRATION**:
       - The result must look like a high-end fashion photograph.
       - Ensure realistic lighting interaction (shadows, highlights, reflections).
       - Natural drape and fit on the model's body shape.

    3. **COLOR & LIGHTING CONSISTENCY (ABSOLUTE PRIORITY)**:
       - Maintain the EXACT white balance, skin tones, and color palette of the original image.
       - **NO COLOR CASTS**: Strictly avoid any reddish, pinkish, or warm filters. 
       - **NEUTRAL WHITES**: Ensure neutral whites and grays in the original image remain neutral.
       - **SATURATION CONTROL**: Do not increase the saturation of skin tones. Keep the skin tone identical to the source.
       - Do not apply any "beautification" color grading that shifts the original colors.

    4. **IDENTITY & FRAMING PRESERVATION (MANDATORY)**:
       - Do not change the model's face, skin tone, body type, or background.
       - **STRICT COMPOSITION**: Maintain the EXACT camera distance, focal length, and framing of the original image. 
       - **NO ZOOMING**: Do not zoom in, crop, or reposition the subject.

    Instruction: "${prompt}"
    `;

    parts.push({ text: enhancedPrompt });

    const modelName = config.modelId || (config.modelTier === 'pro' ? 'gemini-3.1-flash-image-preview' : 'gemini-2.5-flash-image');

    // Handle Imagen models for editing (Note: Imagen 4.0 uses generateImages and doesn't support mask/image-to-image in the same way as Gemini)
    if (modelName.startsWith('imagen-')) {
        try {
            const response = await ai.models.generateImages({
                model: modelName,
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: config.aspectRatio as any,
                },
            });
            return response.generatedImages[0]?.image.imageBytes;
        } catch (e) {
            console.error("Imagen edit failed", e);
            throw e;
        }
    }

    const imageConfig: any = { aspectRatio: config.aspectRatio };
    if (config.modelTier === 'pro' && config.imageSize) imageConfig.imageSize = config.imageSize;

    const apiConfig: any = {
        imageConfig,
        temperature: 0.4, 
        topK: 40,
        topP: 0.90
    };

    try {
      const response = await ai.models.generateContent({
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
        if (config.modelTier === 'pro' && (e.message?.includes('permission denied') || e.message?.includes('403'))) {
            console.warn("Pro edit permission denied, falling back...");
            return this.editImage(modelImageBase64, prompt, referenceImagesBase64, { ...config, modelTier: 'standard' });
        }
        throw e;
    }
  }

  async generateSingleAngle(
      modelImageBase64: string,
      angleId: string,
      referenceImagesBase64: string[] = [],
      config: { 
        aspectRatio: string; 
        imageSize?: string;
        modelTier?: 'standard' | 'pro';
        modelId?: string;
        customPrompt?: string;
        faceImageBase64?: string;
        backImageBase64?: string;
        stylePrompt?: string;
      }
  ): Promise<string | null> {
    const ai = this.getClient();
    const tier = config.modelTier || 'pro'; 
    const modelName = config.modelId || (tier === 'pro' ? 'gemini-3.1-flash-image-preview' : 'gemini-2.5-flash-image');
    
    // Handle Imagen models for single angle
    if (modelName.startsWith('imagen-')) {
        try {
            const angleConfig = ANGLE_CONFIGS.find(a => a.id === angleId);
            const poseInstruction = config.customPrompt || angleConfig?.userDesc || "";
            const response = await ai.models.generateImages({
                model: modelName,
                prompt: `${poseInstruction}. ${config.stylePrompt || ""}`,
                config: {
                    numberOfImages: 1,
                    aspectRatio: config.aspectRatio as any,
                },
            });
            return response.generatedImages[0]?.image.imageBytes || null;
        } catch (e) {
            console.error("Imagen angle generation failed", e);
            return null;
        }
    }

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

    2. **COLOR & LIGHTING CONSISTENCY (ABSOLUTE PRIORITY)**:
       - Maintain the EXACT white balance, skin tones, and color palette of the original image.
       - **NO COLOR CASTS**: Strictly avoid any reddish, pinkish, or warm filters. 
       - **NEUTRAL WHITES**: Ensure neutral whites and grays in the original image remain neutral.
       - **SATURATION CONTROL**: Do not increase the saturation of skin tones. Keep the skin tone identical to the source.
       - Do not apply any "beautification" color grading that shifts the original colors.

    3. **POSE & PHOTOGRAPHY**:
       - Execute the requested pose: "${poseInstruction}".
       - **FRAMING & COMPOSITION**: Maintain the camera distance and framing appropriate for a ${angleConfig.name}. 
       - **NO UNWANTED ZOOM**: Do not zoom in closer than the original model image unless the angle specifically requires it (like Close-up or Macro). For Full Body and Medium shots, keep the subject's scale consistent with the source.
       - Ensure correct anatomy (fingers, limbs) without artifacts.
       - Lighting should be professional and consistent with the chosen style.
       
    4. **OUTFIT & TEXTURE FIDELITY**:
       - The garment texture (e.g., denim, silk, cotton) must be indistinguishable from the source.
       - Maintain exact logos, patterns, and seam details.
       - Ensure the fabric drapes and folds naturally according to the new pose.${extraInstructions}
       
    ${styleInstruction}

    NEGATIVE PROMPT (ABSOLUTE RESTRICTIONS):
    Distorted face, blurry face, low quality face, melted eyes, asymmetric eyes, cross-eyed, plastic skin, bad anatomy, missing fingers, extra fingers, cartoon, illustration, painting, different person, face swap failure, low resolution, jpeg artifacts, motion blur on face, deformed features, reddish tint, warm color cast, pink skin, magenta cast, over-saturated skin, tanned skin, color filter, warm lighting bias.
    `;

    parts.push({ text: prompt });

    const apiConfig: any = {
        imageConfig: { aspectRatio: config.aspectRatio },
        // Lower temperature slightly to 0.35 for more deterministic/stable facial features
        temperature: 0.35, 
        topK: 40,
        topP: 0.90,
    };
    if (tier === 'pro') apiConfig.imageConfig.imageSize = config.imageSize || '1K';

    try {
        const response = await ai.models.generateContent({
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
            return this.generateSingleAngle(modelImageBase64, angleId, referenceImagesBase64, { ...config, modelTier: 'standard' });
        }
        return null; 
    }
  }

  async upscaleImage(
    imageBase64: string,
    targetSize: '2K' | '4K',
    aspectRatio: string = '1:1'
  ): Promise<string | undefined> {
    const ai = this.getClient();
    const model = 'gemini-3.1-flash-image-preview';

    const prompt = `
    Role: High-End Image Upscaler & Detail Enhancer.
    Task: Upscale the provided image to ${targetSize} resolution.

    STRICT VISUAL REQUIREMENTS:
    1. **RESOLUTION**: Generate the output strictly at ${targetSize}.
    2. **FIDELITY**: Preserve the EXACT content, composition, pose, face, and clothing of the original image. Do not change the subject.
    3. **ENHANCEMENT**: Sharpen details, refine textures (skin, fabric), and remove any compression artifacts or blurriness.
    4. **COLOR & LIGHTING CONSISTENCY (ABSOLUTE PRIORITY)**:
       - Maintain the EXACT white balance, skin tones, and color palette of the original image.
       - **NO COLOR CASTS**: Strictly avoid any reddish, pinkish, or warm filters. 
       - **NEUTRAL WHITES**: Ensure neutral whites and grays in the original image remain neutral.
       - **SATURATION CONTROL**: Do not increase the saturation of skin tones. Keep the skin tone identical to the source.
       - Use **neutral studio lighting**. Do not apply any "beautification" or "cinematic" color grading that shifts the original colors.

    NEGATIVE PROMPT (ABSOLUTE RESTRICTIONS):
    Reddish tint, warm color cast, pink skin, magenta cast, over-saturated skin, tanned skin, color filter, warm lighting bias, distorted features, blurry details, changed identity.
    `;

    try {
      const response = await ai.models.generateContent({
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
          temperature: 0.1
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
      throw e;
    }
  }

  async generateVideo(
    prompt: string, 
    imageBase64?: string,
    options: { resolution: '720p' | '1080p', aspectRatio: '16:9' | '9:16' } = { resolution: '1080p', aspectRatio: '16:9' }
  ): Promise<string | null> {
    const ai = this.getClient();
    const config: any = { numberOfVideos: 1, resolution: options.resolution, aspectRatio: options.aspectRatio };
    
    // Switch to fast model for better reliability
    let params: any = { model: 'veo-3.1-fast-generate-preview', prompt: prompt, config: config };
    
    if (imageBase64) {
      params.image = { imageBytes: imageBase64, mimeType: 'image/png' };
    }
    
    try {
      let operation = await ai.models.generateVideos(params);
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Increased polling to 10s
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      // Check for errors in the operation response to handle failures
      if (operation.error) {
        const errorMsg = (operation.error as any).message || "Video generation failed due to safety filters or model limits.";
        throw new Error(errorMsg);
      }

      const responseBody = operation.response || (operation as any).result;
      const downloadLink = responseBody?.generatedVideos?.[0]?.video?.uri;
      
      if (!downloadLink) {
          // Explicitly throw so the UI catches it as an error
          throw new Error("Video generation completed but no video link returned (likely blocked or empty response).");
      }
      
      const response = await fetch(`${downloadLink}&key=${this.getApiKey()}`);
      if (!response.ok) throw new Error("Failed to fetch video content from Google Storage");
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e) { throw e; }
  }

  async searchChat(prompt: string): Promise<{ text: string; sources?: {uri:string, title:string}[] }> {
    const ai = this.getClient();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      });
      const text = response.text || "No response generated.";
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => chunk.web).filter((web: any) => web).map((web: any) => ({ uri: web.uri, title: web.title }));
      return { text, sources };
    } catch (e) { throw e; }
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
    const ai = this.getClient();
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
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: { parts },
            config: {
                responseMimeType: 'application/json',
                temperature: 0.7
            }
        });

        const text = response.text || "[]";
        // Clean markdown code blocks if present
        const cleanJson = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("Prompt generation failed", e);
        throw e;
    }
  }
}

export const geminiService = new GeminiService();

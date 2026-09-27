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
  // Google Flow Models (Dùng tài khoản Google cá nhân — Không cần API Key)
  { id: 'google-flow-nano-banana-pro', name: '🍌 Nano Banana Pro (Flow)', desc: 'Chất lượng cao nhất của Google Flow — chi tiết cực nét, chuẩn Studio.', tier: 'flow' as any },
  { id: 'google-flow-nano-banana-2', name: '🍌 Nano Banana 2 (Flow)', desc: 'Chất lượng cao, cân bằng tốc độ của Google Flow.', tier: 'flow' as any },
  { id: 'google-flow-nano-banana-2-lite', name: '🍌 Nano Banana 2 Lite (Flow)', desc: 'Tốc độ siêu nhanh, nhẹ nhàng của Google Flow.', tier: 'flow' as any },

  // Gemini API Models
  { id: 'gemini-3.1-flash-lite-image', name: 'Nano Banana Lite (API)', desc: 'Tốc độ nhanh, tác vụ cơ bản.', tier: 'standard' },
  { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2 (API)', desc: 'Chất lượng cao, đa dạng tỉ lệ, tìm kiếm.', tier: 'pro' },
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro (API)', desc: 'Chi tiết cao, suy luận phức tạp.', tier: 'pro' },
  { id: 'imagen-4.0-generate-001', name: 'Imagen 4 (API)', desc: 'Nghệ thuật cao cấp, photorealistic.', tier: 'pro' }
];

import { GeminiService as CoreGeminiService } from '../server/gemini';

export class GeminiService {
  private async rpc(method: string, args: any[]) {
      const customKey = localStorage.getItem('gemini_api_key') || undefined;
      const vertexConfig = {
          projectId: localStorage.getItem('vertex_project_id') || undefined,
          location: localStorage.getItem('vertex_location') || undefined,
          accessToken: localStorage.getItem('vertex_access_token') || undefined
      };
      
      try {
        const res = await fetch(`/api/gemini/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ args, context: { customKey, vertexConfig } })
        });
        
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Non-JSON response from server');
        }
        
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.result;
      } catch (err: any) {
        console.warn(`[GeminiService] Server RPC unavailable (${err.message}). Falling back to direct client execution.`);
        const localService = new CoreGeminiService(customKey, vertexConfig);
        if (typeof (localService as any)[method] === 'function') {
          return await (localService as any)[method](...args);
        }
        throw err;
      }
  }

  async validateVertexConfig(projectId: string, location: string, accessToken: string): Promise<boolean> {
    return this.rpc('validateVertexConfig', [projectId, location, accessToken]);
  }
  
  async validateApiKey(key: string): Promise<boolean> {
    return this.rpc('validateApiKey', [key]);
  }

  async generateDescription(imageBase64: string): Promise<string> {
    return this.rpc('generateDescription', [imageBase64]);
  }

  async analyzeFashionImage(imageBase64: string): Promise<string> {
    return this.rpc('analyzeFashionImage', [imageBase64]);
  }

  async refineImage(originalImageBase64: string, maskImageBase64: string, prompt: string, config: any): Promise<string | undefined> {
    return this.rpc('refineImage', [originalImageBase64, maskImageBase64, prompt, config]);
  }

  async generateVariation(imageBase64: string, config: any): Promise<string | undefined> {
    return this.rpc('generateVariation', [imageBase64, config]);
  }

  async analyzeImageForPrompt(imageBase64: string): Promise<string | undefined> {
    return this.rpc('analyzeImageForPrompt', [imageBase64]);
  }

  async generateImage(prompt: string, config: any, referenceImagesBase64: string[] = []): Promise<string | undefined> {
    return this.rpc('generateImage', [prompt, config, referenceImagesBase64]);
  }

  async generateSegmentationMask(imageBase64: string, tier: 'standard' | 'pro' = 'standard', options?: any): Promise<string | undefined> {
    return this.rpc('generateSegmentationMask', [imageBase64, tier, options]);
  }

  async removeBackground(imageBase64: string, tier: 'standard' | 'pro' = 'standard', config?: any): Promise<string | undefined> {
    return this.rpc('removeBackground', [imageBase64, tier, config]);
  }

  async detectObject(imageBase64: string, objectDescription: string): Promise<any> {
    return this.rpc('detectObject', [imageBase64, objectDescription]);
  }

  async editImage(modelImageBase64: string, prompt: string, referenceImagesBase64: string[] = [], config: any): Promise<string | undefined> {
    return this.rpc('editImage', [modelImageBase64, prompt, referenceImagesBase64, config]);
  }

  async generateSingleAngle(modelImageBase64: string, angleId: string, referenceImagesBase64: string[] = [], config: any): Promise<string | null> {
    return this.rpc('generateSingleAngle', [modelImageBase64, angleId, referenceImagesBase64, config]);
  }

  async upscaleImage(imageBase64: string, targetSize: '2K' | '4K', aspectRatio: string = '1:1'): Promise<string | undefined> {
    return this.rpc('upscaleImage', [imageBase64, targetSize, aspectRatio]);
  }

  async generateVideo(prompt: string, imageBase64?: string, options: any = { resolution: '1080p', aspectRatio: '16:9' }): Promise<string | null> {
    const dataUri = await this.rpc('generateVideo', [prompt, imageBase64, options]);
    if (dataUri && dataUri.startsWith('data:')) {
       const res = await fetch(dataUri);
       const blob = await res.blob();
       return URL.createObjectURL(blob);
    }
    return dataUri;
  }

  async searchChat(prompt: string): Promise<any> {
    return this.rpc('searchChat', [prompt]);
  }

  async generateCreativePrompts(ideaDescription: string, referenceImages: string[]): Promise<any> {
    return this.rpc('generateCreativePrompts', [ideaDescription, referenceImages]);
  }

  async enhancePrompt(prompt: string): Promise<string> {
    return this.rpc('enhancePrompt', [prompt]);
  }
}
export const geminiService = new GeminiService();

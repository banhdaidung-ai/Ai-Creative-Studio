
/**
 * Định dạng an toàn cho src ảnh trong HTML/JSX.
 * Tránh triệt để lỗi double prefix (data:image/png;base64,data:...) làm ảnh bị đen hoặc hỏng.
 * Tự động nhận diện URL (http/https/blob) hoặc định dạng MIME chính xác (JPEG, PNG, WebP).
 */
export const formatImageSrc = (img?: string | null): string => {
  if (!img) return '';
  const trimmed = img.trim();

  // 1. Already a data URI or blob URL
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 2. HTTP or HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  
  // 3. Check common base64 image signatures FIRST before generic slash check
  // JPEG base64 signature (/9j/)
  if (trimmed.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  // PNG base64 signature
  if (trimmed.startsWith('iVBORw0KGgo')) {
    return `data:image/png;base64,${trimmed}`;
  }
  // WebP base64 signature (RIFF/WEBP)
  if (trimmed.startsWith('UklGR')) {
    return `data:image/webp;base64,${trimmed}`;
  }
  // GIF base64 signature
  if (trimmed.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${trimmed}`;
  }
  // AVIF or HEIC base64 signature
  if (trimmed.startsWith('AAAA')) {
    return `data:image/avif;base64,${trimmed}`;
  }
  // SVG base64 signature
  if (trimmed.startsWith('PHN2Zw')) {
    return `data:image/svg+xml;base64,${trimmed}`;
  }

  // 4. Only genuine relative URL paths (e.g., /assets/logo.png, /vite.svg) and NOT a long base64 string
  if (trimmed.startsWith('/') && trimmed.length < 500 && !trimmed.includes('\n')) {
    return trimmed;
  }
  
  // 5. If we can't identify it, default to png (most common API output)
  return `data:image/png;base64,${trimmed}`;
};

export const extractRatioFromPrompt = (prompt: string): string | null => {
  const match = prompt.match(/(?:--ar|--aspect|ratio|tỷ lệ|aspect ratio)\s*[:=]?\s*(\d+[:/x]\d+)/i);
  if (match) {
    return match[1].replace(/[/x]/, ':');
  }
  return null;
};

export const fileToBase64 = (file: File): Promise<string> => {
  // If file is large (> 2MB), automatically resize to avoid browser UI thread freeze
  if (file.size > 2 * 1024 * 1024) {
    return resizeImage(file, 1536, 'image/jpeg', 0.85);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const resizeImage = async (
  file: File, 
  maxSize: number = 1536, 
  mimeType: string = 'image/jpeg', 
  quality: number = 0.85
): Promise<string> => {
  try {
    // 1. First attempt: use createImageBitmap for off-thread non-blocking decoding
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        let w = bitmap.width;
        let h = bitmap.height;

        if (w > h) {
          if (w > maxSize) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          }
        } else {
          if (h > maxSize) {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(bitmap, 0, 0, w, h);
          bitmap.close();
          const dataUrl = canvas.toDataURL(mimeType, quality);
          return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        }
      } catch {
        // Fallback to Image element below
      }
    }

    // 2. Fallback: use URL.createObjectURL (avoids heavy readAsDataURL RAM consumption)
    return await new Promise<string>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width;
          let h = img.height;

          if (w > h) {
            if (w > maxSize) {
              h = Math.round((h * maxSize) / w);
              w = maxSize;
            }
          } else {
            if (h > maxSize) {
              w = Math.round((w * maxSize) / h);
              h = maxSize;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
          }
          URL.revokeObjectURL(objectUrl);
          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve(dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      };
      img.src = objectUrl;
    });
  } catch (error) {
    console.error("resizeImage error, falling back to FileReader:", error);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};

export interface PaddingInfo {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const padImageToRatio = (base64: string, targetRatioStr: string): Promise<{ base64: string, info: PaddingInfo }> => {
  return new Promise((resolve, reject) => {
    const [rw, rh] = targetRatioStr.split(':').map(Number);
    const targetRatio = rw / rh;
    
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    img.onload = () => {
      const currentRatio = img.width / img.height;
      
      const info: PaddingInfo = {
        offsetX: 0,
        offsetY: 0,
        width: img.width,
        height: img.height,
        canvasWidth: img.width,
        canvasHeight: img.height
      };

      console.log("Padding image to ratio:", targetRatioStr, "currentRatio:", currentRatio, "targetRatio:", targetRatio);
      // If already very close, don't pad
      if (Math.abs(currentRatio - targetRatio) < 0.01) {
        resolve({ base64, info });
        return;
      }

      const drawWidth = img.width;
      const drawHeight = img.height;
      let canvasWidth = img.width;
      let canvasHeight = img.height;

      if (currentRatio > targetRatio) {
        // Image is wider than target ratio
        canvasHeight = img.width / targetRatio;
      } else {
        // Image is taller than target ratio
        canvasWidth = img.height * targetRatio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject("Canvas context failed"); return; }

      // Sample corner colors to get a neutral background color
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = img.width;
      sampleCanvas.height = img.height;
      const sampleCtx = sampleCanvas.getContext('2d');
      if (sampleCtx) {
        sampleCtx.drawImage(img, 0, 0);
        const corners = [
          sampleCtx.getImageData(0, 0, 1, 1).data,
          sampleCtx.getImageData(img.width - 1, 0, 1, 1).data,
          sampleCtx.getImageData(0, img.height - 1, 1, 1).data,
          sampleCtx.getImageData(img.width - 1, img.height - 1, 1, 1).data
        ];
        const avgR = Math.round(corners.reduce((sum, c) => sum + c[0], 0) / 4);
        const avgG = Math.round(corners.reduce((sum, c) => sum + c[1], 0) / 4);
        const avgB = Math.round(corners.reduce((sum, c) => sum + c[2], 0) / 4);
        ctx.fillStyle = `rgb(${avgR}, ${avgG}, ${avgB})`;
      } else {
        ctx.fillStyle = '#F5F5F5';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const offsetX = (canvasWidth - drawWidth) / 2;
      const offsetY = (canvasHeight - drawHeight) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      info.offsetX = offsetX;
      info.offsetY = offsetY;
      info.canvasWidth = canvasWidth;
      info.canvasHeight = canvasHeight;

      resolve({ 
        base64: canvas.toDataURL('image/png').split(',')[1],
        info
      });
    };
    img.onerror = reject;
  });
};

export const unpadImage = (resultBase64: string, info: PaddingInfo): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:image/png;base64,${resultBase64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      
      // Calculate relative crop coordinates on the result image
      const scaleX = img.width / info.canvasWidth;
      const scaleY = img.height / info.canvasHeight;
      
      const cropX = info.offsetX * scaleX;
      const cropY = info.offsetY * scaleY;
      const cropW = info.width * scaleX;
      const cropH = info.height * scaleY;

      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject("Canvas context failed"); return; }

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = reject;
  });
};

export const smoothImage = (base64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject("Canvas context failed"); return; }

      // 1. Draw original base
      ctx.drawImage(img, 0, 0);
      
      // 2. Create a "Surface Blur" effect by layering
      // We use a temporary canvas to generate the blurred layer
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = img.width;
      blurCanvas.height = img.height;
      const blurCtx = blurCanvas.getContext('2d');
      if (blurCtx) {
        blurCtx.filter = 'blur(2px) saturate(1.05)';
        blurCtx.drawImage(img, 0, 0);
        
        // Blend the blurred version back at 40% opacity
        // This smooths out skin tones/noise while keeping the original structure underneath
        ctx.globalAlpha = 0.4;
        ctx.drawImage(blurCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
      }

      // 3. Bring back edges and details using a sharpen-like contrast boost
      // This helps prevent the "blurry" look the user complained about
      ctx.filter = 'contrast(1.08) brightness(1.02) saturate(1.01)';
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.15; // Subtle overlay of the original to pop details
      ctx.drawImage(img, 0, 0);
      
      // Reset state
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.filter = 'none';

      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = reject;
  });
};

export const applyMask = (originalBase64: string, maskBase64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const originalImg = new Image();
    const maskImg = new Image();
    
    let loadedCount = 0;
    const onLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        const canvas = document.createElement('canvas');
        canvas.width = originalImg.width;
        canvas.height = originalImg.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject("Canvas context failed"); return; }

        // Draw original image
        ctx.drawImage(originalImg, 0, 0);
        
        // Get image data
        const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Create a high-quality mask canvas with slight smoothing
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = originalImg.width;
        maskCanvas.height = originalImg.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) { reject("Mask canvas context failed"); return; }
        
        // Draw mask with slight blur to anti-alias edges
        maskCtx.filter = 'blur(0.5px)'; 
        maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply mask to alpha channel with edge enhancement
        for (let i = 0; i < originalData.data.length; i += 4) {
          const maskValue = maskData.data[i]; 
          
          // Apply a slight contrast curve to the mask to sharpen edges while keeping anti-aliasing
          // Values near 0 become 0, values near 255 become 255, middle values stay smooth
          let alpha = maskValue;
          if (alpha > 0 && alpha < 255) {
            // Simple contrast boost for alpha
            alpha = (alpha - 128) * 1.1 + 128;
            alpha = Math.max(0, Math.min(255, alpha));
          }
          
          originalData.data[i + 3] = alpha;
        }
        
        ctx.putImageData(originalData, 0, 0);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      }
    };

    originalImg.src = `data:image/png;base64,${originalBase64}`;
    maskImg.src = `data:image/png;base64,${maskBase64}`;
    
    originalImg.onload = onLoaded;
    maskImg.onload = onLoaded;
    originalImg.onerror = reject;
    maskImg.onerror = reject;
  });
};

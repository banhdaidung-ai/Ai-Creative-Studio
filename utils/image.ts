
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const resizeImage = (file: File, maxSize: number = 2048, mimeType: string = 'image/png', quality: number = 0.9): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(mimeType, quality).split(',')[1]);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
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

      // If already very close, don't pad
      if (Math.abs(currentRatio - targetRatio) < 0.01) {
        resolve({ base64, info });
        return;
      }

      let drawWidth = img.width;
      let drawHeight = img.height;
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
    // Dummy implementation for smoothing
    return Promise.resolve(base64);
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
        
        // Draw mask on a temporary canvas to get its data
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = originalImg.width;
        maskCanvas.height = originalImg.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) { reject("Mask canvas context failed"); return; }
        maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply mask to alpha channel
        for (let i = 0; i < originalData.data.length; i += 4) {
          // Use the brightness of the mask as the alpha value
          // Mask is B&W, so R=G=B. Just use R.
          // We also handle potential inversion or gray values
          const maskValue = maskData.data[i]; 
          originalData.data[i + 3] = maskValue;
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

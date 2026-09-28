import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(title="Google Flow Proxy Backend")

# Cấu hình CORS mở cho các domain web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hoặc giới hạn: ["https://ai.yody.io", "http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    prompt: str
    reference_images: Optional[List[str]] = []
    style: Optional[str] = "Realistic"
    mask: Optional[str] = None

@app.get("/")
@app.get("/health")
def health_check():
    """Endpoint xác thực backend đang sống cho frontend kiểm tra kết nối"""
    return {
        "status": "healthy",
        "service": "Google Flow Backend",
        "mode": "Nano Banana Pro"
    }

@app.post("/api/flow/generate")
async def generate_image(payload: GenerateRequest, request: Request):
    """Xử lý pipeline sinh ảnh từ prompt và reference image"""
    
    # Ưu tiên lấy API key từ header do client truyền lên (nếu người dùng tự nhập trên web)
    client_api_key = request.headers.get("x-api-key")
    
    # Nếu client không truyền, dùng key mặc định cấu hình trên Cloud Run
    api_key = client_api_key or os.getenv("GOOGLE_FLOW_API_KEY") or os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        raise HTTPException(
            status_code=401, 
            detail="Bạn chưa nhập API Key trên ứng dụng và Server cũng chưa cấu hình GOOGLE_FLOW_API_KEY."
        )

    try:
        # TODO: Tích hợp logic sinh ảnh với Google Flow / Gemini API tại đây
        # Trả về kết quả mẫu hoặc luồng ảnh sinh thực tế
        return {
            "success": True,
            "prompt": payload.prompt,
            "style": payload.style,
            "image_url": "https://placehold.co/1024x1024/png?text=Generated+Output",
            "message": "Generated successfully via Google Flow backend"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

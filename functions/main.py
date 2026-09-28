import os
import json
from firebase_functions import https_fn, options
from firebase_admin import initialize_app

initialize_app()

@https_fn.on_request(
    cors=options.CorsOptions(cors_origins="*", cors_methods=["get", "post"])
)
def flow_api(req: https_fn.Request) -> https_fn.Response:
    """Xử lý API cho flow bao gồm health check và generate"""
    
    path = req.path
    
    if path == "/health" or path == "/":
        return https_fn.Response(
            json.dumps({
                "status": "healthy",
                "service": "Firebase Google Flow Backend",
                "mode": "Nano Banana Pro"
            }),
            content_type="application/json"
        )
        
    if path == "/flow/generate" or path == "/generate":
        if req.method != "POST":
            return https_fn.Response("Method not allowed", status=405)
            
        try:
            payload = req.get_json()
            if not payload:
                return https_fn.Response("Invalid JSON", status=400)
                
            client_api_key = req.headers.get("x-api-key")
            api_key = client_api_key or os.getenv("GOOGLE_FLOW_API_KEY") or os.getenv("GEMINI_API_KEY")
            
            if not api_key:
                return https_fn.Response(
                    json.dumps({
                        "success": False,
                        "error": "Bạn chưa nhập API Key trên ứng dụng và Server cũng chưa cấu hình GOOGLE_FLOW_API_KEY."
                    }),
                    status=401,
                    content_type="application/json"
                )
                
            # Trả về mock thành công
            return https_fn.Response(
                json.dumps({
                    "success": True,
                    "prompt": payload.get("prompt", ""),
                    "style": payload.get("style", ""),
                    "image_url": "https://placehold.co/1024x1024/png?text=Generated+Output+Firebase",
                    "message": "Generated successfully via Firebase Flow backend"
                }),
                content_type="application/json"
            )
        except Exception as e:
            return https_fn.Response(json.dumps({"success": False, "error": str(e)}), status=500, content_type="application/json")
            
    return https_fn.Response("Not found", status=404)

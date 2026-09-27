import io
import logging
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("flow_backend.watermark_remover")

# Template hình sao 4 cánh (Astroid) chuẩn xác của Gemini
_ASTROID_TPL = None

def _get_astroid_template() -> np.ndarray:
    global _ASTROID_TPL
    if _ASTROID_TPL is None:
        size = 60
        half = 30
        tpl = np.zeros((size, size), dtype=np.float32)
        Y, X = np.ogrid[:size, :size]
        u = (np.abs((X - half) / 26.5)) ** (2 / 3) + (np.abs((Y - half) / 26.5)) ** (2 / 3)
        tpl[u <= 1.0] = 1.0 - (u[u <= 1.0] ** 1.5)
        max_val = tpl.max()
        if max_val > 0:
            tpl = (tpl / max_val).astype(np.float32)
        _ASTROID_TPL = tpl
    return _ASTROID_TPL


def remove_gemini_watermark(image_bytes: bytes) -> bytes:
    """
    Tự động phát hiện và xóa sạch logo Google Gemini (hình sao 4 cánh) ở góc dưới bên phải.
    Bảo toàn 100% chất lượng ảnh gốc, độ phân giải và màu sắc.
    Nếu không phát hiện thấy watermark (ví dụ ảnh người dùng tải lên), trả về ảnh nguyên vẹn.
    """
    if not image_bytes:
        return image_bytes

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes

        h, w = img.shape[:2]
        # Nếu ảnh quá nhỏ (< 200x200), không thể có watermark tiêu chuẩn
        if h < 200 or w < 200:
            return image_bytes

        # Vùng ROI góc dưới bên phải (220x220)
        roi_size = min(220, h, w)
        roi = img[h - roi_size : h, w - roi_size : w]
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY).astype(np.float32)

        tpl = _get_astroid_template()
        th, tw = tpl.shape

        # Giới hạn vùng tìm kiếm cách mép ngoài để tăng độ chính xác
        sy1 = max(0, roi_size - 180)
        sy2 = max(sy1 + th + 10, roi_size - 15)
        sx1 = max(0, roi_size - 180)
        sx2 = max(sx1 + tw + 10, roi_size - 15)

        search_area = gray_roi[sy1:sy2, sx1:sx2]
        if search_area.shape[0] < th or search_area.shape[1] < tw:
            return image_bytes

        res = cv2.matchTemplate(search_area, tpl, cv2.TM_CCOEFF_NORMED)
        min_v, max_v, min_l, max_l = cv2.minMaxLoc(res)

        # Ngưỡng phát hiện: nếu tương quan < 0.22 thì ảnh không chứa watermark
        if max_v < 0.22:
            return image_bytes

        # Tọa độ tâm watermark trên toàn bức ảnh
        star_cx = (w - roi_size) + sx1 + max_l[0] + (tw // 2)
        star_cy = (h - roi_size) + sy1 + max_l[1] + (th // 2)

        logger.info(
            f"🧹 Phát hiện watermark Gemini tại ({star_cx}, {star_cy}) với độ khớp {max_v:.3f}. Đang tiến hành xóa sạch..."
        )

        # Tạo mask Astroid khít khao đúng biên dạng ngôi sao (bán kính R=28.5)
        mask = np.zeros((h, w), dtype=np.uint8)
        rad = 28.5
        box_pad = 36
        sub_y1 = max(0, star_cy - box_pad)
        sub_y2 = min(h, star_cy + box_pad + 1)
        sub_x1 = max(0, star_cx - box_pad)
        sub_x2 = min(w, star_cx + box_pad + 1)

        sY, sX = np.ogrid[sub_y1:sub_y2, sub_x1:sub_x2]
        dist = (np.abs((sX - star_cx) / rad)) ** (2 / 3) + (np.abs((sY - star_cy) / rad)) ** (2 / 3)
        mask[sub_y1:sub_y2, sub_x1:sub_x2] = np.where(dist <= 1.02, 255, 0).astype(np.uint8)

        # Áp dụng Inpainting Telea với bán kính viền mảnh (radius=2) để bảo tồn tối đa chi tiết xung quanh
        cleaned = cv2.inpaint(img, mask, inpaintRadius=2, flags=cv2.INPAINT_TELEA)

        # Encode lại dạng PNG chất lượng cao nhất
        success, encoded_buf = cv2.imencode(".png", cleaned, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        if success:
            logger.info("✨ Xóa watermark Gemini thành công!")
            return encoded_buf.tobytes()

        return image_bytes
    except Exception as e:
        logger.warning(f"Lỗi khi xử lý xóa watermark Gemini: {e}")
        return image_bytes

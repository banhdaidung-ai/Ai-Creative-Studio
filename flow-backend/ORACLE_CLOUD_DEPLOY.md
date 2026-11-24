# Hướng Dẫn Đưa Google Flow Backend Lên Oracle Cloud Always Free (24/7 Miễn Phí)

Tài liệu này giúp Anh đưa `flow-backend` (Playwright + Chromium) lên máy chủ ảo **Oracle Cloud Always Free** kèm **HTTPS tự động (Caddy + `sslip.io`)** để dùng web https://ai-creative-studio-2026.web.app mọi lúc mọi nơi mà **không cần bật máy Mac**.

---

## Bước 1: Tạo VM Miễn Phí Trên Oracle Cloud Console
1. Đăng nhập **Oracle Cloud Console** → **Compute** → **Instances** → **Create instance**.
2. Chọn cấu hình nằm trong hạn mức **Always Free eligible**:
   - **Image**: `Canonical Ubuntu 24.04 Minimal` (hoặc `22.04`).
   - **Shape**: `Ampere` → `VM.Standard.A1.Flex` → chọn **2 OCPU** và **12 GB RAM** *(rất dễ tạo thành công; không vượt quá tổng 4 OCPU / 24 GB của gói Always Free)*.
   - **Networking**: Đảm bảo tích **Assign a public IPv4 address** (hoặc gắn *Reserved Public IP* để IP không đổi nếu tắt/mở VM).
   - **SSH Keys**: Tải về Private Key (`.key`) hoặc dán Public Key SSH từ máy Mac.
3. Nhấn **Create** và chờ trạng thái chuyển sang **Running** (~1 phút). Copy **Public IP Address** của VM.

---

## Bước 2: Mở Cổng 80 & 443 Trong Oracle VCN Security List
> Đây là bước **bắt buộc** để trình duyệt và Caddy xin chứng chỉ SSL HTTPS miễn phí.

1. Trong trang chi tiết Instance vừa tạo, bấm vào **Subnet** (trong mục *Primary VNIC*).
2. Bấm vào **Default Security List** → **Add Ingress Rules**, thêm 2 rule sau:
   - **Rule 1 (HTTP để Caddy cấp SSL)**:
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port Range: `80`
   - **Rule 2 (HTTPS cho Web truy cập)**:
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port Range: `443`

---

## Bước 3: Cài Đặt Backend Chỉ Với 1 Lệnh Trên VM Oracle
1. Mở Terminal trên Mac và SSH vào VM Oracle:
   ```bash
   chmod 400 ~/Downloads/ssh-key-*.key
   ssh -i ~/Downloads/ssh-key-*.key ubuntu@<PUBLIC_IP>
   ```
2. Kéo mã nguồn và chạy script tự động:
   ```bash
   git clone https://github.com/banhdaidung-ai/Ai-Creative-Studio.git
   cd Ai-Creative-Studio/flow-backend
   ./deploy-oracle.sh
   ```
   *(Nếu muốn dùng tên miền riêng trỏ về IP Oracle thay cho `sslip.io`, chạy `./deploy-oracle.sh --domain flow.tenmiencuaban.com`)*
3. Chờ 3–5 phút để Docker cài đặt xong Playwright Chromium và Caddy cấp SSL. Cuối màn hình sẽ in ra:
   - **Backend HTTPS URL**: ví dụ `https://129-150-xx-xx.sslip.io`
   - **FLOW_ACCESS_TOKEN**: chuỗi bí mật bảo vệ server của riêng Anh.

---

## Bước 4: Đẩy Cookie Google Flow Từ Máy Mac Lên Oracle (10 Giây)
Quay lại Terminal **trên máy Mac** (vẫn trong thư mục `flow-backend/`):

```bash
cd /Users/banhdaidung/Documents/Antigravity/ai-creative-studio/flow-backend
.venv/bin/python sync_session_to_cloud.py --url https://<PUBLIC_IP_GACH_NGANG>.sslip.io --token <FLOW_ACCESS_TOKEN>
```

> Sau 7–14 ngày nếu cookie Google hết hạn hoặc Google hỏi xác minh lại, Anh chỉ cần chạy lại đúng lệnh trên kèm `--relogin` (`--relogin` sẽ mở Chrome trên Mac để đăng nhập lại và tự đẩy cookie mới lên Oracle).

---

## Bước 5: Kết Nối Từ Web Online
1. Tắt hoàn toàn server local trên Mac (nếu muốn kiểm chứng độc lập).
2. Mở https://ai-creative-studio-2026.web.app → bấm vào huy hiệu **PRO / Kết nối** (bên trái dưới) → chọn tab **Google Flow**.
3. Dán **Backend URL** (`https://<ip>.sslip.io`) và **Mã bảo mật (Flow Access Token)** → bấm **Lưu & Kiểm tra kết nối**.
4. Khi thấy trạng thái chuyển xanh **Đã kết nối (Sẵn sàng)**, mọi tính năng tạo ảnh & video Google Flow sẽ chạy 24/7 trên Oracle Cloud ạ!

---

## Lệnh Quản Trị Nhanh Trên VM Oracle (Khi Cần)
- Xem log realtime: `cd ~/Ai-Creative-Studio/flow-backend && sudo docker compose -f docker-compose.oracle.yml logs -f`
- Cập nhật code mới nhất từ GitHub:
  ```bash
  cd ~/Ai-Creative-Studio && git pull origin main
  cd flow-backend && ./deploy-oracle.sh
  ```
- Khởi động lại backend: `sudo docker compose -f docker-compose.oracle.yml restart flow-backend`

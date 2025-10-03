# 🚀 Setup GitHub Self-Hosted Runner - Hướng dẫn đơn giản

## 🎯 Mục tiêu
Khi push code lên GitHub → WSL tự động deploy ứng dụng

## 📋 Chuẩn bị
- WSL đã cài đặt Ubuntu
- Repository GitHub đã có code NestJS

## 🚀 Làm theo 3 bước này

### BƯỚC 1: Cài đặt Runner (5-10 phút)

```bash
# Vào thư mục project
cd /path/to/your/nestjs-project

# Chạy script setup (nó sẽ tự động làm mọi thứ)
bash servers/setup-runner.sh
```

**Script sẽ hỏi bạn:**
1. Repository URL: `https://github.com/username/repo-name`
2. Token: Lấy từ GitHub (hướng dẫn bên dưới)
3. Runner name: `wsl-nestjs-runner` (hoặc tên bạn thích)

**Lấy Token từ GitHub:**
1. Vào repo GitHub → Settings → Actions → Runners
2. Click "New self-hosted runner"
3. Copy token (dạng: `AXXXXXXXXXXXXXXXXXXXXX`)

### BƯỚC 2: Test (2 phút)

```bash
# Kiểm tra runner đã chạy chưa
bash servers/deployment-manager.sh status

# Nếu OK, test deploy bằng cách push code
git add .
git commit -m "Test self-hosted runner"
git push origin main
```

### BƯỚC 3: Xem kết quả

- Vào GitHub → Actions tab → Xem workflow chạy
- Ứng dụng sẽ chạy tại: `http://localhost:3000`

## 🛠️ Quản lý hàng ngày

```bash
# Xem trạng thái tổng quan
bash servers/deployment-manager.sh status

# Xem logs ứng dụng
bash servers/deployment-manager.sh logs

# Restart ứng dụng nếu cần
bash servers/deployment-manager.sh restart

# Nếu có lỗi gì
bash servers/troubleshooting-guide.sh
```

## 🆘 Khi có vấn đề

### Lỗi thường gặp:

**1. Runner không kết nối được:**
```bash
sudo ~/actions-runner/svc.sh restart
```

**2. Ứng dụng không chạy:**
```bash
bash servers/deployment-manager.sh restart
```

**3. Lỗi khác:**
```bash
bash servers/troubleshooting-guide.sh diagnose
```

## 📁 Files quan trọng (chỉ cần biết 3 cái này)

1. **`setup-runner.sh`** - Setup lần đầu (chạy 1 lần)
2. **`deployment-manager.sh`** - Quản lý hàng ngày  
3. **`troubleshooting-guide.sh`** - Sửa lỗi

## ✅ Dấu hiệu thành công

- [ ] GitHub Actions hiển thị runner "wsl-nestjs-runner" 
- [ ] Push code → GitHub Actions chạy tự động
- [ ] Ứng dụng chạy tại http://localhost:3000
- [ ] Command `bash servers/deployment-manager.sh status` hiển thị "✅ Running"

## 🎉 Kết quả

Sau khi setup:
- **Push code** → **Tự động deploy**  
- **Zero downtime** với PM2
- **Monitoring** tự động
- **Backup** tự động trước mỗi lần deploy

---

## 📞 Cần giúp?

**Nhanh nhất:** `bash servers/troubleshooting-guide.sh`

**Chi tiết hơn:** Đọc `servers/README_SELF_HOSTED_RUNNER.md`

**Rất chi tiết:** Đọc `servers/GitHub_Self_Hosted_Runner_WSL_Setup.md`
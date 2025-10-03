# 🚀 GitHub Self-Hosted Runner - Cheat Sheet

## ⚡ Setup nhanh (chỉ làm 1 lần)

```bash
# Chạy lệnh này và làm theo hướng dẫn
bash quick-setup.sh
```

**Cần chuẩn bị:**
- Repository URL: `https://github.com/username/repo`
- GitHub Token: Lấy từ repo Settings → Actions → Runners → New runner

## 🎯 Sau khi setup xong

### Test deployment:
```bash
git add .
git commit -m "Test runner"
git push origin main
```

### Kiểm tra status:
```bash
bash servers/deployment-manager.sh status
```

## 📋 Commands hàng ngày

```bash
# Xem trạng thái tổng quan
bash servers/deployment-manager.sh status

# Quản lý ứng dụng
bash servers/deployment-manager.sh restart   # Restart app
bash servers/deployment-manager.sh logs      # Xem logs
bash servers/deployment-manager.sh health    # Health check

# Quản lý runner
bash servers/deployment-manager.sh runner    # Runner control

# Maintenance
bash servers/deployment-manager.sh cleanup   # Dọn dẹp logs
bash servers/deployment-manager.sh backup    # Backup manual
```

## 🆘 Khi có lỗi

```bash
# Tự động chẩn đoán và sửa
bash servers/troubleshooting-guide.sh

# Hoặc các lệnh nhanh:
bash servers/troubleshooting-guide.sh restart    # Quick restart
bash servers/troubleshooting-guide.sh fix        # Auto fix
bash servers/troubleshooting-guide.sh reset      # Emergency reset
```

## 🔧 Lệnh hệ thống nhanh

```bash
# Check runner
sudo ~/actions-runner/svc.sh status
sudo ~/actions-runner/svc.sh restart

# Check app
pm2 status
pm2 logs nestjs-demo
pm2 restart nestjs-demo

# Health check
curl http://localhost:3000/health
```

## 📁 Files quan trọng

| File | Mục đích |
|------|----------|
| `quick-setup.sh` | Setup ban đầu |
| `servers/deployment-manager.sh` | Quản lý hàng ngày |
| `servers/troubleshooting-guide.sh` | Sửa lỗi |
| `servers/SETUP_SIMPLE.md` | Hướng dẫn chi tiết |

## ✅ Workflow tự động

**Khi push code:**
1. GitHub Actions trigger
2. Code được deploy lên WSL
3. Application restart với PM2
4. Health check tự động
5. Thông báo kết quả

**URLs quan trọng:**
- Application: http://localhost:3000
- Health check: http://localhost:3000/health
- GitHub Actions: `https://github.com/username/repo/actions`

## 🎯 Dấu hiệu thành công

- [ ] `bash servers/deployment-manager.sh status` → tất cả ✅
- [ ] Push code → GitHub Actions chạy tự động
- [ ] `curl http://localhost:3000` → có response
- [ ] `pm2 status` → nestjs-demo online

---

## 📞 Trợ giúp nhanh

**Câu hỏi thường gặp:**

**Q: Runner không connect được?**
```bash
sudo ~/actions-runner/svc.sh restart
```

**Q: App không start?**
```bash
bash servers/deployment-manager.sh restart
```

**Q: GitHub Actions lỗi?**
```bash
bash servers/troubleshooting-guide.sh diagnose
```

**Q: Muốn reset toàn bộ?**
```bash
bash servers/troubleshooting-guide.sh reset
```

---

**🚀 Chỉ cần nhớ 3 commands chính:**
1. `bash quick-setup.sh` - Setup lần đầu
2. `bash servers/deployment-manager.sh` - Quản lý hàng ngày  
3. `bash servers/troubleshooting-guide.sh` - Sửa lỗi
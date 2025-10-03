#!/bin/bash

# GitHub Self-Hosted Runner - Quick Setup
# Chạy script này để setup mọi thứ tự động

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

clear
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    QUICK SETUP                               ║"
echo "║           GitHub Self-Hosted Runner WSL                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}🚀 Chào mừng! Script này sẽ setup tự động GitHub Self-Hosted Runner${NC}"
echo ""
echo "Sau khi setup xong, bạn chỉ cần:"
echo "✅ Push code → GitHub tự động deploy lên WSL"
echo "✅ Ứng dụng chạy tại http://localhost:3000"
echo "✅ Zero-downtime deployment"
echo ""

read -p "Bắt đầu setup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup đã hủy"
    exit 0
fi

echo ""
echo -e "${BLUE}📋 Trước khi bắt đầu, bạn cần:${NC}"
echo "1. Repository URL (VD: https://github.com/username/repo)"
echo "2. GitHub Token (từ repo Settings → Actions → Runners → New runner)"
echo ""
read -p "Đã chuẩn bị sẵn? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}📝 Hướng dẫn lấy Token:${NC}"
    echo "1. Vào GitHub repository"
    echo "2. Settings → Actions → Runners"
    echo "3. Click 'New self-hosted runner'"
    echo "4. Copy token (dạng: AXXXXXXXXXXXXXXXXXXXXX)"
    echo ""
    echo "Chạy lại script này khi đã có token!"
    exit 0
fi

echo ""
echo -e "${GREEN}🚀 Bắt đầu setup...${NC}"

# Step 1: Make scripts executable
echo "🔧 Chuẩn bị scripts..."
chmod +x servers/*.sh

# Step 2: Run main setup
echo "📦 Chạy setup chính..."
if bash servers/setup-runner.sh; then
    echo ""
    echo -e "${GREEN}✅ Setup hoàn tất thành công!${NC}"
    echo ""
    echo -e "${BLUE}🎉 Bây giờ bạn có thể:${NC}"
    echo ""
    echo "📊 Kiểm tra trạng thái:"
    echo "   bash servers/deployment-manager.sh status"
    echo ""
    echo "🚀 Test deployment:"
    echo "   git add ."
    echo "   git commit -m 'Test self-hosted runner'"
    echo "   git push origin main"
    echo ""
    echo "🔍 Xem logs:"
    echo "   bash servers/deployment-manager.sh logs"
    echo ""
    echo "🛠️ Quản lý hàng ngày:"
    echo "   bash servers/deployment-manager.sh"
    echo ""
    echo "🆘 Khi có lỗi:"
    echo "   bash servers/troubleshooting-guide.sh"
    echo ""
    echo -e "${YELLOW}📖 Đọc hướng dẫn chi tiết: servers/SETUP_SIMPLE.md${NC}"
    echo ""
    
    # Quick status check
    echo -e "${BLUE}📊 Kiểm tra trạng thái nhanh:${NC}"
    if command -v pm2 >/dev/null 2>&1; then
        echo "✅ PM2 đã cài đặt"
    fi
    
    if [ -d ~/actions-runner ]; then
        echo "✅ GitHub Runner đã setup"
    fi
    
    if sudo ~/actions-runner/svc.sh status | grep -q "active"; then
        echo "✅ Runner service đang chạy"
    else
        echo "⚠️ Runner service chưa chạy - có thể cần restart"
    fi
    
    echo ""
    echo -e "${GREEN}🎯 Setup thành công! Hãy test bằng cách push code lên GitHub${NC}"
    
else
    echo ""
    echo -e "${RED}❌ Setup gặp lỗi${NC}"
    echo ""
    echo "🆘 Chạy troubleshooting:"
    echo "   bash servers/troubleshooting-guide.sh"
    echo ""
    echo "📖 Hoặc đọc hướng dẫn:"
    echo "   cat servers/SETUP_SIMPLE.md"
fi
# 🚀 GitHub Self-Hosted Runner Setup trên WSL

## Tổng quan
Setup GitHub Actions self-hosted runner trên WSL để:
- Triển khai CI/CD hoàn toàn local
- Không phụ thuộc vào GitHub-hosted runners
- Control hoàn toàn môi trường deployment
- Tiết kiệm chi phí và tăng tốc độ

## Kiến trúc triển khai

```
GitHub Repository
    ↓ (push code)
GitHub Actions Trigger
    ↓
Self-Hosted Runner (WSL)
    ↓
Local Deployment
```

## Phase 1: Chuẩn bị WSL Environment

### 1.1 Setup WSL cơ bản
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip jq

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 1.2 Setup PM2 cho production
```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup
pm2 startup
# Chạy command mà PM2 suggest (với sudo)

# Verify PM2
pm2 list
```

### 1.3 Create deployment directory
```bash
# Create project directory
mkdir -p ~/projects/nestjs-demo
cd ~/projects/nestjs-demo

# Setup permissions
chmod 755 ~/projects
chmod 755 ~/projects/nestjs-demo
```

## Phase 2: Install GitHub Runner

### 2.1 Download GitHub Runner
```bash
# Create runner directory
mkdir -p ~/actions-runner && cd ~/actions-runner

# Download latest runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Verify hash (optional)
echo "29fc8cf2dab4c195bb147384e7e2c94cfd4d4022c793b346a6175435265aa278  actions-runner-linux-x64-2.311.0.tar.gz" | shasum -a 256 -c

# Extract
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
```

### 2.2 Configure Runner
```bash
# Configure runner (cần token từ GitHub)
./config.sh --url https://github.com/YOUR_USERNAME/YOUR_REPO --token YOUR_TOKEN

# Thông tin cần nhập:
# Runner name: wsl-nestjs-runner
# Runner group: Default
# Labels: wsl,nestjs,self-hosted
# Work folder: _work
```

### 2.3 Install Runner as Service
```bash
# Install service
sudo ./svc.sh install

# Start service
sudo ./svc.sh start

# Check status
sudo ./svc.sh status
```

## Phase 3: Create Deployment Scripts

### 3.1 Pre-deployment script
```bash
# Create scripts directory
mkdir -p ~/scripts

# Create pre-deploy script
cat > ~/scripts/pre-deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting pre-deployment tasks..."

# Stop existing application
pm2 stop nestjs-demo || true

# Backup current deployment (optional)
if [ -d ~/projects/nestjs-demo ]; then
    BACKUP_DIR=~/backups/$(date +%Y%m%d_%H%M%S)
    mkdir -p $BACKUP_DIR
    cp -r ~/projects/nestjs-demo $BACKUP_DIR/ || true
    echo "✅ Backup created at $BACKUP_DIR"
fi

echo "✅ Pre-deployment completed"
EOF

chmod +x ~/scripts/pre-deploy.sh
```

### 3.2 Post-deployment script
```bash
cat > ~/scripts/post-deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting post-deployment tasks..."

cd ~/projects/nestjs-demo

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --omit=dev

# Build application
echo "🏗️ Building application..."
npm run build

# Start application with PM2
echo "🔄 Starting application..."
pm2 start dist/main.js --name nestjs-demo --env production

# Save PM2 configuration
pm2 save

# Health check
echo "🏥 Performing health check..."
sleep 5
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "⚠️ Health check failed, but deployment completed"
fi

echo "✅ Post-deployment completed"
EOF

chmod +x ~/scripts/post-deploy.sh
```

### 3.3 Cleanup script
```bash
cat > ~/scripts/cleanup.sh << 'EOF'
#!/bin/bash

echo "🧹 Starting cleanup..."

# Clean old backups (keep last 5)
find ~/backups -maxdepth 1 -type d -name "20*" | sort | head -n -5 | xargs rm -rf

# Clean npm cache
npm cache clean --force

# Clean PM2 logs
pm2 flush

echo "✅ Cleanup completed"
EOF

chmod +x ~/scripts/cleanup.sh
```

## Phase 4: Create GitHub Workflow

### 4.1 Workflow cho self-hosted runner
```yaml
name: CI/CD Pipeline - Self Hosted

on:
  push:
    branches: [main, beta]
  pull_request:
    branches: [main, beta]
  workflow_dispatch:

env:
  NODE_VERSION: '20'

jobs:
  # Test job (runs on GitHub-hosted for faster feedback)
  test:
    name: 🧪 Run Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 🟢 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: 📦 Install dependencies
        run: npm ci

      - name: 🧪 Run tests
        run: npm test

      - name: 🔍 Run linting
        run: npm run lint

  # Build and Deploy (runs on self-hosted)
  deploy:
    name: 🚀 Build & Deploy
    runs-on: [self-hosted, wsl, nestjs]
    needs: [test]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/beta'
    
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4
        with:
          clean: true

      - name: 🔍 Environment Info
        run: |
          echo "🖥️ Runner: $(hostname)"
          echo "📁 Working Directory: $(pwd)"
          echo "🟢 Node Version: $(node --version)"
          echo "📦 NPM Version: $(npm --version)"
          echo "🔄 PM2 Status:"
          pm2 list || true

      - name: 🚀 Pre-deployment
        run: ~/scripts/pre-deploy.sh

      - name: 📁 Sync files
        run: |
          echo "📁 Syncing files to deployment directory..."
          rsync -av --delete \
            --exclude='.git' \
            --exclude='node_modules' \
            --exclude='.github' \
            --exclude='*.md' \
            ./ ~/projects/nestjs-demo/

      - name: 🏗️ Build & Deploy
        run: ~/scripts/post-deploy.sh

      - name: 🧹 Cleanup
        run: ~/scripts/cleanup.sh

      - name: 🏥 Final Health Check
        run: |
          echo "🏥 Final health check..."
          sleep 10
          
          for i in {1..5}; do
            if curl -s -f http://localhost:3000/health; then
              echo "✅ Application is healthy!"
              exit 0
            fi
            echo "⏳ Attempt $i failed, retrying in 10s..."
            sleep 10
          done
          
          echo "❌ Health check failed"
          exit 1

      - name: 📊 Deployment Summary
        if: always()
        run: |
          echo "📊 Deployment Summary:"
          echo "🔗 Commit: ${{ github.sha }}"
          echo "👤 Author: ${{ github.actor }}"
          echo "🌿 Branch: ${{ github.ref_name }}"
          echo "🕐 Time: $(date)"
          echo "🚀 Application URL: http://localhost:3000"
          
          echo "📋 PM2 Status:"
          pm2 list
          
          echo "📝 Recent logs:"
          pm2 logs nestjs-demo --lines 10 --nostream || true
```

## Phase 5: Setup Environment Files

### 5.1 Environment configuration
```bash
# Create environment files
cat > ~/projects/nestjs-demo/.env.production << 'EOF'
NODE_ENV=production
PORT=3000
# Add your production environment variables here
EOF

# Set proper permissions
chmod 600 ~/projects/nestjs-demo/.env.production
```

### 5.2 PM2 ecosystem file
```bash
cat > ~/projects/nestjs-demo/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'nestjs-demo',
    script: 'dist/main.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '200M',
    error_file: '~/logs/nestjs-demo-error.log',
    out_file: '~/logs/nestjs-demo-out.log',
    log_file: '~/logs/nestjs-demo.log',
    time: true,
    autorestart: true,
    watch: false
  }]
}
EOF
```

## Phase 6: Monitoring & Maintenance

### 6.1 Setup log rotation
```bash
# Create log directory
mkdir -p ~/logs

# Setup logrotate
sudo tee /etc/logrotate.d/nestjs-demo << 'EOF'
/home/*/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
}
EOF
```

### 6.2 Monitoring script
```bash
cat > ~/scripts/monitor.sh << 'EOF'
#!/bin/bash

echo "📊 System Monitoring Report"
echo "=========================="

# System resources
echo "💻 System Resources:"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "Disk Usage: $(df -h / | awk 'NR==2{printf "%s", $5}')"

# Application status
echo ""
echo "🚀 Application Status:"
pm2 show nestjs-demo || echo "Application not running"

# Recent errors
echo ""
echo "❌ Recent Errors (last 10):"
pm2 logs nestjs-demo --err --lines 10 --nostream || echo "No recent errors"

# Network status
echo ""
echo "🌐 Network Status:"
if curl -s -f http://localhost:3000/health > /dev/null; then
    echo "✅ Application is responding"
else
    echo "❌ Application is not responding"
fi
EOF

chmod +x ~/scripts/monitor.sh
```

## Phase 7: Troubleshooting

### 7.1 Common Issues

**Runner not connecting:**
```bash
# Check runner service
sudo ./svc.sh status

# Check logs
tail -f ~/actions-runner/_diag/Runner_*.log
```

**Application not starting:**
```bash
# Check PM2 status
pm2 status
pm2 logs nestjs-demo

# Manual start
cd ~/projects/nestjs-demo
npm run build
pm2 start ecosystem.config.js --env production
```

**Permission issues:**
```bash
# Fix file permissions
chmod -R 755 ~/projects/nestjs-demo
chown -R $USER:$USER ~/projects/nestjs-demo
```

### 7.2 Useful commands
```bash
# Runner management
sudo ./svc.sh stop    # Stop runner
sudo ./svc.sh start   # Start runner
sudo ./svc.sh status  # Check status

# Application management
pm2 restart nestjs-demo  # Restart app
pm2 stop nestjs-demo     # Stop app
pm2 delete nestjs-demo   # Delete app
pm2 monit               # Monitor

# Logs
pm2 logs nestjs-demo    # View logs
pm2 flush              # Clear logs
tail -f ~/actions-runner/_diag/Runner_*.log  # Runner logs
```

## Testing

1. **Push code to trigger workflow**
2. **Monitor GitHub Actions tab**
3. **Check application health**: `curl http://localhost:3000/health`
4. **View PM2 status**: `pm2 list`

## Security Considerations

- Runner chạy với user permissions (không dùng root)
- Environment variables được protect
- Logs được rotate để tránh đầy disk
- Application chạy trong isolated directory
- Regular backup được thực hiện

---

**🎯 Kết quả: Hệ thống CI/CD hoàn toàn tự động, chạy local trên WSL với full control!**
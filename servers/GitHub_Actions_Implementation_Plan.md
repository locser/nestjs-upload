# 🚀 GitHub Actions CI/CD Implementation Plan
## Deploy NestJS to WSL when push to `beta` branch

### 📋 Overview
**Mục tiêu:** Tạo CI/CD pipeline tự động deploy NestJS application lên WSL khi push code lên nhánh `beta`

**Flow:** Developer push → GitHub Actions → Build & Test → Deploy to WSL → Health Check

---

## 🎯 Phase 1: Chuẩn bị môi trường (15 phút)

### **Step 1.1: Chuẩn bị WSL Environment**
```bash
# Trên WSL - cài đặt các dependencies cần thiết
sudo apt update && sudo apt upgrade -y

# Cài Node.js 20 (nếu chưa có)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Cài PM2 để manage application
sudo npm install -g pm2

# Cài SSH server (nếu chưa có)
sudo apt install openssh-server
sudo service ssh start
sudo systemctl enable ssh

# Tạo thư mục project
mkdir -p ~/projects/nestjs-demo
cd ~/projects/nestjs-demo

# Tạo SSH key cho GitHub (nếu chưa có)
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub  # Copy key này add vào GitHub
```

### **Step 1.2: Setup GitHub Repository**
```bash
# Clone repo về WSL để test
git clone your-repo-url ~/projects/nestjs-demo
cd ~/projects/nestjs-demo

# Tạo nhánh beta
git checkout -b beta
git push -u origin beta
```

### **Step 1.3: Chuẩn bị Port Forwarding (đã có)**
```powershell
# Trên Windows PowerShell (Admin) - bạn đã làm rồi
# Kiểm tra lại port forwarding
netsh interface portproxy show all

# Nếu cần update WSL IP mới
$WSL_IP = wsl hostname -I | ForEach-Object {$_.Trim()}
netsh interface portproxy delete v4tov4 listenport=2222
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=$WSL_IP
```

---

## 🔧 Phase 2: Tạo GitHub Actions Workflows (20 phút)

### **Step 2.1: Tạo CI Workflow**
```bash
# Tạo thư mục workflows
mkdir -p .github/workflows
```

**File: `.github/workflows/ci-beta.yml`**
```yaml
name: CI/CD Pipeline for Beta

on:
  push:
    branches: [ beta ]
  pull_request:
    branches: [ beta ]

env:
  NODE_VERSION: '20'

jobs:
  # Job 1: Testing
  test:
    name: 🧪 Run Tests
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - name: 📥 Checkout code
      uses: actions/checkout@v4
    
    - name: 🟢 Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: 📦 Install dependencies
      run: |
        npm ci
        echo "✅ Dependencies installed"
    
    - name: 🔍 Run linting
      run: |
        npm run lint
        echo "✅ Linting passed"
    
    - name: 🧪 Run unit tests
      run: |
        npm run test
        echo "✅ Unit tests passed"
    
    - name: 🔗 Run e2e tests
      run: |
        npm run test:e2e
        echo "✅ E2E tests passed"
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

  # Job 2: Build
  build:
    name: 🏗️ Build Application
    runs-on: ubuntu-latest
    needs: test
    
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
    
    - name: 🏗️ Build application
      run: |
        npm run build
        echo "✅ Build completed"
    
    - name: 📤 Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: dist-files
        path: |
          dist/
          package*.json
          node_modules/
        retention-days: 1

  # Job 3: Deploy to WSL
  deploy:
    name: 🚀 Deploy to WSL
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.ref == 'refs/heads/beta' && github.event_name == 'push'
    
    steps:
    - name: 📥 Checkout code
      uses: actions/checkout@v4
    
    - name: 📤 Download build artifacts
      uses: actions/download-artifact@v3
      with:
        name: dist-files
    
    - name: 🔐 Setup SSH
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.WSL_SSH_PRIVATE_KEY }}" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
        ssh-keyscan -H ${{ secrets.WSL_HOST }} >> ~/.ssh/known_hosts
        echo "✅ SSH configured"
    
    - name: 🚀 Deploy to WSL
      run: |
        echo "🚀 Starting deployment to WSL..."
        
        # Sync files to WSL
        rsync -avz --delete \
          -e "ssh -p ${{ secrets.WSL_PORT }}" \
          ./ ${{ secrets.WSL_USER }}@${{ secrets.WSL_HOST }}:~/projects/nestjs-demo/
        
        # Run deployment commands on WSL
        ssh -p ${{ secrets.WSL_PORT }} ${{ secrets.WSL_USER }}@${{ secrets.WSL_HOST }} << 'EOF'
          cd ~/projects/nestjs-demo
          
          echo "📦 Installing production dependencies..."
          npm ci --omit=dev
          
          echo "🏗️ Building application..."
          npm run build
          
          echo "🔄 Restarting application with PM2..."
          pm2 stop nestjs-demo || true
          pm2 start dist/main.js --name nestjs-demo
          pm2 save
          
          echo "✅ Deployment completed!"
        EOF
    
    - name: 🏥 Health Check
      run: |
        echo "⏳ Waiting for application to start..."
        sleep 15
        
        echo "🏥 Performing health check..."
        for i in {1..5}; do
          if curl -s -f "http://${{ secrets.WSL_HOST }}:3000/health" >/dev/null; then
            echo "✅ Health check passed!"
            exit 0
          fi
          echo "⏳ Attempt $i failed, retrying in 10s..."
          sleep 10
        done
        
        echo "❌ Health check failed after 5 attempts"
        exit 1
    
    - name: 🔔 Notify Success
      if: success()
      run: |
        echo "🎉 Deployment to WSL Beta Environment Successful!"
        echo "🌐 Application URL: http://${{ secrets.WSL_HOST }}:3000"
        echo "📝 Commit: ${{ github.sha }}"
        echo "👤 Author: ${{ github.actor }}"
```

---

## 🔐 Phase 3: Setup GitHub Secrets (10 phút)

### **Step 3.1: Tạo SSH Key cho GitHub Actions**
```bash
# Trên WSL - tạo dedicated SSH key cho GitHub Actions
ssh-keygen -t ed25519 -f ~/.ssh/github_actions_key -N ""

# Copy private key (sẽ paste vào GitHub Secrets)
cat ~/.ssh/github_actions_key

# Copy public key để add vào authorized_keys
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### **Step 3.2: Configure GitHub Repository Secrets**
**Đi tới:** GitHub Repository → Settings → Secrets and variables → Actions

**Tạo các secrets sau:**

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `WSL_SSH_PRIVATE_KEY` | Content của `~/.ssh/github_actions_key` | Private SSH key |
| `WSL_HOST` | IP của Windows machine (192.168.x.x) | Windows IP trong mạng |
| `WSL_PORT` | `2222` | Port forwarding port |
| `WSL_USER` | Username WSL của bạn | WSL username |

### **Step 3.3: Test SSH Connection**
```bash
# Test từ máy khác (hoặc GitHub Actions runner sẽ test)
ssh -i ~/.ssh/github_actions_key -p 2222 WSL_USER@WSL_HOST "echo 'SSH connection successful!'"
```

---

## 🏗️ Phase 4: Chuẩn bị NestJS Application (15 phút)

### **Step 4.1: Add Health Check Endpoint**
```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  checkHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };
  }
}
```

```typescript
// src/app.module.ts - Add HealthController
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
// ... other imports

@Module({
  controllers: [HealthController, /* other controllers */],
  // ... rest of module
})
export class AppModule {}
```

### **Step 4.2: Update package.json scripts**
```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

### **Step 4.3: Create PM2 Ecosystem File**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'nestjs-demo',
    script: './dist/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_beta: {
      NODE_ENV: 'beta',
      PORT: 3000
    }
  }]
};
```

---

## 🧪 Phase 5: Testing & Implementation (30 phút)

### **Step 5.1: Create Test Implementation Script**
```bash
# File: scripts/test-deployment.sh
#!/bin/bash

echo "🧪 Testing CI/CD Implementation..."

# Test 1: Check if required files exist
echo "📋 Checking required files..."
files=(
  ".github/workflows/ci-beta.yml"
  "src/health/health.controller.ts"
  "ecosystem.config.js"
  "package.json"
)

for file in "${files[@]}"; do
  if [[ -f "$file" ]]; then
    echo "✅ $file exists"
  else
    echo "❌ $file missing"
    exit 1
  fi
done

# Test 2: Validate package.json scripts
echo "🔍 Validating package.json scripts..."
required_scripts=("build" "test" "test:e2e" "lint")
for script in "${required_scripts[@]}"; do
  if npm run | grep -q "$script"; then
    echo "✅ Script '$script' exists"
  else
    echo "❌ Script '$script' missing"
  fi
done

# Test 3: Test health endpoint locally
echo "🏥 Testing health endpoint..."
npm run start:dev &
PID=$!
sleep 10

if curl -s -f "http://localhost:3000/health" >/dev/null; then
  echo "✅ Health endpoint working"
else
  echo "❌ Health endpoint failed"
fi

kill $PID
echo "🎉 Local tests completed!"
```

### **Step 5.2: Step-by-Step Execution Checklist**

#### **✅ Checklist trước khi bắt đầu:**
- [ ] WSL đã cài đặt và chạy
- [ ] Port forwarding 2222→22 đã setup
- [ ] SSH server running trên WSL
- [ ] Node.js 20 đã cài trên WSL
- [ ] PM2 đã cài globally
- [ ] GitHub repository đã tạo
- [ ] Git đã setup trên WSL

#### **✅ Implementation Steps:**

**Step 1: Chuẩn bị project structure**
```bash
# Trên WSL
cd ~/projects/nestjs-demo

# Copy source code hiện tại vào đây
cp -r /path/to/your/nestjs/source/* .

# Tạo health controller
mkdir -p src/health
# Copy code từ plan vào src/health/health.controller.ts

# Tạo workflow file
mkdir -p .github/workflows
# Copy ci-beta.yml từ plan

# Tạo ecosystem.config.js
# Copy code từ plan

# Test locally
npm install
npm run build
npm run test
```

**Step 2: Setup SSH keys**
```bash
# Tạo SSH key cho GitHub Actions
ssh-keygen -t ed25519 -f ~/.ssh/github_actions_key -N ""

# Add public key vào authorized_keys
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Test SSH connection
ssh -i ~/.ssh/github_actions_key -p 2222 $(whoami)@localhost "echo 'SSH test successful!'"
```

**Step 3: Configure GitHub Secrets**
```bash
# Get values for GitHub Secrets
echo "WSL_SSH_PRIVATE_KEY:"
cat ~/.ssh/github_actions_key

echo -e "\nWSL_HOST: $(ip route | grep default | awk '{print $3}' | head -1)"
echo "WSL_PORT: 2222"
echo "WSL_USER: $(whoami)"
```

**Step 4: Push to beta branch và test**
```bash
# Add files và commit
git add .
git commit -m "feat: add CI/CD pipeline for beta deployment"

# Push to beta branch để trigger workflow
git push origin beta
```

---

## 🔧 Phase 6: Monitoring & Verification (10 phút)

### **Step 6.1: Monitor GitHub Actions**
1. Đi tới GitHub Repository → Actions tab
2. Watch workflow "CI/CD Pipeline for Beta" running
3. Check từng step có pass không

### **Step 6.2: Verify Deployment**
```bash
# Check application trên WSL
ssh -p 2222 WSL_USER@WSL_HOST << 'EOF'
  # Check PM2 status
  pm2 list
  
  # Check application logs
  pm2 logs nestjs-demo --lines 20
  
  # Test health endpoint
  curl -s http://localhost:3000/health | jq
EOF
```

### **Step 6.3: Test từ external**
```bash
# Từ macOS hoặc máy khác trong mạng
curl -s http://WSL_HOST:3000/health | jq

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2024-...",
#   "uptime": 123.45,
#   "environment": "beta",
#   "version": "1.0.0"
# }
```

---

## 🎯 Success Criteria

### **✅ Deployment thành công khi:**
1. GitHub Actions workflow hoàn thành tất cả steps (green checkmarks)
2. Health check endpoint return status 200
3. PM2 show application đang running
4. Có thể access từ mạng: `http://WSL_HOST:3000/health`
5. Logs không có errors

### **🔍 Troubleshooting Commands:**
```bash
# Check GitHub Actions logs
# → GitHub Repository → Actions → Click on failed workflow

# Check WSL application
ssh -p 2222 WSL_USER@WSL_HOST
pm2 logs nestjs-demo
pm2 restart nestjs-demo

# Check port forwarding
netsh interface portproxy show all

# Check SSH connection
ssh -p 2222 WSL_USER@WSL_HOST "echo 'Connection test'"
```

---

## 📈 Next Steps (Optional)

### **Phase 7: Enhancements**
1. **Add database integration** với PostgreSQL
2. **Environment variables** management
3. **Blue-Green deployment** strategy
4. **Monitoring với Prometheus/Grafana**
5. **Notifications** (Slack/Discord/Email)
6. **Auto-rollback** on health check failure

### **Phase 8: Production Ready**
1. **Security hardening**
2. **Load testing**
3. **Backup strategies**
4. **SSL certificates**
5. **Domain setup**

---

**🚀 Total Time Estimate: ~1.5 hours**
**🎯 Result: Fully automated CI/CD pipeline từ GitHub → WSL**
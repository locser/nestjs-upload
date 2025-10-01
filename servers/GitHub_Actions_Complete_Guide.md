# 🚀 GitHub Actions Complete Guide - Từ Cơ Bản Đến Nâng Cao

## 📋 Mục lục
1. [GitHub Actions là gì?](#github-actions-là-gì)
2. [Cấu trúc cơ bản](#cấu-trúc-cơ-bản)
3. [Workflows thực tế](#workflows-thực-tế)
4. [Best Practices](#best-practices)
5. [Troubleshooting](#troubleshooting)

---

## GitHub Actions là gì?

**GitHub Actions** là dịch vụ CI/CD tích hợp sẵn trong GitHub, cho phép bạn:
- ✅ **Tự động hóa workflows** (build, test, deploy)
- ✅ **Phản ứng với events** (push, pull request, issues)
- ✅ **Chạy trên multiple platforms** (Ubuntu, Windows, macOS)
- ✅ **Sử dụng marketplace** với hàng nghìn actions có sẵn

### **Các khái niệm cốt lõi:**

```yaml
# Workflow: File YAML định nghĩa automation
# Job: Tập hợp các steps chạy trên cùng runner
# Step: Một task đơn lẻ (chạy command hoặc action)
# Action: Đơn vị tái sử dụng của code
# Runner: Server chạy workflow (GitHub-hosted hoặc self-hosted)
```

### **Workflow cơ bản nhất:**
```yaml
# .github/workflows/hello-world.yml
name: Hello World

on: [push]

jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - name: Say hello
        run: echo "Hello, World!"
```

---

## Cấu trúc cơ bản

### **1. Triggers (Events)**
```yaml
# Trigger khi push code
on: push

# Trigger khi tạo pull request
on: pull_request

# Trigger theo schedule (cron)
on:
  schedule:
    - cron: '0 2 * * *'  # Chạy lúc 2h sáng hàng ngày

# Trigger thủ công
on: workflow_dispatch

# Trigger kết hợp
on:
  push:
    branches: [ main, develop ]
    paths:
      - 'src/**'
      - 'package.json'
  pull_request:
    branches: [ main ]
```

### **2. Jobs và Steps**
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    # Checkout code từ repository
    - name: Checkout code
      uses: actions/checkout@v4
    
    # Setup Node.js
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    # Install dependencies
    - name: Install dependencies
      run: npm ci
    
    # Run tests
    - name: Run tests
      run: npm test
```

### **3. Environment Variables & Secrets**
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    
    env:
      NODE_ENV: production
      API_URL: https://api.example.com
    
    steps:
    - name: Deploy to server
      run: |
        echo "Deploying to $API_URL"
        echo "Environment: $NODE_ENV"
      env:
        # Sử dụng secrets cho thông tin nhạy cảm
        API_KEY: ${{ secrets.API_KEY }}
        DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

---

## Workflows thực tế cho NestJS Project

### **4. CI Workflow cho NestJS**
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    # Services cho testing
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
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run unit tests
      run: npm run test
    
    - name: Run e2e tests
      run: npm run test:e2e
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
    
    - name: Generate test coverage
      run: npm run test:cov
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Build Docker image
      run: |
        docker build -t nestjs-app:${{ github.sha }} .
        docker tag nestjs-app:${{ github.sha }} nestjs-app:latest
    
    - name: Save Docker image
      run: docker save nestjs-app:latest | gzip > nestjs-app.tar.gz
    
    - name: Upload build artifact
      uses: actions/upload-artifact@v3
      with:
        name: docker-image
        path: nestjs-app.tar.gz
```

### **5. CD Workflow với Docker**
```yaml
# .github/workflows/cd.yml
name: CD Pipeline

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Download build artifact
      uses: actions/download-artifact@v3
      with:
        name: docker-image
    
    - name: Load Docker image
      run: |
        gunzip -c nestjs-app.tar.gz | docker load
    
    - name: Deploy to staging
      if: github.ref == 'refs/heads/develop'
      run: |
        echo "🚀 Deploying to staging environment..."
        # Add your staging deployment commands here
    
    - name: Deploy to production
      if: github.ref == 'refs/heads/main'
      run: |
        echo "🚀 Deploying to production environment..."
        # Add your production deployment commands here
    
    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: |
          Deployment completed!
          Environment: ${{ github.ref == 'refs/heads/main' && 'Production' || 'Staging' }}
          Commit: ${{ github.sha }}
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### **6. WSL Deployment Workflow**
```yaml
# .github/workflows/deploy-to-wsl.yml
name: Deploy to WSL

on:
  push:
    branches: [ main ]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  deploy-to-wsl:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup SSH
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.WSL_SSH_KEY }}" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
        ssh-keyscan -H ${{ secrets.WSL_HOST }} >> ~/.ssh/known_hosts
    
    - name: Deploy to WSL
      run: |
        # Sync code to WSL
        rsync -avz --delete \
          -e "ssh -p ${{ secrets.WSL_PORT }}" \
          ./ ${{ secrets.WSL_USER }}@${{ secrets.WSL_HOST }}:~/projects/nestjs-app/
        
        # Run deployment commands on WSL
        ssh -p ${{ secrets.WSL_PORT }} ${{ secrets.WSL_USER }}@${{ secrets.WSL_HOST }} << 'EOF'
          cd ~/projects/nestjs-app
          npm ci --production
          npm run build
          pm2 restart nestjs-app || pm2 start dist/main.js --name nestjs-app
          pm2 save
        EOF
    
    - name: Health check
      run: |
        # Wait for application to start
        sleep 10
        
        # Check if application is running
        response=$(curl -s -o /dev/null -w "%{http_code}" http://${{ secrets.WSL_HOST }}:3000/health)
        if [ $response = "200" ]; then
          echo "✅ Deployment successful! Application is healthy."
        else
          echo "❌ Deployment failed! Health check returned: $response"
          exit 1
        fi
```

---

## Best Practices

### **1. Security Best Practices**
```yaml
# ✅ Sử dụng secrets cho thông tin nhạy cảm
env:
  API_KEY: ${{ secrets.API_KEY }}
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}

# ✅ Pin versions của actions
- uses: actions/checkout@v4  # ✅ Good
- uses: actions/checkout@main # ❌ Avoid

# ✅ Giới hạn permissions
permissions:
  contents: read
  pull-requests: write

# ✅ Validate inputs cho workflow_dispatch
workflow_dispatch:
  inputs:
    environment:
      required: true
      type: choice
      options: [staging, production]
```

### **2. Performance Optimization**
```yaml
# ✅ Caching dependencies
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Cache npm dependencies

# ✅ Parallel jobs
jobs:
  test:
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        os: [ubuntu-latest, windows-latest]

# ✅ Conditional steps
- name: Deploy to production
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  run: npm run deploy:prod
```

### **3. Error Handling**
```yaml
# ✅ Continue on error khi cần thiết
- name: Run tests
  run: npm test
  continue-on-error: true

# ✅ Timeout cho jobs dài
jobs:
  test:
    timeout-minutes: 30
    
# ✅ Retry cho network operations
- name: Deploy with retry
  uses: nick-fields/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: npm run deploy
```

### **4. Monitoring & Notifications**
```yaml
# Slack notifications
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: "Build failed! Check logs: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

# Email notifications
- name: Send email on deployment
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: "Deployment Completed"
    body: "Application deployed successfully!"
    to: team@company.com
```

---

## Workflows nâng cao

### **7. Matrix Testing**
```yaml
# Test trên multiple environments
name: Matrix Testing

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [16.x, 18.x, 20.x]
        include:
          - os: ubuntu-latest
            node-version: 20.x
            coverage: true
        exclude:
          - os: windows-latest
            node-version: 16.x

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Run tests
      run: npm test
    
    - name: Generate coverage
      if: matrix.coverage
      run: npm run test:coverage
```

### **8. Reusable Workflows**
```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      node-version:
        required: false
        type: string
        default: '20'
    secrets:
      deploy-token:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
    
    - name: Deploy
      run: echo "Deploying to ${{ inputs.environment }}"
      env:
        DEPLOY_TOKEN: ${{ secrets.deploy-token }}
```

```yaml
# .github/workflows/main.yml - Sử dụng reusable workflow
name: Main Pipeline

on: [push]

jobs:
  deploy-staging:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      node-version: '18'
    secrets:
      deploy-token: ${{ secrets.STAGING_TOKEN }}
  
  deploy-production:
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
    secrets:
      deploy-token: ${{ secrets.PRODUCTION_TOKEN }}
```

---

## Troubleshooting

### **Các lỗi thường gặp:**

#### **1. Node modules caching issues**
```yaml
# ❌ Lỗi: Cache không được update
- name: Install dependencies
  run: npm install

# ✅ Fix: Xóa cache khi cần
- name: Clear npm cache
  run: npm cache clean --force
  
- name: Install dependencies
  run: npm ci  # Sử dụng npm ci thay vì npm install
```

#### **2. Permission denied lỗi**
```yaml
# ❌ Lỗi: Permission denied khi chạy scripts
- name: Run script
  run: ./deploy.sh

# ✅ Fix: Cấp quyền thực thi
- name: Make script executable
  run: chmod +x ./deploy.sh
  
- name: Run script
  run: ./deploy.sh
```

#### **3. Environment variables không hoạt động**
```yaml
# ❌ Lỗi: Env vars không được set
env:
  DATABASE_URL: ${{ secrets.DB_URL }}
steps:
  - run: echo $DATABASE_URL  # Có thể rỗng

# ✅ Fix: Check secrets và syntax
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}  # Đúng tên secret
steps:
  - name: Debug environment
    run: |
      echo "DATABASE_URL is set: ${DATABASE_URL:+yes}"
      # Không echo giá trị secret trực tiếp!
```

#### **4. Docker build failures**
```yaml
# ❌ Lỗi: Docker build thất bại
- name: Build Docker image
  run: docker build -t app .

# ✅ Fix: Multi-stage builds và error handling
- name: Build Docker image
  run: |
    docker build \
      --build-arg NODE_ENV=production \
      --tag app:${{ github.sha }} \
      --tag app:latest \
      .
    
    # Verify image was built
    docker images app:latest
```

### **Debug techniques:**
```yaml
# 1. Enable debug logging
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true

# 2. List environment variables
- name: Debug environment
  run: |
    echo "=== Environment Variables ==="
    env | sort
    echo "=== GitHub Context ==="
    echo "Repository: ${{ github.repository }}"
    echo "Branch: ${{ github.ref }}"
    echo "SHA: ${{ github.sha }}"

# 3. Check filesystem
- name: Debug filesystem
  run: |
    echo "=== Current Directory ==="
    pwd
    echo "=== Directory Contents ==="
    ls -la
    echo "=== Disk Usage ==="
    df -h
```

---

## Tài liệu tham khảo và Next Steps

### **📚 Learning Resources:**
1. **Official Documentation:** https://docs.github.com/actions
2. **GitHub Actions Marketplace:** https://github.com/marketplace/actions
3. **Awesome Actions:** https://github.com/sdras/awesome-actions

### **🛠️ Tools hữu ích:**
- **act:** Test workflows locally - https://github.com/nektos/act
- **GitHub CLI:** Manage workflows từ command line
- **VS Code Extension:** GitHub Actions syntax highlighting

### **🎯 Next Steps cho bạn:**
1. **Tạo basic CI workflow** cho project hiện tại
2. **Setup secrets** trong repository settings  
3. **Implement deployment** to WSL environment
4. **Add monitoring** với notifications
5. **Explore advanced patterns** như matrix builds

### **💡 Pro Tips:**
- Luôn test workflows trên branch trước khi merge
- Sử dụng `workflow_dispatch` cho manual testing
- Monitor usage limits (2000 phút/tháng cho free accounts)
- Cache dependencies để giảm build time
- Sử dụng environments cho production deployments

---

**🚀 Bây giờ bạn đã sẵn sàng implement GitHub Actions cho project của mình!**
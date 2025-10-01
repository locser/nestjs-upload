# 🎯 GitHub Actions Advanced Case Studies & Knowledge Base

## 📋 Mục lục
1. [Real-World Case Studies](#real-world-case-studies)
2. [Advanced Patterns & Architectures](#advanced-patterns--architectures)
3. [Performance Optimization](#performance-optimization)
4. [Security Best Practices](#security-best-practices)
5. [Monitoring & Observability](#monitoring--observability)
6. [Troubleshooting Scenarios](#troubleshooting-scenarios)
7. [Industry Standards](#industry-standards)

---

## Real-World Case Studies

### 🏢 Case Study 1: E-commerce Platform (ShopBack-style)
**Scenario:** Multi-service NestJS application với microservices architecture

#### **Business Requirements:**
- 50+ developers, 10+ services
- Deploy 20-30 times/day
- Zero-downtime deployments
- A/B testing capabilities
- Real-time monitoring

#### **Solution Architecture:**
```yaml
# .github/workflows/microservices-deploy.yml
name: Microservices CI/CD

on:
  push:
    branches: [main, staging, feature/*]
    paths:
      - 'services/**'
      - 'shared/**'

env:
  REGISTRY: ghcr.io
  NODE_VERSION: '20'

jobs:
  detect-changes:
    name: 🔍 Detect Changed Services
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.changes.outputs.services }}
      matrix: ${{ steps.changes.outputs.matrix }}
    
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Detect changed services
      id: changes
      run: |
        # Script to detect which services changed
        CHANGED_SERVICES=$(git diff --name-only HEAD~1 HEAD | grep '^services/' | cut -d'/' -f2 | sort | uniq)
        
        if [ -z "$CHANGED_SERVICES" ]; then
          echo "services=[]" >> $GITHUB_OUTPUT
          echo "matrix={\"include\":[]}" >> $GITHUB_OUTPUT
        else
          SERVICES_JSON=$(echo "$CHANGED_SERVICES" | jq -R -s -c 'split("\n")[:-1]')
          MATRIX_JSON=$(echo "$CHANGED_SERVICES" | jq -R -s -c 'split("\n")[:-1] | map({service: .})')
          echo "services=$SERVICES_JSON" >> $GITHUB_OUTPUT
          echo "matrix={\"include\":$MATRIX_JSON}" >> $GITHUB_OUTPUT
        fi

  test-services:
    name: 🧪 Test Services
    runs-on: ubuntu-latest
    needs: detect-changes
    if: ${{ needs.detect-changes.outputs.services != '[]' }}
    
    strategy:
      matrix: ${{ fromJSON(needs.detect-changes.outputs.matrix) }}
      fail-fast: false
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
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

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
        cache-dependency-path: services/${{ matrix.service }}/package-lock.json
    
    - name: Install dependencies
      working-directory: services/${{ matrix.service }}
      run: npm ci
    
    - name: Run tests
      working-directory: services/${{ matrix.service }}
      run: |
        npm run test
        npm run test:e2e
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/${{ matrix.service }}_test
        REDIS_URL: redis://localhost:6379
    
    - name: Build service
      working-directory: services/${{ matrix.service }}
      run: npm run build
    
    - name: Build Docker image
      run: |
        docker build -f services/${{ matrix.service }}/Dockerfile \
          -t ${{ env.REGISTRY }}/${{ github.repository }}/${{ matrix.service }}:${{ github.sha }} \
          services/${{ matrix.service }}

  integration-tests:
    name: 🔗 Integration Tests
    runs-on: ubuntu-latest
    needs: [detect-changes, test-services]
    if: ${{ needs.detect-changes.outputs.services != '[]' }}
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup test environment
      run: |
        # Setup docker-compose with all services
        docker-compose -f docker-compose.test.yml up -d
        
        # Wait for services to be ready
        timeout 300 bash -c 'until docker-compose -f docker-compose.test.yml ps | grep healthy; do sleep 5; done'
    
    - name: Run integration tests
      run: |
        # Run comprehensive integration tests
        npm run test:integration
        
        # Run API contract tests
        npm run test:contracts
        
        # Run performance baseline tests
        npm run test:performance
    
    - name: Cleanup
      if: always()
      run: docker-compose -f docker-compose.test.yml down -v

  deploy-staging:
    name: 🚀 Deploy to Staging
    runs-on: ubuntu-latest
    needs: [detect-changes, test-services, integration-tests]
    if: github.ref == 'refs/heads/staging' && needs.detect-changes.outputs.services != '[]'
    environment: staging
    
    strategy:
      matrix: ${{ fromJSON(needs.detect-changes.outputs.matrix) }}
    
    steps:
    - name: Deploy to Kubernetes
      run: |
        # Blue-Green deployment strategy
        kubectl apply -f k8s/staging/${{ matrix.service }}/
        kubectl rollout status deployment/${{ matrix.service }}-blue -n staging
        
        # Health check new deployment
        kubectl exec -n staging deployment/${{ matrix.service }}-blue -- curl -f http://localhost:3000/health
        
        # Switch traffic to blue deployment
        kubectl patch service ${{ matrix.service }} -n staging -p '{"spec":{"selector":{"version":"blue"}}}'
        
        # Wait and verify
        sleep 30
        kubectl delete deployment ${{ matrix.service }}-green -n staging || true

  deploy-production:
    name: 🏭 Deploy to Production
    runs-on: ubuntu-latest
    needs: [detect-changes, test-services, integration-tests]
    if: github.ref == 'refs/heads/main' && needs.detect-changes.outputs.services != '[]'
    environment: production
    
    strategy:
      matrix: ${{ fromJSON(needs.detect-changes.outputs.matrix) }}
    
    steps:
    - name: Deploy with Canary Strategy
      run: |
        # Deploy canary version (10% traffic)
        kubectl apply -f k8s/production/${{ matrix.service }}/canary/
        
        # Monitor metrics for 10 minutes
        timeout 600 bash -c 'while true; do
          ERROR_RATE=$(kubectl exec -n monitoring deployment/prometheus -- \
            promtool query instant "rate(http_requests_total{service=\"${{ matrix.service }}\",code=~\"5..\"}[5m])")
          
          if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            echo "High error rate detected: $ERROR_RATE"
            exit 1
          fi
          
          sleep 60
        done'
        
        # If metrics are good, proceed with full deployment
        kubectl apply -f k8s/production/${{ matrix.service }}/
        kubectl rollout status deployment/${{ matrix.service }} -n production
```

#### **Key Learnings:**
1. **Service Detection:** Automated detection của changed services
2. **Matrix Strategy:** Parallel testing của multiple services
3. **Integration Testing:** Comprehensive testing strategy
4. **Deployment Strategies:** Blue-Green và Canary deployments
5. **Monitoring Integration:** Real-time metrics monitoring

---

### 🏦 Case Study 2: Fintech Application (Banking-grade Security)
**Scenario:** High-security financial application với strict compliance requirements

#### **Business Requirements:**
- SOC 2 Type II compliance
- PCI DSS requirements
- Zero security vulnerabilities
- Audit trails cho mọi deployments
- Multi-environment promotion (dev → test → prod)

#### **Solution Architecture:**
```yaml
# .github/workflows/fintech-secure-deploy.yml
name: Secure Fintech Deployment

on:
  push:
    branches: [main, staging, develop]
  pull_request:
    branches: [main, staging]

permissions:
  contents: read
  security-events: write
  id-token: write  # For OIDC authentication

env:
  NODE_VERSION: '20'
  AUDIT_WEBHOOK: ${{ secrets.AUDIT_WEBHOOK_URL }}

jobs:
  security-scan:
    name: 🔒 Security Scanning
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci --audit
    
    - name: Dependency vulnerability scan
      run: |
        # Scan for known vulnerabilities
        npm audit --audit-level=moderate
        
        # Advanced scanning with Snyk
        npx snyk test --severity-threshold=medium
        npx snyk code test
    
    - name: Static code analysis
      uses: github/super-linter@v4
      env:
        DEFAULT_BRANCH: main
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        VALIDATE_TYPESCRIPT_ES: true
        VALIDATE_DOCKERFILE: true
        VALIDATE_YAML: true
    
    - name: SAST with CodeQL
      uses: github/codeql-action/init@v2
      with:
        languages: javascript
    
    - name: Build for analysis
      run: npm run build
    
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v2
    
    - name: Container security scan
      run: |
        docker build -t app:security-scan .
        
        # Scan with Trivy
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
          aquasec/trivy image --severity HIGH,CRITICAL app:security-scan
        
        # Scan with Grype
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
          anchore/grype app:security-scan
    
    - name: License compliance check
      run: |
        npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-3-Clause;ISC;BSD-2-Clause'
    
    - name: Audit trail
      run: |
        curl -X POST ${{ env.AUDIT_WEBHOOK }} \
          -H "Content-Type: application/json" \
          -d '{
            "event": "security_scan_completed",
            "repository": "${{ github.repository }}",
            "commit": "${{ github.sha }}",
            "actor": "${{ github.actor }}",
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "scan_results": "passed"
          }'

  compliance-tests:
    name: 📋 Compliance Testing
    runs-on: ubuntu-latest
    needs: security-scan
    
    steps:
    - uses: actions/checkout@v4
    
    - name: PCI DSS Compliance Check
      run: |
        # Check for PCI DSS requirements
        echo "Checking PCI DSS compliance..."
        
        # No hardcoded secrets
        if grep -r "password\|secret\|key" --include="*.ts" --include="*.js" src/; then
          echo "❌ Potential hardcoded secrets found"
          exit 1
        fi
        
        # Encryption at rest validation
        if ! grep -q "encryption.*aes" src/config/*.ts; then
          echo "❌ AES encryption not configured"
          exit 1
        fi
        
        echo "✅ PCI DSS checks passed"
    
    - name: SOC 2 Controls Validation
      run: |
        # Access control tests
        npm run test:access-control
        
        # Data retention policy tests
        npm run test:data-retention
        
        # Logging and monitoring tests
        npm run test:audit-logging
    
    - name: GDPR Compliance Check
      run: |
        # Data processing consent tests
        npm run test:gdpr-consent
        
        # Right to be forgotten tests
        npm run test:data-deletion
        
        # Data export functionality tests
        npm run test:data-export

  secure-build:
    name: 🏗️ Secure Build
    runs-on: ubuntu-latest
    needs: [security-scan, compliance-tests]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials with OIDC
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
        role-session-name: GitHubActions-SecureBuild
        aws-region: us-east-1
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci --production
    
    - name: Build with security hardening
      run: |
        # Build with security flags
        NODE_ENV=production npm run build
        
        # Remove dev dependencies and unnecessary files
        npm prune --production
        rm -rf .git tests docs *.md
    
    - name: Create signed container
      run: |
        # Build container
        docker build -t fintech-app:${{ github.sha }} .
        
        # Sign with cosign
        echo "${{ secrets.COSIGN_PRIVATE_KEY }}" | cosign sign --key - fintech-app:${{ github.sha }}
        
        # Push to secure registry
        docker tag fintech-app:${{ github.sha }} ${{ secrets.ECR_REGISTRY }}/fintech-app:${{ github.sha }}
        docker push ${{ secrets.ECR_REGISTRY }}/fintech-app:${{ github.sha }}
    
    - name: Generate SBOM
      run: |
        # Software Bill of Materials
        syft fintech-app:${{ github.sha }} -o spdx-json > sbom.json
        
        # Upload SBOM to artifact registry
        aws s3 cp sbom.json s3://${{ secrets.SBOM_BUCKET }}/fintech-app/${{ github.sha }}/sbom.json

  production-deploy:
    name: 🏭 Production Deployment
    runs-on: ubuntu-latest
    needs: secure-build
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - name: Multi-factor authentication
      run: |
        # Require additional approval for production
        echo "Production deployment requires security team approval"
        echo "Deployment initiated by: ${{ github.actor }}"
        echo "Commit: ${{ github.sha }}"
    
    - name: Deploy with zero-downtime
      run: |
        # Blue-Green deployment với health checks
        kubectl apply -f k8s/production/blue-deployment.yml
        
        # Wait for deployment to be ready
        kubectl rollout status deployment/fintech-app-blue
        
        # Comprehensive health checks
        for i in {1..10}; do
          if kubectl exec deployment/fintech-app-blue -- curl -f http://localhost:3000/health; then
            echo "Health check $i passed"
          else
            echo "Health check $i failed"
            exit 1
          fi
          sleep 30
        done
        
        # Switch traffic
        kubectl patch service fintech-app -p '{"spec":{"selector":{"version":"blue"}}}'
        
        # Remove old deployment
        kubectl delete deployment fintech-app-green || true
    
    - name: Post-deployment verification
      run: |
        # Security verification
        kubectl exec deployment/fintech-app-blue -- npm run security:verify
        
        # Performance baseline
        kubectl exec deployment/fintech-app-blue -- npm run perf:baseline
        
        # Compliance verification
        kubectl exec deployment/fintech-app-blue -- npm run compliance:verify
    
    - name: Audit trail
      if: always()
      run: |
        STATUS=${{ job.status }}
        curl -X POST ${{ env.AUDIT_WEBHOOK }} \
          -H "Content-Type: application/json" \
          -d '{
            "event": "production_deployment",
            "repository": "${{ github.repository }}",
            "commit": "${{ github.sha }}",
            "actor": "${{ github.actor }}",
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "status": "'$STATUS'",
            "environment": "production"
          }'
```

#### **Key Security Features:**
1. **Multi-layer Security Scanning:** SAST, DAST, dependency scanning
2. **Compliance Automation:** PCI DSS, SOC 2, GDPR checks
3. **Container Signing:** Cosign for container authenticity
4. **SBOM Generation:** Software Bill of Materials tracking
5. **Audit Trails:** Complete deployment history
6. **OIDC Authentication:** Keyless authentication với AWS

---

### 🎮 Case Study 3: Gaming Platform (High Traffic & Real-time)
**Scenario:** Real-time gaming platform với millions of concurrent users

#### **Business Requirements:**
- Deploy to multiple regions globally
- A/B testing cho game features
- Real-time monitoring và auto-scaling
- Feature flags management
- Load testing before production

#### **Solution Architecture:**
```yaml
# .github/workflows/gaming-platform-deploy.yml
name: Gaming Platform Global Deploy

on:
  push:
    branches: [main, feature/*, hotfix/*]
    paths:
      - 'game-api/**'
      - 'matchmaking/**'
      - 'leaderboard/**'

env:
  NODE_VERSION: '20'
  REGIONS: '["us-east-1", "eu-west-1", "ap-southeast-1"]'

jobs:
  feature-flag-check:
    name: 🎛️ Feature Flag Validation
    runs-on: ubuntu-latest
    outputs:
      deploy_regions: ${{ steps.feature-flags.outputs.regions }}
      feature_enabled: ${{ steps.feature-flags.outputs.enabled }}
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Check feature flags
      id: feature-flags
      run: |
        # Check with feature flag service (LaunchDarkly/Split.io)
        FEATURE_STATUS=$(curl -s -H "Authorization: Bearer ${{ secrets.LAUNCHDARKLY_TOKEN }}" \
          "https://app.launchdarkly.com/api/v2/flags/default/global-deployment/on")
        
        if [[ "$FEATURE_STATUS" == "true" ]]; then
          echo "enabled=true" >> $GITHUB_OUTPUT
          echo "regions=${{ env.REGIONS }}" >> $GITHUB_OUTPUT
        else
          echo "enabled=false" >> $GITHUB_OUTPUT
          echo "regions=[\"us-east-1\"]" >> $GITHUB_OUTPUT
        fi

  load-testing:
    name: 🚀 Load Testing
    runs-on: ubuntu-latest
    needs: feature-flag-check
    
    strategy:
      matrix:
        scenario: [baseline, spike, stress, volume]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup load testing environment
      run: |
        # Setup K6 load testing
        sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    
    - name: Run ${{ matrix.scenario }} test
      run: |
        # Run different load test scenarios
        case "${{ matrix.scenario }}" in
          baseline)
            k6 run --vus 100 --duration 5m tests/load/baseline.js
            ;;
          spike)
            k6 run --vus 1000 --duration 2m tests/load/spike.js
            ;;
          stress)
            k6 run --vus 500 --duration 10m tests/load/stress.js
            ;;
          volume)
            k6 run --vus 200 --duration 30m tests/load/volume.js
            ;;
        esac
      env:
        TARGET_URL: ${{ secrets.STAGING_URL }}
        API_KEY: ${{ secrets.LOAD_TEST_API_KEY }}
    
    - name: Analyze results
      run: |
        # Check performance thresholds
        if k6 run --quiet tests/load/thresholds.js | grep -q "FAIL"; then
          echo "❌ Performance thresholds not met"
          exit 1
        fi
        echo "✅ Performance tests passed"

  ab-testing-setup:
    name: 🧪 A/B Testing Setup
    runs-on: ubuntu-latest
    
    steps:
    - name: Configure A/B test splits
      run: |
        # Configure splits trong feature flag service
        curl -X PATCH \
          -H "Authorization: Bearer ${{ secrets.LAUNCHDARKLY_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d '{
            "variations": [
              {"value": "control", "weight": 90},
              {"value": "treatment", "weight": 10}
            ]
          }' \
          "https://app.launchdarkly.com/api/v2/flags/default/new-matchmaking-algorithm"

  global-deploy:
    name: 🌍 Global Deployment
    runs-on: ubuntu-latest
    needs: [feature-flag-check, load-testing, ab-testing-setup]
    if: needs.feature-flag-check.outputs.feature_enabled == 'true'
    
    strategy:
      matrix:
        region: ${{ fromJSON(needs.feature-flag-check.outputs.deploy_regions) }}
      max-parallel: 1  # Deploy one region at a time
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to ${{ matrix.region }}
      run: |
        echo "🚀 Deploying to ${{ matrix.region }}"
        
        # Configure AWS for specific region
        aws configure set region ${{ matrix.region }}
        
        # Deploy with regional configuration
        kubectl apply -f k8s/gaming-platform/${{ matrix.region }}/
        
        # Wait for deployment
        kubectl rollout status deployment/game-api -n gaming --timeout=300s
        kubectl rollout status deployment/matchmaking -n gaming --timeout=300s
        kubectl rollout status deployment/leaderboard -n gaming --timeout=300s
    
    - name: Regional health check
      run: |
        # Comprehensive health checks cho gaming services
        REGION_ENDPOINT="https://api-${{ matrix.region }}.gaming-platform.com"
        
        # Game API health
        curl -f "$REGION_ENDPOINT/game/health"
        
        # Matchmaking service health  
        curl -f "$REGION_ENDPOINT/matchmaking/health"
        
        # Leaderboard service health
        curl -f "$REGION_ENDPOINT/leaderboard/health"
        
        # WebSocket connection test
        node tests/websocket-test.js "$REGION_ENDPOINT"
    
    - name: Performance validation
      run: |
        # Quick performance validation
        k6 run --vus 50 --duration 2m tests/regional-perf.js
      env:
        TARGET_REGION: ${{ matrix.region }}
    
    - name: Gradual traffic increase
      run: |
        # Gradually increase traffic to new deployment
        for percentage in 10 25 50 75 100; do
          echo "Increasing traffic to ${percentage}%"
          
          # Update load balancer weights
          aws elbv2 modify-target-group \
            --target-group-arn ${{ secrets.TARGET_GROUP_ARN }} \
            --health-check-path /health \
            --health-check-interval-seconds 10
          
          # Wait and monitor
          sleep 300
          
          # Check error rates
          ERROR_RATE=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/ApplicationELB \
            --metric-name HTTPCode_Target_5XX_Count \
            --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
            --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
            --period 300 \
            --statistics Sum \
            --query 'Datapoints[0].Sum' \
            --output text)
          
          if [[ "$ERROR_RATE" != "None" ]] && (( $(echo "$ERROR_RATE > 10" | bc -l) )); then
            echo "❌ High error rate detected: $ERROR_RATE"
            # Rollback
            kubectl rollout undo deployment/game-api -n gaming
            exit 1
          fi
        done

  post-deploy-monitoring:
    name: 📊 Post-Deploy Monitoring
    runs-on: ubuntu-latest
    needs: global-deploy
    if: always()
    
    steps:
    - name: Setup monitoring alerts
      run: |
        # Create CloudWatch alarms
        aws cloudwatch put-metric-alarm \
          --alarm-name "GameAPI-HighLatency" \
          --alarm-description "Game API high latency" \
          --metric-name ResponseTime \
          --namespace Gaming/API \
          --statistic Average \
          --period 300 \
          --threshold 100 \
          --comparison-operator GreaterThanThreshold \
          --evaluation-periods 2
    
    - name: Monitor A/B test metrics
      run: |
        # Track A/B test metrics
        node scripts/track-ab-metrics.js \
          --test-name "new-matchmaking-algorithm" \
          --duration "24h" \
          --metrics "conversion_rate,user_engagement,revenue_per_user"
```

#### **Gaming-Specific Features:**
1. **Feature Flag Integration:** Dynamic deployment control
2. **Multi-region Deployment:** Global scaling strategy
3. **Load Testing:** Comprehensive performance validation
4. **A/B Testing:** Built-in experimentation framework
5. **Real-time Monitoring:** Gaming-specific metrics tracking
6. **Gradual Rollout:** Traffic-based deployment strategy

---

## Advanced Patterns & Architectures

### 🔄 Pattern 1: GitOps với ArgoCD Integration
**Use Case:** Declarative deployment với Git-based operations

```yaml
# .github/workflows/gitops-deploy.yml
name: GitOps Deployment

on:
  push:
    branches: [main]
    paths: ['src/**', 'k8s/**']

jobs:
  update-manifests:
    name: 📝 Update K8s Manifests
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
      with:
        token: ${{ secrets.GITOPS_TOKEN }}
    
    - name: Update image tags
      run: |
        # Update image tags in Kubernetes manifests
        NEW_TAG="${{ github.sha }}"
        
        # Use yq to update image tags
        yq eval ".spec.template.spec.containers[0].image = \"myapp:${NEW_TAG}\"" -i k8s/deployment.yml
        yq eval ".spec.template.metadata.labels.version = \"${NEW_TAG}\"" -i k8s/deployment.yml
    
    - name: Commit and push changes
      run: |
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        
        git add k8s/
        git commit -m "chore: update image tag to ${{ github.sha }}"
        git push origin main
    
    - name: Trigger ArgoCD sync
      run: |
        # Trigger ArgoCD to sync changes
        curl -X POST \
          -H "Authorization: Bearer ${{ secrets.ARGOCD_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d '{"revision": "${{ github.sha }}"}' \
          "${{ secrets.ARGOCD_SERVER }}/api/v1/applications/myapp/sync"
```

### 🔧 Pattern 2: Multi-Environment Pipeline với Promotion
**Use Case:** Controlled promotion từ dev → staging → production

```yaml
# .github/workflows/multi-env-promotion.yml
name: Multi-Environment Promotion

on:
  push:
    branches: [develop, staging, main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  determine-environment:
    name: 🎯 Determine Target Environment
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.env.outputs.environment }}
      promote_to: ${{ steps.env.outputs.promote_to }}
    
    steps:
    - name: Determine environment
      id: env
      run: |
        case "${{ github.ref }}" in
          refs/heads/develop)
            echo "environment=development" >> $GITHUB_OUTPUT
            echo "promote_to=staging" >> $GITHUB_OUTPUT
            ;;
          refs/heads/staging)
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "promote_to=production" >> $GITHUB_OUTPUT
            ;;
          refs/heads/main)
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "promote_to=none" >> $GITHUB_OUTPUT
            ;;
        esac

  deploy:
    name: 🚀 Deploy to ${{ needs.determine-environment.outputs.environment }}
    runs-on: ubuntu-latest
    needs: [determine-environment]
    environment: ${{ needs.determine-environment.outputs.environment }}
    
    steps:
    - name: Deploy to environment
      run: |
        ENV="${{ needs.determine-environment.outputs.environment }}"
        echo "Deploying to $ENV environment"
        
        # Environment-specific deployment logic
        case "$ENV" in
          development)
            kubectl apply -f k8s/dev/ -n dev
            ;;
          staging)
            kubectl apply -f k8s/staging/ -n staging
            ;;
          production)
            kubectl apply -f k8s/prod/ -n production
            ;;
        esac
```

---

## Performance Optimization

### ⚡ Optimization 1: Build Cache Strategies
**Impact:** Giảm build time từ 10 phút xuống 2 phút

```yaml
# .github/workflows/optimized-build.yml
name: Optimized Build Pipeline

on: [push, pull_request]

jobs:
  build:
    name: 🚀 Optimized Build
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    # Multi-layer caching strategy
    - name: Setup Node.js with cache
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    # Cache Docker layers
    - name: Setup Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Cache Docker layers
      uses: actions/cache@v3
      with:
        path: /tmp/.buildx-cache
        key: ${{ runner.os }}-buildx-${{ github.sha }}
        restore-keys: |
          ${{ runner.os }}-buildx-
    
    # Optimized Docker build
    - name: Build Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: false
        tags: myapp:${{ github.sha }}
        cache-from: type=local,src=/tmp/.buildx-cache
        cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max
```

---

## Security Best Practices

### 🔐 Security Pattern 1: Zero-Trust CI/CD
**Use Case:** Enterprise-grade security với minimal permissions

```yaml
# .github/workflows/zero-trust-pipeline.yml
name: Zero-Trust Security Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Minimal permissions principle
permissions:
  contents: read
  security-events: write
  id-token: write

env:
  COSIGN_EXPERIMENTAL: 1

jobs:
  security-scan:
    name: 🛡️ Comprehensive Security Scan
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Secret scanning
      run: |
        # Multiple tools for secret detection
        docker run --rm -v "$(pwd):/repo" trufflesecurity/trufflehog:latest git file:///repo --only-verified
        
        # Additional scanning with GitLeaks
        docker run --rm -v "$(pwd):/repo" zricethezav/gitleaks:latest detect --source="/repo" --verbose
    
    - name: SAST scanning
      uses: github/codeql-action/init@v2
      with:
        languages: javascript
        queries: security-and-quality
    
    - name: Dependency vulnerability scan
      run: |
        # Multiple vulnerability databases
        npm audit --audit-level=moderate
        
        # Snyk scanning
        npx snyk test --severity-threshold=medium
        
        # OSV-Scanner
        npx @google/osv-scanner --lockfile=package-lock.json
    
    - name: Container scanning
      run: |
        docker build -t security-scan:latest .
        
        # Trivy comprehensive scan
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
          aquasec/trivy image --severity HIGH,CRITICAL --format sarif security-scan:latest > trivy-results.sarif
        
        # Grype scanning
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
          anchore/grype security-scan:latest --fail-on high
    
    - name: Upload SARIF results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: trivy-results.sarif

  supply-chain-security:
    name: 🔗 Supply Chain Security
    runs-on: ubuntu-latest
    needs: security-scan
    
    steps:
    - uses: actions/checkout@v4
    
    - name: SLSA Provenance
      uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.4.0
      with:
        base64-subjects: "${{ needs.build.outputs.digests }}"
    
    - name: Generate SBOM
      run: |
        # Software Bill of Materials
        npm install -g @cyclonedx/cdxgen
        cdxgen -t js -o sbom.json .
        
        # Syft for container SBOM
        docker run --rm -v "$(pwd):/src" anchore/syft /src -o spdx-json=container-sbom.json
    
    - name: Sign artifacts
      run: |
        # Install cosign
        curl -LO https://github.com/sigstore/cosign/releases/download/v2.0.0/cosign-linux-amd64
        chmod +x cosign-linux-amd64 && sudo mv cosign-linux-amd64 /usr/local/bin/cosign
        
        # Sign container with keyless signing
        cosign sign --yes security-scan:latest
        
        # Sign SBOM
        cosign sign-blob --yes sbom.json > sbom.json.sig

  compliance-validation:
    name: 📋 Compliance Validation
    runs-on: ubuntu-latest
    
    steps:
    - name: NIST Cybersecurity Framework
      run: |
        echo "Validating NIST CSF controls..."
        
        # ID.AM - Asset Management
        if ! grep -q "asset-inventory" docs/security/; then
          echo "❌ Asset inventory documentation missing"
          exit 1
        fi
        
        # PR.AC - Access Control
        if ! grep -q "principle.*least.*privilege" src/auth/; then
          echo "❌ Least privilege principle not implemented"
          exit 1
        fi
    
    - name: SOX Compliance
      run: |
        echo "Validating SOX controls..."
        
        # Change management controls
        if [[ "${{ github.event_name }}" == "push" ]] && [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
          if [[ -z "${{ github.event.head_commit.author.email }}" ]]; then
            echo "❌ Commit author not identified"
            exit 1
          fi
        fi
        
        # Segregation of duties
        APPROVERS=$(gh pr view ${{ github.event.pull_request.number }} --json reviews --jq '.reviews[].author.login')
        if [[ "$APPROVERS" == "${{ github.actor }}" ]]; then
          echo "❌ Self-approval detected"
          exit 1
        fi
```

### 🔐 Security Pattern 2: Runtime Security Monitoring

```yaml
# .github/workflows/runtime-security.yml
name: Runtime Security Monitoring

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  runtime-vulnerability-scan:
    name: 🕵️ Runtime Vulnerability Assessment
    runs-on: ubuntu-latest
    
    steps:
    - name: Scan running containers
      run: |
        # Get list of running containers in production
        RUNNING_IMAGES=$(kubectl get pods -n production -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\n' | sort -u)
        
        # Scan each running image
        for image in $RUNNING_IMAGES; do
          echo "Scanning $image..."
          
          # Trivy scan for running images
          docker run --rm aquasec/trivy image --severity HIGH,CRITICAL "$image"
          
          # Check for runtime threats
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            falcosecurity/falco:latest --validate /etc/falco/falco_rules.yaml
        done
    
    - name: Network security assessment
      run: |
        # Network policy validation
        kubectl get networkpolicies -n production
        
        # Service mesh security check
        istioctl analyze -n production
        
        # Certificate expiry check
        kubectl get certificates -n production -o json | jq -r '.items[] | select(.status.renewalTime < (now + 86400*30))'
    
    - name: Compliance drift detection
      run: |
        # OPA Gatekeeper policy violations
        kubectl get constraintviolations -A
        
        # Falco security events
        kubectl logs -n falco-system -l app=falco --since=6h | grep "Priority:Warning\|Priority:Error"

  incident-response:
    name: 🚨 Security Incident Response
    runs-on: ubuntu-latest
    if: failure()
    
    steps:
    - name: Create security incident
      run: |
        # Create Jira security incident
        curl -X POST \
          -H "Authorization: Bearer ${{ secrets.JIRA_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d '{
            "fields": {
              "project": {"key": "SEC"},
              "summary": "Security vulnerability detected in production",
              "description": "Runtime security scan detected issues. See GitHub Actions run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
              "issuetype": {"name": "Security Incident"},
              "priority": {"name": "High"}
            }
          }' \
          "${{ secrets.JIRA_URL }}/rest/api/2/issue/"
    
    - name: Notify security team
      run: |
        # Slack notification
        curl -X POST \
          -H "Content-Type: application/json" \
          -d '{
            "channel": "#security-alerts",
            "text": "🚨 Security Alert: Vulnerabilities detected in production environment",
            "attachments": [{
              "color": "danger",
              "fields": [
                {"title": "Repository", "value": "${{ github.repository }}", "short": true},
                {"title": "Run ID", "value": "${{ github.run_id }}", "short": true}
              ]
            }]
          }' \
          ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Industry Standards & Best Practices

### 📊 Metrics & KPIs cho CI/CD

#### **DORA Metrics Implementation:**
```yaml
# .github/workflows/dora-metrics.yml
name: DORA Metrics Collection

on:
  push:
    branches: [main]
  deployment:
    environments: [production]

jobs:
  collect-metrics:
    name: 📊 Collect DORA Metrics
    runs-on: ubuntu-latest
    
    steps:
    - name: Deployment Frequency
      run: |
        # Track deployments per day/week
        curl -X POST \
          -H "Content-Type: application/json" \
          -d '{
            "metric": "deployment_frequency",
            "value": 1,
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "repository": "${{ github.repository }}",
            "environment": "production"
          }' \
          ${{ secrets.METRICS_ENDPOINT }}/dora/deployment-frequency
    
    - name: Lead Time for Changes
      run: |
        # Calculate time from commit to production
        COMMIT_TIME=$(git log -1 --format=%ct ${{ github.sha }})
        DEPLOY_TIME=$(date +%s)
        LEAD_TIME=$((DEPLOY_TIME - COMMIT_TIME))
        
        curl -X POST \
          -H "Content-Type: application/json" \
          -d '{
            "metric": "lead_time_for_changes",
            "value": '$LEAD_TIME',
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "commit": "${{ github.sha }}"
          }' \
          ${{ secrets.METRICS_ENDPOINT }}/dora/lead-time
    
    - name: Mean Time to Recovery
      if: github.event_name == 'deployment' && github.event.deployment_status.state == 'success'
      run: |
        # Track recovery time from incidents
        INCIDENT_START=$(curl -s "${{ secrets.METRICS_ENDPOINT }}/incidents/latest/start-time")
        RECOVERY_TIME=$(date +%s)
        MTTR=$((RECOVERY_TIME - INCIDENT_START))
        
        curl -X POST \
          -H "Content-Type: application/json" \
          -d '{
            "metric": "mean_time_to_recovery",
            "value": '$MTTR',
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
          }' \
          ${{ secrets.METRICS_ENDPOINT }}/dora/mttr
```

### 🏆 DevOps Excellence Framework

#### **Maturity Assessment:**
1. **Level 1 - Basic:** Manual deployments, basic CI
2. **Level 2 - Repeatable:** Automated testing, basic CD
3. **Level 3 - Defined:** GitOps, security scanning
4. **Level 4 - Managed:** Advanced monitoring, auto-rollback
5. **Level 5 - Optimizing:** ML-driven deployments, self-healing

#### **Implementation Roadmap:**
```markdown
## Phase 1: Foundation (Weeks 1-4)
- [ ] Basic CI/CD pipeline
- [ ] Automated testing
- [ ] Container deployment
- [ ] Basic monitoring

## Phase 2: Security & Compliance (Weeks 5-8)
- [ ] Security scanning integration
- [ ] Compliance automation
- [ ] Secret management
- [ ] Audit trails

## Phase 3: Advanced Patterns (Weeks 9-12)
- [ ] GitOps implementation
- [ ] Multi-environment promotion
- [ ] Feature flags
- [ ] A/B testing framework

## Phase 4: Intelligence & Optimization (Weeks 13-16)
- [ ] ML-driven deployment decisions
- [ ] Predictive scaling
- [ ] Automated incident response
- [ ] Performance optimization
```

---

## 🎓 Knowledge Enhancement Recommendations

### **📚 Essential Learning Resources:**

#### **Books:**
1. **"Continuous Delivery"** - Jez Humble & Dave Farley
2. **"The DevOps Handbook"** - Gene Kim, Patrick Debois
3. **"Accelerate"** - Nicole Forsgren, Jez Humble, Gene Kim
4. **"Site Reliability Engineering"** - Google SRE Team

#### **Certifications:**
1. **AWS DevOps Engineer Professional**
2. **Google Cloud DevOps Engineer**
3. **Kubernetes CKA/CKAD**
4. **HashiCorp Terraform Associate**

#### **Hands-on Labs:**
1. **KillerCoda:** Kubernetes & DevOps scenarios
2. **Katacoda:** CI/CD learning paths
3. **A Cloud Guru:** AWS/Azure DevOps labs
4. **GitHub Learning Lab:** Actions tutorials

### **🔧 Tools Mastery:**
- **GitHub Actions** (Advanced workflows)
- **Terraform/Pulumi** (Infrastructure as Code)
- **Helm/Kustomize** (Kubernetes packaging)
- **ArgoCD/Flux** (GitOps)
- **Prometheus/Grafana** (Monitoring)
- **Istio/Linkerd** (Service Mesh)

---

**🚀 Bây giờ bạn đã có comprehensive knowledge base về GitHub Actions và CI/CD patterns! Ready để implement trong real-world projects!**
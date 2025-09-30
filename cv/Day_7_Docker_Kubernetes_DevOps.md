# 🚢 DAY 7: DOCKER, KUBERNETES & DEVOPS PIPELINE

> **Today's Reality Check:** "It works on my machine" is the most expensive phrase in software development. Time to learn how companies like Google, Netflix, and Spotify deploy code 1000+ times per day without breaking production.

---

## 🤔 WHY CONTAINERIZATION CHANGED EVERYTHING

### **The Traditional Deployment Hell**

Remember the days when deploying software was a nightmare?

**The Old Way:**
- Developer: "It works on my machine!" 
- QA: "Doesn't work on staging..."
- DevOps: "Production is completely broken!"
- Customer: "Your app is down!"

**Common Problems:**
- **Environment Drift:** Prod has Java 8, staging has Java 11, dev has Java 17
- **Dependency Hell:** App needs Python 3.8, but server has 3.6
- **Configuration Chaos:** Different environment variables on each server
- **Scaling Nightmare:** Need to manually setup new servers for traffic spikes
- **Deployment Fear:** Every deployment might break something

### **How Docker Solved the Problem**

Docker containers package your application with **everything** it needs:
- Application code
- Runtime environment (Java, Python, Node.js)
- System libraries
- Dependencies
- Configuration files

**The Docker Promise:** "If it works in a container on your laptop, it will work exactly the same in production."

### **Real-World Container Impact**

**Netflix:**
- Deploys 4,000+ times per day using containers
- Auto-scales from 50,000 to 200,000 containers during peak hours
- Reduces deployment time from hours to minutes

**Spotify:**
- Runs 300+ microservices in containers
- Handles 400+ million active users
- Deploys new features multiple times per day

**Uber:**
- Manages 4,000+ microservices with Kubernetes
- Processes 15+ million trips per day
- Auto-scales based on real-time demand

---

## 🎯 TODAY'S MISSION: FROM MANUAL DEPLOYMENT TO AUTOMATION MASTERY

**Morning Focus:** Docker Fundamentals & Best Practices  
**Afternoon Focus:** Kubernetes Orchestration & Scaling  
**Evening Challenge:** Complete CI/CD Pipeline with Monitoring

---

## 🐳 MORNING SESSION: DOCKER MASTERY

### **Container vs Virtual Machine: The Fundamental Difference**

**Virtual Machines:**
- Each VM runs a complete operating system
- Heavy resource usage (GBs of RAM per VM)
- Slow startup time (minutes)
- Strong isolation but expensive

**Containers:**
- Share the host OS kernel
- Lightweight (MBs of RAM per container)
- Fast startup time (seconds)
- Good isolation with minimal overhead

**Resource Comparison:**
| Metric | VM | Container |
|--------|-------|-----------|
| Boot Time | 30-60 seconds | 1-3 seconds |
| Memory Usage | 512MB - 2GB | 10-100MB |
| Disk Usage | 10-50GB | 100-500MB |
| Isolation | Strong | Good |

### **Docker Architecture Deep Dive**

**Docker Engine Components:**
- **Docker Daemon:** Background service managing containers
- **Docker CLI:** Command-line interface for users
- **Docker Images:** Read-only templates for containers
- **Docker Containers:** Running instances of images
- **Docker Registry:** Storage for docker images (Docker Hub, ECR)

**Image Layers Explained:**
```
Application Layer    [Your App] ← 10MB
Dependencies Layer   [Java/Node] ← 200MB  
OS Layer            [Ubuntu] ← 100MB
Base Layer          [Linux Kernel] ← Shared
```

**Layer Benefits:**
- **Caching:** Unchanged layers are reused
- **Efficiency:** Multiple containers share common layers
- **Speed:** Only changed layers need to be downloaded

### **Docker Best Practices for Production**

**1. Multi-Stage Builds (Reduces image size by 80%)**

```dockerfile
# ❌ BAD: Single stage build (Final image: 800MB)
FROM openjdk:17-jdk
COPY . /app
WORKDIR /app
RUN ./gradlew build
EXPOSE 8080
CMD ["java", "-jar", "build/libs/app.jar"]
```

```dockerfile
# ✅ GOOD: Multi-stage build (Final image: 150MB)
# Build stage
FROM openjdk:17-jdk AS builder
COPY . /app
WORKDIR /app
RUN ./gradlew build

# Runtime stage
FROM openjdk:17-jre-slim
COPY --from=builder /app/build/libs/app.jar /app.jar
EXPOSE 8080
USER 1000:1000  # Security: don't run as root
CMD ["java", "-jar", "/app.jar"]
```

**2. Security Hardening**

```dockerfile
# Use specific versions, not 'latest'
FROM openjdk:17.0.8-jre-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install only necessary packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy application
COPY --chown=appuser:appuser app.jar /app.jar

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080
CMD ["java", "-Xmx512m", "-jar", "/app.jar"]
```

**3. Environment-Specific Configuration**

```yaml
# docker-compose.yml for local development
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - DB_HOST=db
      - REDIS_HOST=redis
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/app/logs  # Local log access

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: devuser
      POSTGRES_PASSWORD: devpass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### **Docker Performance Optimization**

**1. Image Size Optimization Techniques**

```dockerfile
# Use Alpine-based images (5-10x smaller)
FROM node:18-alpine  # 40MB vs node:18 (400MB)

# Combine RUN commands to reduce layers
RUN apk add --no-cache git curl \
    && npm install --production \
    && npm cache clean --force \
    && rm -rf /tmp/*

# Use .dockerignore to exclude unnecessary files
# .dockerignore:
node_modules
*.log
.git
README.md
Dockerfile
```

**2. Build Performance**

```bash
# Build with specific context (faster builds)
docker build --no-cache -t myapp:latest .

# Use BuildKit for parallel builds
DOCKER_BUILDKIT=1 docker build -t myapp:latest .

# Build with resource limits
docker build --memory=4g --cpu-shares=1024 -t myapp:latest .
```

---

## ☸️ AFTERNOON SESSION: KUBERNETES ORCHESTRATION

### **Why Kubernetes Became the Standard**

**The Container Management Problem:**
- How do you manage 1000+ containers across 100+ servers?
- What happens when a container crashes?
- How do you scale containers based on traffic?
- How do you route traffic to the right containers?
- How do you update containers without downtime?

**Kubernetes Solves:**
- **Self-Healing:** Automatically restarts failed containers
- **Auto-Scaling:** Scales based on CPU/memory/custom metrics
- **Load Balancing:** Distributes traffic across containers
- **Rolling Updates:** Updates with zero downtime
- **Service Discovery:** Containers find each other automatically

### **Kubernetes Architecture Simplified**

**Control Plane (Master Nodes):**
- **API Server:** Gateway for all operations
- **etcd:** Distributed database storing cluster state
- **Scheduler:** Decides which node runs which pod
- **Controller Manager:** Ensures desired state matches actual state

**Worker Nodes:**
- **kubelet:** Agent running on each node
- **kube-proxy:** Network proxy handling traffic routing
- **Container Runtime:** Docker/containerd running containers

**Key Resources:**
- **Pod:** Smallest deployable unit (1+ containers)
- **Service:** Stable endpoint for accessing pods
- **Deployment:** Manages pod replicas and updates
- **ConfigMap/Secret:** Configuration and sensitive data
- **Ingress:** HTTP/HTTPS routing to services

### **Real Production Kubernetes Example**

```yaml
# deployment.yaml - Production-ready deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  labels:
    app: order-service
    version: v1.2.3
spec:
  replicas: 3  # High availability
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1  # Always keep 2 pods running
      maxSurge: 1       # Don't create more than 4 pods during update
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
        version: v1.2.3
    spec:
      containers:
      - name: order-service
        image: myregistry/order-service:v1.2.3
        ports:
        - containerPort: 8080
          name: http
        resources:
          requests:    # Guaranteed resources
            memory: "256Mi"
            cpu: "250m"
          limits:      # Maximum resources
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        livenessProbe:   # Restart if unhealthy
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:  # Remove from load balancer if not ready
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: config
          mountPath: /app/config
      volumes:
      - name: config
        configMap:
          name: order-service-config
---
# service.yaml - Load balancer
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service
  ports:
  - name: http
    port: 80
    targetPort: 8080
  type: ClusterIP
---
# hpa.yaml - Auto-scaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### **Kubernetes Troubleshooting Guide**

**Common Issues & Solutions:**

**1. Pod Stuck in Pending State**
```bash
# Check what's wrong
kubectl describe pod order-service-xyz

# Common causes:
# - Insufficient resources on nodes
# - Image pull errors
# - Volume mount failures
# - Pod security policies

# Solutions:
kubectl get nodes -o wide  # Check node resources
kubectl top nodes          # Check resource usage
kubectl get events --sort-by='.lastTimestamp'  # Check events
```

**2. Service Not Reachable**
```bash
# Debug service connectivity
kubectl get svc order-service
kubectl describe svc order-service
kubectl get endpoints order-service

# Test from within cluster
kubectl run debug --image=busybox -it --rm --restart=Never \
  -- wget -qO- http://order-service/health
```

**3. Container Crashes**
```bash
# Check logs
kubectl logs order-service-xyz -c order-service
kubectl logs order-service-xyz -c order-service --previous

# Check resource limits
kubectl top pod order-service-xyz
kubectl describe pod order-service-xyz
```

---

## 🚀 EVENING CHALLENGE: COMPLETE CI/CD PIPELINE

### **The DevOps Pipeline Challenge**

You need to build a production-ready pipeline that:
- **Builds** code automatically on every commit
- **Tests** the application (unit, integration, security)
- **Packages** into Docker containers
- **Deploys** to staging environment automatically
- **Promotes** to production with approval
- **Monitors** application health and performance

### **GitLab CI/CD Pipeline**

```yaml
# .gitlab-ci.yml - Complete production pipeline
stages:
  - build
  - test
  - security
  - package
  - deploy-staging
  - deploy-production

variables:
  DOCKER_REGISTRY: registry.company.com
  APP_NAME: order-service
  KUBE_NAMESPACE_STAGING: staging
  KUBE_NAMESPACE_PROD: production

# Build stage
build:
  stage: build
  image: openjdk:17-jdk
  script:
    - ./gradlew clean build
    - echo "BUILD_VERSION=$(date +%Y%m%d)-${CI_COMMIT_SHORT_SHA}" >> build.env
  artifacts:
    paths:
      - build/libs/
    reports:
      dotenv: build.env
    expire_in: 1 hour

# Unit tests
unit-tests:
  stage: test
  image: openjdk:17-jdk
  script:
    - ./gradlew test
    - echo "Unit tests completed successfully"
  artifacts:
    reports:
      junit: build/test-results/test/*.xml
    expire_in: 1 week

# Integration tests
integration-tests:
  stage: test
  image: docker:latest
  services:
    - docker:dind
    - postgres:13
    - redis:6
  variables:
    POSTGRES_DB: testdb
    POSTGRES_USER: testuser
    POSTGRES_PASSWORD: testpass
  script:
    - docker-compose -f docker-compose.test.yml up -d
    - ./gradlew integrationTest
    - docker-compose -f docker-compose.test.yml down

# Security scanning
security-scan:
  stage: security
  image: owasp/zap2docker-stable
  script:
    - mkdir -p /zap/wrk/
    - /zap/zap-baseline.py -t http://localhost:8080 -g gen.conf -r testreport.html
  artifacts:
    paths:
      - testreport.html
    expire_in: 1 week
  allow_failure: true

# Container security scan
container-scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --format json --output security-report.json $DOCKER_REGISTRY/$APP_NAME:$BUILD_VERSION
  artifacts:
    paths:
      - security-report.json
    expire_in: 1 week

# Package Docker image
package:
  stage: package
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $DOCKER_REGISTRY
  script:
    - docker build -t $DOCKER_REGISTRY/$APP_NAME:$BUILD_VERSION .
    - docker tag $DOCKER_REGISTRY/$APP_NAME:$BUILD_VERSION $DOCKER_REGISTRY/$APP_NAME:latest
    - docker push $DOCKER_REGISTRY/$APP_NAME:$BUILD_VERSION
    - docker push $DOCKER_REGISTRY/$APP_NAME:latest
  only:
    - main
    - develop

# Deploy to staging
deploy-staging:
  stage: deploy-staging
  image: bitnami/kubectl:latest
  environment:
    name: staging
    url: https://staging.company.com
  script:
    - kubectl config use-context staging-cluster
    - sed -i "s|IMAGE_TAG|$BUILD_VERSION|g" k8s/deployment.yaml
    - kubectl apply -f k8s/ -n $KUBE_NAMESPACE_STAGING
    - kubectl rollout status deployment/$APP_NAME -n $KUBE_NAMESPACE_STAGING
    - kubectl get pods -n $KUBE_NAMESPACE_STAGING
  only:
    - main
    - develop

# Staging tests
staging-tests:
  stage: deploy-staging
  image: postman/newman:latest
  script:
    - newman run tests/staging-tests.postman_collection.json \
        --environment tests/staging.postman_environment.json \
        --reporters cli,htmlextra \
        --reporter-htmlextra-export staging-test-report.html
  artifacts:
    paths:
      - staging-test-report.html
    expire_in: 1 week
  dependencies:
    - deploy-staging

# Production deployment (manual approval required)
deploy-production:
  stage: deploy-production
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://api.company.com
  when: manual  # Require manual approval
  script:
    - kubectl config use-context production-cluster
    - sed -i "s|IMAGE_TAG|$BUILD_VERSION|g" k8s/deployment-prod.yaml
    # Blue-green deployment strategy
    - kubectl apply -f k8s/deployment-prod.yaml -n $KUBE_NAMESPACE_PROD
    - kubectl rollout status deployment/$APP_NAME-green -n $KUBE_NAMESPACE_PROD
    # Health check before switching traffic
    - ./scripts/health-check.sh $APP_NAME-green $KUBE_NAMESPACE_PROD
    # Switch traffic to green
    - kubectl patch service $APP_NAME -n $KUBE_NAMESPACE_PROD -p '{"spec":{"selector":{"version":"green"}}}'
    # Cleanup old blue deployment after 5 minutes
    - sleep 300
    - kubectl delete deployment $APP_NAME-blue -n $KUBE_NAMESPACE_PROD --ignore-not-found
  only:
    - main
```

### **Monitoring & Alerting Setup**

```yaml
# monitoring/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    
    rule_files:
      - "alert.rules"
    
    alerting:
      alertmanagers:
        - static_configs:
            - targets:
              - alertmanager:9093
    
    scrape_configs:
      - job_name: 'order-service'
        static_configs:
          - targets: ['order-service:8080']
        metrics_path: '/actuator/prometheus'
        scrape_interval: 5s
        
      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
---
# monitoring/alert-rules.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alert-rules
data:
  alert.rules: |
    groups:
    - name: order-service-alerts
      rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} for {{ $labels.instance }}"
      
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"
      
      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod is crash looping"
          description: "Pod {{ $labels.pod }} is restarting frequently"
```

---

## 🎓 PRODUCTION LESSONS & BEST PRACTICES

### **Deployment Strategies Comparison**

| Strategy | Downtime | Risk | Complexity | Use Case |
|----------|----------|------|------------|----------|
| **Rolling Update** | None | Low | Low | Most applications |
| **Blue-Green** | None | Medium | Medium | Critical systems |
| **Canary** | None | Low | High | High-risk changes |
| **A/B Testing** | None | Low | High | Feature testing |

### **Common Production Failures & Prevention**

**1. Resource Starvation**
- **Problem:** Pods killed due to OOM (Out of Memory)
- **Solution:** Proper resource requests/limits + monitoring
- **Prevention:** Load testing with realistic data

**2. Configuration Drift**
- **Problem:** Different configs between environments
- **Solution:** Infrastructure as Code (Terraform/Helm)
- **Prevention:** Automated environment provisioning

**3. Database Connection Exhaustion**
- **Problem:** Too many pods connecting to same database
- **Solution:** Connection pooling + database proxies
- **Prevention:** Connection pool monitoring

**4. Cascading Failures**
- **Problem:** One service failure brings down entire system
- **Solution:** Circuit breakers + bulkhead patterns
- **Prevention:** Chaos engineering (intentionally break things)

### **DevOps Metrics That Matter**

**DORA Metrics (Industry Standard):**
- **Deployment Frequency:** How often do you deploy? (Target: Multiple times per day)
- **Lead Time for Changes:** Time from commit to production (Target: < 1 hour)
- **Mean Time to Recovery:** How fast can you fix issues? (Target: < 1 hour)
- **Change Failure Rate:** % of deployments causing failures (Target: < 15%)

**Application Metrics:**
- **Response Time:** 95th percentile < 500ms
- **Error Rate:** < 0.1% for critical paths
- **Throughput:** Requests per second capacity
- **Availability:** 99.9% uptime (8.76 hours downtime per year)

---

## 🏆 TODAY'S ACHIEVEMENTS

By the end of Day 7, you've mastered:

1. **Container Fundamentals:** Docker architecture, multi-stage builds, security best practices
2. **Kubernetes Orchestration:** Pod management, services, deployments, auto-scaling
3. **CI/CD Pipelines:** Automated testing, security scanning, deployment strategies
4. **Production Monitoring:** Prometheus metrics, alerting rules, health checks
5. **DevOps Culture:** Infrastructure as code, deployment strategies, failure prevention
6. **Troubleshooting Skills:** Debugging containers and Kubernetes clusters
7. **Performance Optimization:** Resource management, scaling strategies

**💡 Senior Engineer Insight:** DevOps isn't just about tools - it's about building systems that can deploy confidently, scale automatically, and recover gracefully. The best engineers design for observability from day one, automate everything that can be automated, and always have a rollback plan. Today you learned that "it works on my machine" is no longer an excuse - containerization ensures your code works the same everywhere.

---

## 🚀 TOMORROW'S PREVIEW: DAY 8

**System Design & Architecture Patterns** - Designing systems that handle millions of users, from database sharding to CDN strategies, load balancing to caching layers.

Ready to architect systems like a principal engineer? 🏗️
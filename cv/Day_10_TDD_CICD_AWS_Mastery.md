# 🚀 Day 10: Test Driven Development, CI/CD & AWS Cloud Mastery

## 📋 Session Overview
**Focus Areas for ShopBack Backend Developer Role:**
- **Test Driven Development (TDD)** - Core requirement
- **CI/CD Implementation** - Essential for modern development  
- **AWS Cloud Services** - Highly desired skill

**Learning Objectives:**
- Master TDD principles and implementation
- Build complete CI/CD pipelines
- Deploy scalable applications on AWS
- Integrate all three for production-ready systems

---

## 🧪 Part 1: Test Driven Development (TDD) Mastery

### **TDD Philosophy & Cycle**

**The Red-Green-Refactor Cycle:**
```
🔴 RED: Write a failing test
🟢 GREEN: Write minimal code to pass
🔵 REFACTOR: Improve code while keeping tests green
```

### **TDD Implementation in NestJS**

#### **1. Unit Testing with Jest**
```typescript
// users.service.spec.ts
describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      // 🔴 RED: Write failing test first
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
      };

      const savedUser = { id: 1, ...userData };
      jest.spyOn(repository, 'save').mockResolvedValue(savedUser as User);

      const result = await service.createUser(userData);

      expect(repository.save).toHaveBeenCalledWith(userData);
      expect(result).toEqual(savedUser);
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        name: 'Test User',
      };

      jest.spyOn(repository, 'save').mockRejectedValue(
        new Error('Duplicate email')
      );

      await expect(service.createUser(userData)).rejects.toThrow(
        'Duplicate email'
      );
    });
  });
});
```

#### **2. Integration Testing**
```typescript
// users.controller.e2e-spec.ts
describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let usersService = {
    createUser: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    })
      .overrideProvider(UsersService)
      .useValue(usersService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/users (POST)', () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
    };

    usersService.createUser.mockResolvedValue({
      id: 1,
      ...userData,
    });

    return request(app.getHttpServer())
      .post('/users')
      .send(userData)
      .expect(201)
      .expect((res) => {
        expect(res.body.email).toBe(userData.email);
        expect(res.body.name).toBe(userData.name);
      });
  });
});
```

#### **3. TDD Best Practices**
```typescript
// Test Structure: AAA Pattern
describe('UserService', () => {
  it('should validate user email format', async () => {
    // 🎯 ARRANGE
    const invalidEmail = 'invalid-email';
    const userData = { email: invalidEmail, name: 'Test' };

    // 🎬 ACT & 🔍 ASSERT
    await expect(service.createUser(userData))
      .rejects
      .toThrow('Invalid email format');
  });
});

// Mocking External Dependencies
jest.mock('../external/email.service');
const mockEmailService = jest.mocked(EmailService);

// Test Data Builders
class UserBuilder {
  private user: Partial<User> = {};

  withEmail(email: string): UserBuilder {
    this.user.email = email;
    return this;
  }

  withName(name: string): UserBuilder {
    this.user.name = name;
    return this;
  }

  build(): User {
    return {
      id: 1,
      email: 'default@example.com',
      name: 'Default User',
      ...this.user,
    } as User;
  }
}

// Usage
const testUser = new UserBuilder()
  .withEmail('test@example.com')
  .withName('Test User')
  .build();
```

### **TDD Metrics & Coverage**
```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

---

## 🔄 Part 2: CI/CD Pipeline Implementation

### **GitHub Actions Workflow**

#### **1. Basic CI Pipeline**
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
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Build Docker image
      run: docker build -t nestjs-app:${{ github.sha }} .
```

#### **2. Complete CD Pipeline with AWS**
```yaml
# .github/workflows/cd.yml
name: CD Pipeline

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ap-southeast-1
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2
    
    - name: Build and push Docker image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: nestjs-app
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    
    - name: Deploy to ECS
      run: |
        aws ecs update-service \
          --cluster production-cluster \
          --service nestjs-service \
          --force-new-deployment
```

#### **3. Docker Configuration**
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN npm run build

EXPOSE 3000

USER node

CMD ["node", "dist/main"]
```

```yaml
# docker-compose.yml (for local development)
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@db:5432/nestjs_db
    depends_on:
      - db
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: nestjs_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## ☁️ Part 3: AWS Cloud Services Implementation

### **1. Infrastructure as Code with CDK**

```typescript
// infrastructure/app-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';

export class NestJSAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'AppVPC', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // RDS PostgreSQL
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      multiAz: false,
      allocatedStorage: 100,
      storageEncrypted: true,
      deletionProtection: false,
    });

    // ElastiCache Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      'RedisSubnetGroup',
      {
        description: 'Subnet group for Redis',
        subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      }
    );

    const redis = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'AppCluster', {
      vpc,
      containerInsights: true,
    });

    // ECS Fargate Service
    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'AppTaskDefinition',
      {
        memoryLimitMiB: 512,
        cpu: 256,
      }
    );

    const container = taskDefinition.addContainer('app', {
      image: ecs.ContainerImage.fromRegistry('your-ecr-repo/nestjs-app'),
      environment: {
        NODE_ENV: 'production',
        DATABASE_URL: `postgresql://postgres:${database.secret?.secretValueFromJson('password')}@${database.instanceEndpoint.hostname}:5432/postgres`,
        REDIS_URL: `redis://${redis.attrRedisEndpointAddress}:6379`,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'nestjs-app',
      }),
    });

    container.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    const service = new ecs.FargateService(this, 'AppService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
    });
  }
}
```

### **2. AWS Services Integration**

#### **S3 File Upload Service**
```typescript
// src/aws/s3.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-1',
    });
  }

  async uploadFile(
    bucketName: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    });

    await this.s3Client.send(command);
    return `https://${bucketName}.s3.amazonaws.com/${key}`;
  }

  async generatePresignedUrl(
    bucketName: string,
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
```

#### **SQS Message Queue Service**
```typescript
// src/aws/sqs.service.ts
import { Injectable } from '@nestjs/common';
import { SQSClient, SendMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';

@Injectable()
export class SQSService {
  private sqsClient: SQSClient;

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'ap-southeast-1',
    });
  }

  async sendMessage(queueUrl: string, messageBody: any): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageAttributes: {
        timestamp: {
          DataType: 'String',
          StringValue: new Date().toISOString(),
        },
      },
    });

    await this.sqsClient.send(command);
  }

  async receiveMessages(queueUrl: string, maxMessages: number = 10) {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 20, // Long polling
    });

    return await this.sqsClient.send(command);
  }
}
```

#### **CloudWatch Monitoring**
```typescript
// src/aws/cloudwatch.service.ts
import { Injectable } from '@nestjs/common';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

@Injectable()
export class CloudWatchService {
  private cloudWatchClient: CloudWatchClient;

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({
      region: process.env.AWS_REGION || 'ap-southeast-1',
    });
  }

  async putMetric(
    namespace: string,
    metricName: string,
    value: number,
    unit: string = 'Count',
  ): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
        },
      ],
    });

    await this.cloudWatchClient.send(command);
  }
}
```

### **3. Production-Ready Configuration**

#### **Environment Configuration**
```typescript
// src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'nestjs_db',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  aws: {
    region: process.env.AWS_REGION || 'ap-southeast-1',
    s3: {
      bucket: process.env.S3_BUCKET || 'nestjs-uploads',
    },
    sqs: {
      queueUrl: process.env.SQS_QUEUE_URL,
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
});
```

#### **Health Check Endpoint**
```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
```

---

## 🎯 Part 4: Integration & Best Practices

### **Complete Testing Strategy**

#### **1. Testing Pyramid Implementation**
```typescript
// tests/unit/user.service.spec.ts - Unit Tests (70%)
describe('UserService Unit Tests', () => {
  // Fast, isolated, numerous
});

// tests/integration/user.integration.spec.ts - Integration Tests (20%)
describe('User Integration Tests', () => {
  // Test modules working together
});

// tests/e2e/user.e2e.spec.ts - E2E Tests (10%)
describe('User E2E Tests', () => {
  // Test complete user journeys
});
```

#### **2. Continuous Testing in CI/CD**
```yaml
# .github/workflows/complete-pipeline.yml
name: Complete CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
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
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to SonarCloud
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level moderate
    
    - name: Scan for vulnerabilities
      run: npx snyk test

  deploy-staging:
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    
    steps:
    - name: Deploy to staging
      run: |
        # Deploy to staging environment
        echo "Deploying to staging..."

  deploy-production:
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
    - name: Deploy to production
      run: |
        # Deploy to production environment
        echo "Deploying to production..."
```

### **Monitoring & Observability**

#### **Application Performance Monitoring**
```typescript
// src/monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { CloudWatchService } from '../aws/cloudwatch.service';

@Injectable()
export class MetricsService {
  constructor(private cloudWatch: CloudWatchService) {}

  async recordApiCall(endpoint: string, duration: number, statusCode: number) {
    await Promise.all([
      this.cloudWatch.putMetric('API/Calls', 'Count', 1),
      this.cloudWatch.putMetric('API/Duration', 'ResponseTime', duration),
      this.cloudWatch.putMetric('API/Errors', 'ErrorRate', statusCode >= 400 ? 1 : 0),
    ]);
  }

  async recordDatabaseQuery(queryType: string, duration: number) {
    await this.cloudWatch.putMetric(
      'Database/Queries',
      `${queryType}Duration`,
      duration,
      'Milliseconds'
    );
  }
}
```

---

## 📚 Learning Resources & Practice

### **TDD Resources**
1. **Books:**
   - "Test Driven Development: By Example" - Kent Beck
   - "Growing Object-Oriented Software, Guided by Tests" - Freeman & Pryce

2. **Practice Projects:**
   - Build a REST API using pure TDD
   - Implement complex business logic with TDD
   - Refactor legacy code with test coverage

### **CI/CD Resources**
1. **Hands-on Practice:**
   - Set up GitHub Actions for personal projects
   - Implement blue-green deployments
   - Practice infrastructure as code

2. **Tools to Master:**
   - GitHub Actions / GitLab CI
   - Docker & Docker Compose
   - Terraform / AWS CDK

### **AWS Resources**
1. **Certification Path:**
   - AWS Cloud Practitioner
   - AWS Solutions Architect Associate
   - AWS Developer Associate

2. **Hands-on Labs:**
   - Deploy applications on EC2/ECS
   - Set up RDS and caching with ElastiCache
   - Implement serverless with Lambda

---

## 🎯 Day 10 Action Items

### **Immediate (Today):**
- [ ] Set up comprehensive test suite for current project
- [ ] Implement basic CI pipeline with GitHub Actions
- [ ] Create Dockerfile and docker-compose for local development

### **This Week:**
- [ ] Deploy application to AWS (EC2 or ECS)
- [ ] Set up RDS PostgreSQL and Redis
- [ ] Implement monitoring and logging

### **Next 2 Weeks:**
- [ ] Complete CD pipeline with automated deployment
- [ ] Add advanced testing strategies (contract testing, performance testing)
- [ ] Implement infrastructure as code with CDK

### **Interview Preparation:**
- [ ] Practice explaining TDD benefits and implementation
- [ ] Prepare CI/CD pipeline diagrams and explanations
- [ ] Study AWS services architecture patterns

---

## 💡 Key Takeaways for ShopBack Interview

### **TDD Talking Points:**
- "I follow the Red-Green-Refactor cycle religiously"
- "Test coverage above 80% with meaningful tests, not just coverage"
- "TDD helps with better design and reduced debugging time"

### **CI/CD Talking Points:**
- "Automated testing prevents regression bugs in production"
- "Infrastructure as code ensures consistent deployments"
- "Monitoring and observability are crucial for production systems"

### **AWS Talking Points:**
- "Cloud-native design for scalability and reliability"
- "Cost optimization through proper resource sizing"
- "Security best practices with IAM and encryption"

**Remember:** Focus on how these practices improve product quality, team productivity, and customer experience - all key values for ShopBack!

---

*Ready to tackle complex distributed systems with confidence! 🚀*
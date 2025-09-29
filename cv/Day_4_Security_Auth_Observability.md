# 🔐 DAY 4: SECURITY, AUTHENTICATION & OBSERVABILITY
## Universal patterns for NestJS, Java (Spring), and Go

---

## 📅 DAY 4 OVERVIEW

- Yesterday: Circuit breaker, Saga, Event Sourcing, API Gateway
- Today’s Focus: Security (AuthN/AuthZ), API hardening, Observability (Logs, Metrics, Tracing)
- Mindset: From “it works” → “it’s safe, auditable, and diagnosable”

---

## 🌅 MORNING SESSION: Authentication & Authorization

### 🧠 Mindset Shift #1: Identity is an architecture concern, not a library
- Don’t “roll your own” auth. Prefer standards (OAuth2/OIDC, JWT, sessions)
- Treat identity as a platform service (IdP: Auth0, Okta, Keycloak)
- Separate AuthN (who you are) from AuthZ (what you can do)

### 🎯 Study Case: Multi-tenant SaaS Login (Google/Okta SSO)
Scenario: B2B SaaS app with company-level SSO, user roles, and audit trails
- Requirements: SSO (OIDC), short-lived access token, refresh token rotation, RBAC, audit logs
- Pitfalls: Long-lived JWTs, token leakage, no revocation, missing audience checks

### 🔑 Token Model (Universal)
- Access token: short-lived (5–15m), scoped, bearer, aud/iss/sub checks
- Refresh token: long-lived, rotate on use, detect reuse
- Session store: track device, IP, user-agent, last-used

### 🚦 Authorization Strategies
- RBAC: role → permissions map (admin, editor, viewer)
- ABAC: policies over attributes (department, ownership, region)
- Resource ownership checks everywhere

### ⚙️ Reference Implementations

NestJS (Passport JWT + Guards):
```ts
// auth.module.ts
@Module({
  imports: [JwtModule.register({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '15m', audience: 'api', issuer: 'auth' },
  })],
  providers: [JwtStrategy, RolesGuard],
})
export class AuthModule {}

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user; // injected by JwtStrategy
    const required = this.getRequiredRoles(ctx);
    return required.length === 0 || required.some(r => user.roles?.includes(r));
  }
  private getRequiredRoles(ctx: ExecutionContext): string[] {
    return Reflect.getMetadata('roles', ctx.getHandler()) ?? [];
  }
}

// usage
@UseGuards(AuthGuard('jwt'), RolesGuard)
@SetMetadata('roles', ['admin'])
@Get('/admin')
getAdminOnly() { return { ok: true } }
```

Spring Security (JWT + Method Security):
```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  @Bean SecurityFilterChain filter(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/auth/**").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(oauth -> oauth.jwt());
    return http.build();
  }
}

@Service
public class PermissionService {
  public boolean canAccessOrder(Authentication auth, String orderOwnerId) {
    Jwt jwt = (Jwt) auth.getPrincipal();
    return jwt.getClaimAsStringList("roles").contains("admin") ||
           jwt.getClaimAsString("sub").equals(orderOwnerId);
  }
}

@PreAuthorize("@permissionService.canAccessOrder(authentication, #ownerId)")
@GetMapping("/orders/{ownerId}")
public ResponseEntity<?> getOrders(@PathVariable String ownerId) { ... }
```

Go (Middleware + Context Claims):
```go
func AuthMiddleware(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    tokenStr := extractBearer(r.Header.Get("Authorization"))
    claims, err := validateJWT(tokenStr, cfg)
    if err != nil { http.Error(w, "unauthorized", http.StatusUnauthorized); return }
    ctx := context.WithValue(r.Context(), CtxUserKey, claims)
    next.ServeHTTP(w, r.WithContext(ctx))
  })
}

func RequireRole(role string, next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    claims := r.Context().Value(CtxUserKey).(Claims)
    if !contains(claims.Roles, role) { http.Error(w, "forbidden", 403); return }
    next.ServeHTTP(w, r)
  })
}
```

---

## 🌐 AFTERNOON SESSION: API Security in Production

### 🧠 Mindset Shift #2: Defense-in-depth, assume compromise
- Layered controls: gateway, service, DB, network
- Least privilege everywhere: scopes, roles, DB users, cloud IAM
- Audit everything: who did what, when, from where

### 🛡️ Hardening Checklist (Universal)
- Input validation and output encoding (OWASP ASVS)
- Rate limiting (per user, IP, and endpoint)
- Idempotency keys for state-changing APIs
- Request signing for webhooks (HMAC + timestamp, replay protection)
- TLS everywhere, consider mTLS for internal services
- CORS least-privilege, CSRF for cookie-based sessions
- Secrets management (KMS/Vault/SM), key rotation policies
- Audit logs with tamper-evident storage

### 🔧 Reference Snippets

NestJS – Rate limiting and validation:
```ts
// main.ts
app.use(helmet());
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
app.use(rateLimit({ windowMs: 60_000, max: 100 }));
```

Spring – Idempotency filter:
```java
@Component
public class IdempotencyFilter implements Filter {
  @Override public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
      throws IOException, ServletException {
    HttpServletRequest r = (HttpServletRequest) req;
    if ("POST".equals(r.getMethod())) {
      String key = r.getHeader("Idempotency-Key");
      if (key == null || seen(key)) { ((HttpServletResponse)res).setStatus(409); return; }
      remember(key, 10 * 60); // 10 minutes
    }
    chain.doFilter(req, res);
  }
}
```

Go – Webhook signature verification (HMAC):
```go
func VerifySignature(body []byte, sig string, secret []byte, ts string) bool {
  mac := hmac.New(sha256.New, secret)
  mac.Write([]byte(ts))
  mac.Write(body)
  expected := hex.EncodeToString(mac.Sum(nil))
  return hmac.Equal([]byte(sig), []byte(expected))
}
```

---

## 🌆 EVENING SESSION: Observability (Logs, Metrics, Tracing)

### 🧠 Mindset Shift #3: If you can’t observe it, you can’t operate it
- Standardize correlation IDs across gateway → services → DB
- Structured logging (JSON), avoid print-debugging in prod
- RED/USE metrics, SLOs/SLIs
- Distributed tracing with OpenTelemetry

### 📡 Cross-Stack Patterns
- Correlation ID header: `X-Request-Id` propagated everywhere
- Context propagation across threads/goroutines/reactors
- PII-safe logging, sampling for high-traffic endpoints

NestJS – OpenTelemetry + Correlation ID:
```ts
// request-id.middleware.ts
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', id as string);
  (req as any).requestId = id;
  next();
}
```

Spring – Micrometer + OpenTelemetry:
```java
@Bean
public WebMvcConfigurer traceInterceptor() {
  return new WebMvcConfigurer() {
    @Override public void addInterceptors(InterceptorRegistry registry) {
      registry.addInterceptor(new HandlerInterceptor() {
        public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object h) {
          String id = Optional.ofNullable(req.getHeader("X-Request-Id")).orElse(UUID.randomUUID().toString());
          res.setHeader("X-Request-Id", id);
          MDC.put("requestId", id);
          return true;
        }
      });
    }
  };
}
```

Go – Structured logging + trace IDs:
```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
logger.Info("request", "method", r.Method, "path", r.URL.Path, "request_id", reqID)
```

### 📊 Metrics You Should Track
- API: p50/p95 latency, error rate, throughput (RPS), saturation
- Auth: failed/succeeded logins, token refresh/reuse, role changes
- Security: rate limit hits, signature verification failures
- Business: signups, conversion, orders created/succeeded/failed

---

## 🧪 DAY 4 CHALLENGE PROJECT

Build: Secure and Observable Microservice Slice
- Implement JWT/OIDC-based authentication (short-lived access token, refresh rotation)
- Add RBAC/ABAC checks to 2 critical endpoints
- Apply rate limiting, input validation, idempotency keys
- Implement webhook signature verification with replay protection
- Add correlation IDs, structured JSON logs, and basic metrics
- Export traces with OpenTelemetry

Acceptance Tests:
- Auth: tokens expire correctly; refresh rotation detects reuse
- Security: blocked without roles; webhook invalid signature rejected
- Observability: logs include request_id; p95 < 200ms under 100 RPS

---

## ✅ DAY 4 COMPLETION CHECKLIST
- [ ] OIDC/JWT flow with refresh rotation
- [ ] RBAC/ABAC authorization
- [ ] Rate limiting + idempotency for POST
- [ ] Webhook signing + replay protection
- [ ] Correlation ID propagation end-to-end
- [ ] Logs (JSON), metrics, and traces exported

---

## 🤔 REFLECTION QUESTIONS
1) Security: When do you choose JWT vs session cookies? What about mTLS internal-only?
2) Authorization: When is ABAC preferable to RBAC?
3) Observability: What’s your minimum viable SLO for your service?
4) Incidents: How would you trace a failed order across 5 services?

---

## 📚 STUDY CASES & WAR STORIES
- Netflix: Zero-trust networking and token lifetimes
- GitHub: Webhook signing and replay protection best practices
- Stripe: Idempotency keys and strong API guarantees
- Google: SRE golden signals (latency, traffic, errors, saturation)
- Shopify: Post-incident culture and blameless retrospectives

---

## 🧭 QUICK REFERENCE (Language-Agnostic)
- OAuth2/OIDC flows (Auth Code + PKCE for SPA/mobile)
- JWT best practices (kid, exp, aud, iss, rotation)
- API security layers (Gateway, Service, DB, Network)
- Observability stack: OpenTelemetry → OTLP → Jaeger/Tempo, Prometheus/Grafana, ELK/EFK

---

💡 Senior Insight: Security and observability are product features. Design them intentionally, test them continuously, and keep them simple enough to operate under pressure.

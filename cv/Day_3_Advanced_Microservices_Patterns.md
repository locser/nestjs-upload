# 🚀 DAY 3: ADVANCED MICROSERVICES PATTERNS
## Production-Ready Distributed Systems - Real-World Patterns

---

## 📅 DAY 3 OVERVIEW

**Yesterday's Achievements:** ✅ Advanced JPA, Testing, Service Decomposition, Communication Patterns  
**Today's Focus:** Circuit breaker, Saga pattern, Event sourcing, API Gateway  
**Tomorrow's Preview:** Security, authentication, and monitoring strategies

---

## 🌅 MORNING SESSION: Circuit Breaker Pattern

### **🧠 Mindset Shift #1: From Hoping Services Work to Expecting Failures**

#### **Study Case: Netflix's Chaos Engineering**
```
Netflix Philosophy: "Everything fails all the time"
- 150M+ subscribers can't wait for a service to recover
- One failing service shouldn't bring down entire platform
- Better to show "recommended for you" from cache than nothing

The Problem: Cascade Failures
User → API Gateway → User Service → Database (down)
Result: All user requests timeout, entire system becomes unresponsive

The Solution: Circuit Breaker
User → API Gateway → User Service → Circuit Breaker → Database
Result: Fast failure, fallback to cached data, system stays responsive
```

#### **💡 Study Case: Amazon's Shopping Cart Resilience**
```
Black Friday Scenario:
- Payment service gets overloaded (10x normal traffic)
- Without circuit breaker: All checkout requests hang for 30 seconds
- With circuit breaker: After 10 failures, fast-fail and show "try again later"

User Experience:
- Bad: User waits 30 seconds, then gets error
- Good: User gets immediate feedback, can retry in few minutes
```

#### **🔥 Circuit Breaker Implementation in Java**

**Basic Circuit Breaker with Resilience4j:**
```java
@Service
public class ProductService {
    
    private final ProductRepository productRepository;
    private final ExternalPricingService pricingService;
    
    // Circuit breaker configuration
    @CircuitBreaker(name = "pricing-service", fallbackMethod = "fallbackPricing")
    @TimeLimiter(name = "pricing-service")
    @Retry(name = "pricing-service")
    public CompletableFuture<PricingResponse> getProductPricing(String productId) {
        return CompletableFuture.supplyAsync(() -> {
            // This might fail or be slow
            return pricingService.calculatePrice(productId);
        });
    }
    
    // Fallback method - same signature + Exception parameter
    public CompletableFuture<PricingResponse> fallbackPricing(String productId, Exception ex) {
        // Fast fallback logic
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ProductNotFoundException(productId));
            
        // Use cached pricing or default markup
        BigDecimal fallbackPrice = product.getBasePrice().multiply(BigDecimal.valueOf(1.2));
        
        return CompletableFuture.completedFuture(
            new PricingResponse(productId, fallbackPrice, "FALLBACK_PRICING")
        );
    }
}
```

**Configuration:**
```yaml
# application.yml
resilience4j:
  circuitbreaker:
    instances:
      pricing-service:
        register-health-indicator: true
        sliding-window-size: 10
        minimum-number-of-calls: 5
        permitted-number-of-calls-in-half-open-state: 3
        automatic-transition-from-open-to-half-open-enabled: true
        wait-duration-in-open-state: 5s
        failure-rate-threshold: 50
        event-consumer-buffer-size: 10
        
  timelimiter:
    instances:
      pricing-service:
        timeout-duration: 3s
        cancel-running-future: true
        
  retry:
    instances:
      pricing-service:
        max-attempts: 3
        wait-duration: 1s
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
```

#### **⚠️ Common Circuit Breaker Mistakes**

**Mistake #1: No Proper Fallback**
```java
// WRONG: Circuit breaker without meaningful fallback
@CircuitBreaker(name = "user-service", fallbackMethod = "fallbackUser")
public UserDTO getUser(String userId) {
    return userServiceClient.getUser(userId);
}

public UserDTO fallbackUser(String userId, Exception ex) {
    // This is useless!
    throw new ServiceUnavailableException("User service is down");
}

// RIGHT: Meaningful fallback strategy
public UserDTO fallbackUser(String userId, Exception ex) {
    // Try local cache first
    UserDTO cachedUser = userCache.get(userId);
    if (cachedUser != null) {
        return cachedUser;
    }
    
    // Return minimal user data from local database
    return userRepository.findById(userId)
        .map(this::mapToBasicUserDTO)
        .orElse(createGuestUser(userId));
}
```

**Mistake #2: Wrong Threshold Configuration**
```yaml
# WRONG: Too sensitive, will trip on minor blips
failure-rate-threshold: 10  # Trips after 10% failures
minimum-number-of-calls: 2  # Not enough data

# RIGHT: Balanced configuration
failure-rate-threshold: 50  # Trips after 50% failures
minimum-number-of-calls: 10 # Enough data to make decision
```

#### **🎯 Real-World Example: Grab's Location Service**

**Study Case: Driver Location Updates**
```java
@Service
public class LocationTrackingService {
    
    private final DriverLocationRepository locationRepository;
    private final ExternalMapService mapService;
    private final RedisTemplate<String, String> redisTemplate;
    
    @CircuitBreaker(name = "map-service", fallbackMethod = "fallbackLocationUpdate")
    public LocationResult updateDriverLocation(String driverId, LocationUpdate update) {
        
        // External map service call (might fail)
        MapValidationResult validation = mapService.validateLocation(
            update.getLatitude(), 
            update.getLongitude()
        );
        
        if (!validation.isValid()) {
            throw new InvalidLocationException("Location outside service area");
        }
        
        // Store validated location
        DriverLocation location = new DriverLocation(driverId, update, validation.getZone());
        locationRepository.save(location);
        
        return new LocationResult(location, validation.getEstimatedAddress());
    }
    
    // Fallback: Skip external validation, use basic checks
    public LocationResult fallbackLocationUpdate(String driverId, LocationUpdate update, Exception ex) {
        
        // Basic validation without external service
        if (isWithinServiceBounds(update.getLatitude(), update.getLongitude())) {
            
            // Store with unknown zone
            DriverLocation location = new DriverLocation(driverId, update, "UNKNOWN_ZONE");
            locationRepository.save(location);
            
            // Use cached address or "Unknown Location"
            String cachedAddress = getCachedAddress(update.getLatitude(), update.getLongitude());
            
            return new LocationResult(location, cachedAddress);
        }
        
        throw new LocationServiceException("Location service unavailable and coordinates invalid");
    }
    
    private boolean isWithinServiceBounds(double lat, double lon) {
        // Simple bounds check without external service
        return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }
}
```

---

## 🌆 EVENING SESSION: Saga Pattern for Distributed Transactions

### **🧠 Mindset Shift #2: From ACID Transactions to Eventual Consistency**

#### **Study Case: E-commerce Order Processing Saga**
```
Traditional ACID Transaction (Impossible in microservices):
BEGIN TRANSACTION
  - Reserve inventory
  - Charge payment  
  - Create order
  - Update user points
  - Send notification
COMMIT or ROLLBACK

Distributed Challenge:
- Inventory Service (different database)
- Payment Service (different database)  
- Order Service (different database)
- User Service (different database)
- Notification Service (external API)

No distributed ACID transactions across services!
```

#### **💡 Study Case: Shopee's Order Saga**
```
Saga Choreography (Event-driven):
1. Order Service: Create order (PENDING)
2. Publish: OrderCreated event
3. Inventory Service: Reserve items → Success/Failure event
4. Payment Service: Charge card → Success/Failure event  
5. Order Service: Mark CONFIRMED or start compensation

If any step fails, trigger compensating actions:
- Unreserve inventory
- Refund payment
- Cancel order
- Notify user of failure
```

#### **🔥 Saga Pattern Implementation**

**Orchestrator Pattern (Centralized Control):**
```java
@Component
public class OrderSagaOrchestrator {
    
    private final SagaManager sagaManager;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;
    private final OrderService orderService;
    
    public void processOrderSaga(CreateOrderRequest request) {
        String sagaId = UUID.randomUUID().toString();
        
        SagaDefinition<OrderSagaData> saga = SagaDefinition
            .<OrderSagaData>create()
            .step("reserve-inventory")
                .invokeParticipant(this::reserveInventory)
                .withCompensation(this::cancelInventoryReservation)
            .step("process-payment")
                .invokeParticipant(this::processPayment)
                .withCompensation(this::refundPayment)
            .step("create-order")
                .invokeParticipant(this::createOrder)
                .withCompensation(this::cancelOrder)
            .step("send-confirmation")
                .invokeParticipant(this::sendConfirmation)
                .withCompensation(this::sendCancellationNotice)
            .build();
            
        OrderSagaData sagaData = new OrderSagaData(request);
        sagaManager.choreographSaga(sagaId, saga, sagaData);
    }
    
    // Saga steps
    private SagaStepResult reserveInventory(OrderSagaData data) {
        try {
            ReservationResult result = inventoryService.reserveItems(
                data.getOrderId(), data.getItems()
            );
            data.setReservationId(result.getReservationId());
            return SagaStepResult.success(data);
        } catch (InsufficientStockException e) {
            return SagaStepResult.failure("Insufficient stock: " + e.getMessage());
        }
    }
    
    private SagaStepResult processPayment(OrderSagaData data) {
        try {
            PaymentResult result = paymentService.processPayment(
                data.getUserId(), 
                data.getTotalAmount(),
                data.getPaymentMethod()
            );
            data.setPaymentId(result.getPaymentId());
            return SagaStepResult.success(data);
        } catch (PaymentDeclinedException e) {
            return SagaStepResult.failure("Payment declined: " + e.getMessage());
        }
    }
    
    private SagaStepResult createOrder(OrderSagaData data) {
        Order order = orderService.createConfirmedOrder(
            data.getOrderRequest(),
            data.getReservationId(),
            data.getPaymentId()
        );
        data.setCreatedOrderId(order.getId());
        return SagaStepResult.success(data);
    }
    
    // Compensation actions (reverse order)
    private void cancelInventoryReservation(OrderSagaData data) {
        if (data.getReservationId() != null) {
            inventoryService.cancelReservation(data.getReservationId());
        }
    }
    
    private void refundPayment(OrderSagaData data) {
        if (data.getPaymentId() != null) {
            paymentService.refundPayment(data.getPaymentId(), "Order cancelled");
        }
    }
    
    private void cancelOrder(OrderSagaData data) {
        if (data.getCreatedOrderId() != null) {
            orderService.cancelOrder(data.getCreatedOrderId(), "Saga compensation");
        }
    }
}
```

**Choreography Pattern (Event-driven):**
```java
// Each service handles its own part of the saga

// Order Service
@Service
public class OrderService {
    
    @EventListener
    public void handleCreateOrder(CreateOrderCommand command) {
        // Create order in PENDING state
        Order order = new Order(command.getRequest());
        order.setStatus(OrderStatus.PENDING);
        orderRepository.save(order);
        
        // Publish event to start saga
        eventPublisher.publishEvent(new OrderCreatedEvent(
            order.getId(),
            order.getUserId(),
            order.getItems(),
            order.getTotalAmount()
        ));
    }
    
    @EventListener
    public void handleInventoryReserved(InventoryReservedEvent event) {
        Order order = findOrder(event.getOrderId());
        order.setReservationId(event.getReservationId());
        order.setStatus(OrderStatus.INVENTORY_RESERVED);
        orderRepository.save(order);
        
        // Trigger next step
        eventPublisher.publishEvent(new ProcessPaymentCommand(
            event.getOrderId(),
            order.getUserId(),
            order.getTotalAmount()
        ));
    }
    
    @EventListener  
    public void handlePaymentProcessed(PaymentProcessedEvent event) {
        Order order = findOrder(event.getOrderId());
        order.setPaymentId(event.getPaymentId());
        order.setStatus(OrderStatus.CONFIRMED);
        orderRepository.save(order);
        
        // Saga completed successfully
        eventPublisher.publishEvent(new OrderConfirmedEvent(order.getId()));
    }
    
    @EventListener
    public void handleInventoryReservationFailed(InventoryReservationFailedEvent event) {
        Order order = findOrder(event.getOrderId());
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancellationReason("Insufficient inventory");
        orderRepository.save(order);
        
        // No compensation needed - order was never confirmed
    }
    
    @EventListener
    public void handlePaymentFailed(PaymentFailedEvent event) {
        Order order = findOrder(event.getOrderId());
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancellationReason("Payment failed");
        orderRepository.save(order);
        
        // Trigger compensation: release inventory
        eventPublisher.publishEvent(new CancelInventoryReservationCommand(
            order.getReservationId()
        ));
    }
}

// Inventory Service
@Service
public class InventoryService {
    
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        try {
            ReservationResult result = reserveItems(event.getOrderId(), event.getItems());
            
            // Success
            eventPublisher.publishEvent(new InventoryReservedEvent(
                event.getOrderId(),
                result.getReservationId(),
                result.getExpiresAt()
            ));
            
        } catch (InsufficientStockException e) {
            // Failure
            eventPublisher.publishEvent(new InventoryReservationFailedEvent(
                event.getOrderId(),
                e.getMessage()
            ));
        }
    }
    
    @EventListener
    public void handleCancelReservation(CancelInventoryReservationCommand command) {
        cancelReservation(command.getReservationId());
        
        eventPublisher.publishEvent(new InventoryReservationCancelledEvent(
            command.getReservationId()
        ));
    }
}
```

#### **⚠️ Saga Pattern Pitfalls**

**Mistake #1: Not Handling Partial Failures**
```java
// WRONG: No compensation for partial success
public void processOrder(CreateOrderRequest request) {
    inventoryService.reserveItems(request.getItems()); // Success
    paymentService.processPayment(request.getPayment()); // Fails here
    // Inventory is still reserved but payment failed!
}

// RIGHT: Proper saga with compensation
public void processOrderSaga(CreateOrderRequest request) {
    SagaTransaction saga = sagaManager.begin();
    try {
        ReservationResult reservation = inventoryService.reserveItems(request.getItems());
        saga.addCompensation(() -> inventoryService.cancelReservation(reservation.getId()));
        
        PaymentResult payment = paymentService.processPayment(request.getPayment());
        saga.addCompensation(() -> paymentService.refundPayment(payment.getId()));
        
        saga.commit();
    } catch (Exception e) {
        saga.rollback(); // Executes compensations in reverse order
    }
}
```

**Mistake #2: Non-Idempotent Operations**
```java
// WRONG: Can cause duplicate charges if retried
@EventListener
public void handleProcessPayment(ProcessPaymentEvent event) {
    paymentService.chargeCard(event.getAmount()); // Not idempotent!
}

// RIGHT: Idempotent payment processing
@EventListener
public void handleProcessPayment(ProcessPaymentEvent event) {
    String idempotencyKey = event.getOrderId() + "-payment";
    paymentService.chargeCard(event.getAmount(), idempotencyKey);
}
```

#### **🎯 Real-World Example: Uber Trip Booking Saga**

**Study Case: Complex Multi-Service Transaction**
```java
@Component
public class TripBookingSaga {
    
    public void bookTrip(TripBookingRequest request) {
        
        // Step 1: Reserve driver
        DriverReservationResult driverResult = driverService.reserveDriver(
            request.getPickupLocation(),
            request.getRequestedTime()
        );
        
        // Step 2: Calculate route and pricing
        RouteCalculationResult route = routeService.calculateOptimalRoute(
            request.getPickupLocation(),
            request.getDestination()
        );
        
        PricingResult pricing = pricingService.calculateFare(
            route.getDistance(),
            route.getEstimatedDuration(),
            request.getRequestedTime() // Surge pricing consideration
        );
        
        // Step 3: Pre-authorize payment
        PaymentAuthResult paymentAuth = paymentService.authorizePayment(
            request.getUserId(),
            pricing.getEstimatedFare()
        );
        
        // Step 4: Create trip record
        Trip trip = tripService.createTrip(
            request,
            driverResult.getDriverId(),
            route,
            pricing,
            paymentAuth.getAuthorizationId()
        );
        
        // Step 5: Notify driver and user
        notificationService.notifyDriver(driverResult.getDriverId(), trip);
        notificationService.notifyUser(request.getUserId(), trip);
        
        // If any step fails, compensate previous steps
    }
}
```

---

## 🌐 AFTERNOON SESSION: Event Sourcing Basics

### **🧠 Mindset Shift #3: From Storing State to Storing Events**

#### **Study Case: Banking Account Management**
```
Traditional Approach (Store current state):
Account Table:
| account_id | balance | last_updated |
| 12345     | 1500.00 | 2024-01-15   |

Problem: How do you know how the balance became 1500?
- Was it a deposit of 1500?
- Was it 2000 minus 500 withdrawal?
- What about audit trail?
- How to replay transactions?

Event Sourcing Approach (Store all events):
Account_Events Table:
| event_id | account_id | event_type | amount | timestamp | metadata |
| 1        | 12345     | OPENED     | 0      | 2024-01-01| {}       |
| 2        | 12345     | DEPOSITED  | 1000   | 2024-01-05| {...}    |
| 3        | 12345     | DEPOSITED  | 750    | 2024-01-10| {...}    |
| 4        | 12345     | WITHDRAWN  | 250    | 2024-01-15| {...}    |

Current balance = sum of all events = 0 + 1000 + 750 - 250 = 1500
```

#### **💡 Study Case: GitLab's Issue Tracking**
```
Why GitLab uses Event Sourcing for issues:
- Perfect audit trail: Who changed what and when
- Time travel: See issue state at any point in history
- Debugging: Replay events to reproduce bugs
- Analytics: Analyze patterns in issue lifecycle

Events for Issue #1234:
1. IssueCreated(title="Login bug", assignee="john")
2. IssueAssigned(assignee="jane") 
3. LabelAdded(label="bug")
4. CommentAdded(text="Can't reproduce")
5. IssueClosed(reason="Fixed in PR #567")

Current state = replay all events in order
```

#### **🔥 Event Sourcing Implementation**

**Event Store Design:**
```java
@Entity
@Table(name = "account_events")
public class AccountEvent {
    
    @Id
    private String eventId;
    
    private String accountId;
    private String eventType;
    private String eventData; // JSON payload
    private LocalDateTime timestamp;
    private Long version; // For optimistic concurrency
    private String userId; // Who triggered the event
    private String correlationId; // For tracing
    
    // Constructors, getters, setters
}

// Event types as classes
public abstract class AccountEventData {
    public abstract String getEventType();
}

public class AccountOpenedEvent extends AccountEventData {
    private String accountId;
    private String ownerId;
    private String accountType;
    private BigDecimal initialBalance;
    
    @Override
    public String getEventType() { return "ACCOUNT_OPENED"; }
}

public class MoneyDepositedEvent extends AccountEventData {
    private String accountId;
    private BigDecimal amount;
    private String description;
    private String transactionId;
    
    @Override
    public String getEventType() { return "MONEY_DEPOSITED"; }
}

public class MoneyWithdrawnEvent extends AccountEventData {
    private String accountId;
    private BigDecimal amount;
    private String description;
    private String transactionId;
    
    @Override
    public String getEventType() { return "MONEY_WITHDRAWN"; }
}
```

**Event Store Service:**
```java
@Service
public class EventStore {
    
    private final AccountEventRepository eventRepository;
    private final ObjectMapper objectMapper;
    
    public void saveEvent(String accountId, AccountEventData eventData, String userId) {
        // Get current version for optimistic locking
        Long currentVersion = eventRepository.findMaxVersionByAccountId(accountId)
            .orElse(0L);
            
        AccountEvent event = new AccountEvent();
        event.setEventId(UUID.randomUUID().toString());
        event.setAccountId(accountId);
        event.setEventType(eventData.getEventType());
        event.setEventData(serializeEventData(eventData));
        event.setTimestamp(LocalDateTime.now());
        event.setVersion(currentVersion + 1);
        event.setUserId(userId);
        event.setCorrelationId(getCurrentCorrelationId());
        
        try {
            eventRepository.save(event);
            
            // Publish event for projections/read models
            eventPublisher.publishEvent(new AccountEventStored(event));
            
        } catch (DataIntegrityViolationException e) {
            throw new ConcurrentModificationException(
                "Account was modified by another process"
            );
        }
    }
    
    public List<AccountEvent> getEvents(String accountId) {
        return eventRepository.findByAccountIdOrderByVersion(accountId);
    }
    
    public List<AccountEvent> getEventsAfterVersion(String accountId, Long version) {
        return eventRepository.findByAccountIdAndVersionGreaterThanOrderByVersion(
            accountId, version
        );
    }
}
```

**Account Aggregate (Business Logic):**
```java
@Component
public class AccountAggregate {
    
    private final EventStore eventStore;
    
    public void openAccount(String accountId, String ownerId, BigDecimal initialBalance) {
        // Business rule: Initial balance must be >= 0
        if (initialBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Initial balance cannot be negative");
        }
        
        AccountOpenedEvent event = new AccountOpenedEvent(
            accountId, ownerId, "CHECKING", initialBalance
        );
        
        eventStore.saveEvent(accountId, event, getCurrentUserId());
    }
    
    public void deposit(String accountId, BigDecimal amount, String description) {
        // Business rule: Deposit amount must be positive
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Deposit amount must be positive");
        }
        
        MoneyDepositedEvent event = new MoneyDepositedEvent(
            accountId, amount, description, generateTransactionId()
        );
        
        eventStore.saveEvent(accountId, event, getCurrentUserId());
    }
    
    public void withdraw(String accountId, BigDecimal amount, String description) {
        // Business rule: Must have sufficient balance
        AccountState currentState = getCurrentAccountState(accountId);
        
        if (currentState.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException(
                "Insufficient balance. Current: " + currentState.getBalance() + 
                ", Requested: " + amount
            );
        }
        
        MoneyWithdrawnEvent event = new MoneyWithdrawnEvent(
            accountId, amount, description, generateTransactionId()
        );
        
        eventStore.saveEvent(accountId, event, getCurrentUserId());
    }
    
    private AccountState getCurrentAccountState(String accountId) {
        List<AccountEvent> events = eventStore.getEvents(accountId);
        return replayEvents(events);
    }
    
    private AccountState replayEvents(List<AccountEvent> events) {
        AccountState state = new AccountState();
        
        for (AccountEvent event : events) {
            switch (event.getEventType()) {
                case "ACCOUNT_OPENED":
                    AccountOpenedEvent opened = deserialize(event.getEventData(), AccountOpenedEvent.class);
                    state.setAccountId(opened.getAccountId());
                    state.setOwnerId(opened.getOwnerId());
                    state.setBalance(opened.getInitialBalance());
                    state.setStatus("ACTIVE");
                    break;
                    
                case "MONEY_DEPOSITED":
                    MoneyDepositedEvent deposited = deserialize(event.getEventData(), MoneyDepositedEvent.class);
                    state.setBalance(state.getBalance().add(deposited.getAmount()));
                    break;
                    
                case "MONEY_WITHDRAWN":
                    MoneyWithdrawnEvent withdrawn = deserialize(event.getEventData(), MoneyWithdrawnEvent.class);
                    state.setBalance(state.getBalance().subtract(withdrawn.getAmount()));
                    break;
            }
        }
        
        return state;
    }
}
```

#### **📊 Projections for Performance**

**Read Model (Projection):**
```java
// For fast queries, maintain read models/projections
@Entity
@Table(name = "account_balance_projection")
public class AccountBalanceProjection {
    
    @Id
    private String accountId;
    private String ownerId;
    private BigDecimal currentBalance;
    private Long lastProcessedVersion;
    private LocalDateTime lastUpdated;
    
    // getters, setters
}

@Component
public class AccountProjectionHandler {
    
    private final AccountBalanceProjectionRepository projectionRepository;
    
    @EventListener
    public void handleAccountEventStored(AccountEventStored eventStored) {
        AccountEvent event = eventStored.getEvent();
        
        AccountBalanceProjection projection = projectionRepository
            .findById(event.getAccountId())
            .orElse(new AccountBalanceProjection(event.getAccountId()));
            
        // Update projection based on event type
        switch (event.getEventType()) {
            case "ACCOUNT_OPENED":
                AccountOpenedEvent opened = deserialize(event.getEventData());
                projection.setOwnerId(opened.getOwnerId());
                projection.setCurrentBalance(opened.getInitialBalance());
                break;
                
            case "MONEY_DEPOSITED":
                MoneyDepositedEvent deposited = deserialize(event.getEventData());
                projection.setCurrentBalance(
                    projection.getCurrentBalance().add(deposited.getAmount())
                );
                break;
                
            case "MONEY_WITHDRAWN":
                MoneyWithdrawnEvent withdrawn = deserialize(event.getEventData());
                projection.setCurrentBalance(
                    projection.getCurrentBalance().subtract(withdrawn.getAmount())
                );
                break;
        }
        
        projection.setLastProcessedVersion(event.getVersion());
        projection.setLastUpdated(LocalDateTime.now());
        
        projectionRepository.save(projection);
    }
}

// Fast balance queries using projection
@Service
public class AccountQueryService {
    
    public BigDecimal getAccountBalance(String accountId) {
        // O(1) query instead of replaying all events
        return projectionRepository.findById(accountId)
            .map(AccountBalanceProjection::getCurrentBalance)
            .orElse(BigDecimal.ZERO);
    }
    
    public List<AccountSummary> getAccountsByOwner(String ownerId) {
        // Fast query with indexed projection
        return projectionRepository.findByOwnerId(ownerId)
            .stream()
            .map(this::mapToSummary)
            .collect(Collectors.toList());
    }
}
```

---

## 🌉 EVENING SESSION: API Gateway Implementation

### **🧠 Mindset Shift #4: From Direct Service Access to Centralized Gateway**

#### **Study Case: Netflix's Zuul Gateway**
```
Before API Gateway (Chaos):
Mobile App → User Service (direct)
Mobile App → Movie Service (direct)  
Mobile App → Recommendation Service (direct)
Web App → All services (different endpoints)

Problems:
- Clients need to know all service locations
- No centralized authentication
- No rate limiting per client
- No request/response transformation
- Difficult to monitor and debug

After API Gateway (Order):
All Clients → API Gateway → Internal Services

Benefits:
- Single entry point
- Centralized cross-cutting concerns
- Service discovery abstraction
- Protocol translation (HTTP → gRPC)
- Request/response aggregation
```

#### **🔥 Spring Cloud Gateway Implementation**

**Basic Gateway Configuration:**
```yaml
# application.yml
spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/v1/users/**
          filters:
            - name: CircuitBreaker
              args:
                name: user-service-cb
                fallbackUri: forward:/fallback/users
            - name: RequestRateLimiter
              args:
                redis-rate-limiter.replenishRate: 10
                redis-rate-limiter.burstCapacity: 20
                key-resolver: "#{@userKeyResolver}"
                
        - id: product-service
          uri: lb://product-service
          predicates:
            - Path=/api/v1/products/**
          filters:
            - name: AddRequestHeader
              args:
                name: X-Service-Name
                value: product-service
            - name: ModifyResponseBody
              args:
                inClass: java.lang.String
                outClass: java.lang.String
                
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/v1/orders/**
          filters:
            - name: AuthenticationFilter
            - name: Retry
              args:
                retries: 3
                methods: GET,POST
                
      default-filters:
        - name: AddRequestHeader
          args:
            name: X-Gateway-Request-Id
            value: "#{T(java.util.UUID).randomUUID().toString()}"
        - name: AddRequestHeader
          args:
            name: X-Request-Time
            value: "#{T(java.time.LocalDateTime).now()}"
```

**Custom Gateway Filters:**
```java
@Component
public class AuthenticationFilter implements GatewayFilter, Ordered {
    
    private final JwtTokenValidator jwtValidator;
    private final UserService userService;
    
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        
        // Extract JWT token from Authorization header
        String token = extractToken(request);
        
        if (token == null) {
            return handleUnauthorized(exchange);
        }
        
        try {
            // Validate JWT token
            Claims claims = jwtValidator.validateToken(token);
            String userId = claims.getSubject();
            
            // Add user context to request headers
            ServerHttpRequest modifiedRequest = request.mutate()
                .header("X-User-Id", userId)
                .header("X-User-Role", claims.get("role", String.class))
                .header("X-User-Email", claims.get("email", String.class))
                .build();
                
            return chain.filter(exchange.mutate().request(modifiedRequest).build());
            
        } catch (JwtException e) {
            return handleUnauthorized(exchange);
        }
    }
    
    private Mono<Void> handleUnauthorized(ServerWebExchange exchange) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        
        String body = """
            {
                "error": "UNAUTHORIZED",
                "message": "Valid authentication token required",
                "timestamp": "%s"
            }
            """.formatted(LocalDateTime.now());
            
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes());
        return response.writeWith(Mono.just(buffer));
    }
    
    @Override
    public int getOrder() {
        return -100; // Execute before other filters
    }
}

@Component
public class RequestLoggingFilter implements GlobalFilter, Ordered {
    
    private static final Logger logger = LoggerFactory.getLogger(RequestLoggingFilter.class);
    
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        
        String requestId = request.getHeaders().getFirst("X-Gateway-Request-Id");
        String method = request.getMethod().name();
        String path = request.getPath().value();
        String userAgent = request.getHeaders().getFirst("User-Agent");
        
        // Log incoming request
        logger.info("Gateway Request: {} {} {} - RequestId: {}, UserAgent: {}", 
            method, path, request.getRemoteAddress(), requestId, userAgent);
            
        long startTime = System.currentTimeMillis();
        
        return chain.filter(exchange).doFinally(signalType -> {
            long duration = System.currentTimeMillis() - startTime;
            int statusCode = exchange.getResponse().getStatusCode().value();
            
            // Log outgoing response
            logger.info("Gateway Response: {} {} - Status: {}, Duration: {}ms, RequestId: {}", 
                method, path, statusCode, duration, requestId);
        });
    }
    
    @Override
    public int getOrder() {
        return -200; // Execute first
    }
}
```

**Rate Limiting with Redis:**
```java
@Configuration
public class GatewayConfig {
    
    @Bean
    @Primary
    public KeyResolver userKeyResolver() {
        return exchange -> {
            // Rate limit per user
            String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
            if (userId != null) {
                return Mono.just(userId);
            }
            
            // Fallback to IP-based rate limiting
            String clientIp = getClientIp(exchange.getRequest());
            return Mono.just(clientIp);
        };
    }
    
    @Bean
    public KeyResolver pathKeyResolver() {
        return exchange -> {
            // Rate limit per API path
            String path = exchange.getRequest().getPath().value();
            return Mono.just(path);
        };
    }
    
    @Bean
    public RedisRateLimiter redisRateLimiter() {
        return new RedisRateLimiter(
            10,  // replenishRate: tokens per second
            20,  // burstCapacity: maximum tokens in bucket
            1    // requestedTokens: tokens per request
        );
    }
}
```

#### **🎯 Real-World Example: Shopee's API Gateway**

**Request Aggregation Pattern:**
```java
@RestController
@RequestMapping("/api/v1/aggregated")
public class AggregatedController {
    
    private final UserServiceClient userService;
    private final ProductServiceClient productService;
    private final OrderServiceClient orderService;
    private final RecommendationServiceClient recommendationService;
    
    @GetMapping("/homepage/{userId}")
    public Mono<HomepageResponse> getHomepage(@PathVariable String userId) {
        
        // Parallel calls to multiple services
        Mono<UserProfileDTO> userProfile = userService.getUserProfile(userId)
            .onErrorResume(ex -> Mono.just(getDefaultProfile()));
            
        Mono<List<ProductDTO>> recommendedProducts = recommendationService
            .getRecommendedProducts(userId)
            .onErrorResume(ex -> Mono.just(getDefaultProducts()));
            
        Mono<List<OrderDTO>> recentOrders = orderService.getRecentOrders(userId)
            .onErrorResume(ex -> Mono.just(List.of()));
            
        Mono<List<ProductDTO>> trendingProducts = productService.getTrendingProducts()
            .onErrorResume(ex -> Mono.just(List.of()));
        
        // Combine all responses
        return Mono.zip(userProfile, recommendedProducts, recentOrders, trendingProducts)
            .map(tuple -> new HomepageResponse(
                tuple.getT1(), // user profile
                tuple.getT2(), // recommended products
                tuple.getT3(), // recent orders
                tuple.getT4()  // trending products
            ));
    }
}
```

**Circuit Breaker with Fallback:**
```java
@Component
public class FallbackController {
    
    @RequestMapping("/fallback/users/**")
    public Mono<ResponseEntity<String>> userServiceFallback(ServerHttpRequest request) {
        return Mono.just(ResponseEntity.ok("""
            {
                "error": "USER_SERVICE_UNAVAILABLE",
                "message": "User service is temporarily unavailable. Please try again later.",
                "fallback": true,
                "timestamp": "%s"
            }
            """.formatted(LocalDateTime.now())
        ));
    }
    
    @RequestMapping("/fallback/products/**")
    public Mono<ResponseEntity<String>> productServiceFallback() {
        return Mono.just(ResponseEntity.ok("""
            {
                "products": [],
                "error": "PRODUCT_SERVICE_UNAVAILABLE",
                "message": "Product catalog is temporarily unavailable.",
                "fallback": true
            }
            """
        ));
    }
}
```

---

## 📝 DAY 3 CHALLENGE PROJECT

### **Build: Microservices E-commerce Platform**

**Architecture Overview:**
```
API Gateway → Circuit Breaker → Services
├── User Service (Authentication, Profile)
├── Product Service (Catalog, Search)  
├── Order Service (Cart, Checkout)
├── Payment Service (Processing, Refunds)
├── Inventory Service (Stock Management)
└── Notification Service (Email, SMS)
```

**Implementation Requirements:**

1. **Circuit Breaker Pattern:**
   - Implement in User Service calling external auth provider
   - Configure thresholds and fallback strategies
   - Add health check endpoints

2. **Saga Pattern:**
   - Order processing saga across 4 services
   - Both orchestrator and choreography patterns
   - Proper compensation actions

3. **Event Sourcing:**
   - User account management with event store
   - Order status tracking with events
   - Read model projections for performance

4. **API Gateway:**
   - Single entry point for all services
   - JWT authentication and authorization
   - Rate limiting per user and endpoint
   - Request/response aggregation for mobile

---

## 🎯 DAY 3 COMPLETION CHECKLIST

### **Morning Session - Circuit Breaker:**
- [ ] Configure Resilience4j circuit breaker
- [ ] Implement meaningful fallback methods
- [ ] Add monitoring and health indicators
- [ ] Test failure scenarios and recovery

### **Afternoon Session - Saga & Event Sourcing:**
- [ ] Design saga for order processing
- [ ] Implement event store with proper versioning
- [ ] Create read model projections
- [ ] Handle concurrent modifications

### **Evening Session - API Gateway:**
- [ ] Configure Spring Cloud Gateway routes
- [ ] Implement authentication filter
- [ ] Add rate limiting with Redis
- [ ] Create request aggregation endpoints

---

## 🧠 DAY 3 REFLECTION QUESTIONS

1. **Resilience:** How do circuit breakers change your approach to service failures?
2. **Consistency:** When would you choose saga over traditional transactions?
3. **Auditability:** What are the trade-offs of event sourcing vs traditional CRUD?
4. **Architecture:** How does an API gateway simplify client-service interactions?

---

## 📚 STUDY CASES FOR MASTERY

### **🎯 Netflix's Hystrix → Resilience4j Migration**
```
Challenge: Netflix moved from Hystrix to Resilience4j
- Why did they migrate?
- What problems did Resilience4j solve?
- How did they handle the transition?
- What lessons can we learn?
```

### **🏗️ Amazon's Eventual Consistency Strategy**
```
Problem: Amazon's shopping cart with millions of users
- How do they handle concurrent cart updates?
- What's their strategy for inventory reservation?
- How do they ensure order processing reliability?
- When do they choose consistency vs availability?
```

---

**📅 Tomorrow: DAY 4 - Security, Authentication & Production Monitoring**

**🎯 Coming up:**
- OAuth2 and JWT implementation
- Role-based access control (RBAC)
- Distributed tracing with Zipkin
- Metrics and monitoring strategies
- Production debugging techniques

---

**💡 Senior Engineer Insight:** Today you learned that distributed systems aren't just about splitting monoliths - they're about designing for failure, embracing eventual consistency, and building systems that gracefully degrade under pressure. These patterns separate junior developers who build features from senior engineers who build resilient systems.
# 🚀 DAY 2: ADVANCED JAVA CONCEPTS & TESTING
## Building on Your Foundation - Real-World Patterns

---

## 📅 DAY 2 OVERVIEW

**Yesterday's Achievements:** ✅ Java basics, Spring Boot setup, basic CRUD, dependency injection  
**Today's Focus:** Advanced JPA relationships, testing strategies, and production-ready patterns  
**Tomorrow's Preview:** Security, authentication, and microservices patterns

---

## 🌅 MORNING SESSION: Advanced JPA & Database Relationships

### **🧠 Mindset Shift #2: From NoSQL to Relational Thinking**

#### **Study Case: E-commerce Product Catalog**
```
Business Problem: Design a product system like Shopee/Amazon
- Products belong to categories
- Products have multiple images
- Products have reviews from users
- Categories can be nested (Electronics > Smartphones > iPhone)
```

**TypeScript/MongoDB Approach:**
```typescript
interface Product {
  id: string;
  name: string;
  category: string; // Just store category name
  images: string[]; // Array of image URLs
  reviews: Review[]; // Embedded reviews
}
```

**Java/JPA Relational Approach:**
```java
@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;
    private BigDecimal price;
    
    // Many products belong to one category
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;
    
    // One product has many images
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProductImage> images = new ArrayList<>();
    
    // One product has many reviews
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL)
    private List<Review> reviews = new ArrayList<>();
    
    // Constructors, getters, setters...
}

@Entity
public class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;
    
    // Self-referencing for nested categories
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Category parent;
    
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    private List<Category> children = new ArrayList<>();
    
    @OneToMany(mappedBy = "category")
    private List<Product> products = new ArrayList<>();
}

@Entity
public class ProductImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String imageUrl;
    private String altText;
    private Integer sortOrder;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;
}
```

#### **⚠️ Common Mistake #2: The N+1 Query Trap**
```java
// WRONG: This will cause N+1 queries
public List<ProductDTO> getAllProducts() {
    List<Product> products = productRepository.findAll(); // 1 query
    return products.stream()
        .map(product -> new ProductDTO(
            product.getName(),
            product.getCategory().getName(), // N queries here!
            product.getImages().size() // N more queries!
        ))
        .collect(Collectors.toList());
}

// RIGHT: Use fetch joins to solve N+1
@Query("SELECT p FROM Product p " +
       "JOIN FETCH p.category " +
       "LEFT JOIN FETCH p.images " +
       "WHERE p.active = true")
List<Product> findAllActiveWithDetails();
```

#### **💡 Study Case: Shopee's Product Loading Strategy**
```
Real-World Problem: Shopee displays 20 products per page with:
- Product name, price
- Category name  
- First image thumbnail
- Review count

How do they avoid N+1 queries for millions of products?

Solution: Strategic data denormalization
```

```java
@Entity
public class Product {
    // Normal fields...
    
    // Denormalized fields for performance
    @Column(name = "category_name") // Duplicate category name
    private String categoryName;
    
    @Column(name = "primary_image_url") // Cache first image
    private String primaryImageUrl;
    
    @Column(name = "review_count") // Cache review count
    private Integer reviewCount;
    
    @Column(name = "average_rating") // Cache average rating
    private Double averageRating;
}

// Update denormalized data when source changes
@EventListener
public void handleCategoryNameChanged(CategoryNameChangedEvent event) {
    productRepository.updateCategoryName(event.getCategoryId(), event.getNewName());
}
```

---

## 🌆 EVENING SESSION: Testing Strategies & Production Patterns

### **🧠 Mindset Shift #3: Test Pyramid in Java**

#### **Study Case: Testing Like Netflix**
```
Netflix's Testing Philosophy:
1. Unit Tests (70%): Fast, isolated, test business logic
2. Integration Tests (20%): Test component interactions
3. End-to-End Tests (10%): Critical user journeys only

Why? Because debugging failed E2E tests in production is expensive!
```

**TypeScript/Jest Testing:**
```typescript
describe('UserService', () => {
  it('should create user', async () => {
    const user = await userService.create({
      email: 'test@example.com',
      name: 'Test User'
    });
    expect(user.id).toBeDefined();
  });
});
```

**Java/JUnit 5 Testing:**
```java
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {
    
    @Mock
    private ProductRepository productRepository;
    
    @Mock
    private CategoryRepository categoryRepository;
    
    @InjectMocks
    private ProductService productService;
    
    @Test
    @DisplayName("Should create product with valid category")
    void shouldCreateProductWithValidCategory() {
        // Given
        Long categoryId = 1L;
        Category category = new Category("Electronics");
        CreateProductRequest request = new CreateProductRequest(
            "iPhone 15", categoryId, BigDecimal.valueOf(999.99)
        );
        
        when(categoryRepository.findById(categoryId))
            .thenReturn(Optional.of(category));
        when(productRepository.save(any(Product.class)))
            .thenAnswer(invocation -> {
                Product product = invocation.getArgument(0);
                product.setId(1L);
                return product;
            });
        
        // When
        ProductDTO result = productService.createProduct(request);
        
        // Then
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("iPhone 15");
        assertThat(result.getCategoryName()).isEqualTo("Electronics");
        
        verify(productRepository).save(argThat(product -> 
            product.getName().equals("iPhone 15") &&
            product.getCategory().equals(category)
        ));
    }
    
    @Test
    @DisplayName("Should throw exception when category not found")
    void shouldThrowExceptionWhenCategoryNotFound() {
        // Given
        Long categoryId = 999L;
        CreateProductRequest request = new CreateProductRequest(
            "iPhone 15", categoryId, BigDecimal.valueOf(999.99)
        );
        
        when(categoryRepository.findById(categoryId))
            .thenReturn(Optional.empty());
        
        // When & Then
        assertThatThrownBy(() -> productService.createProduct(request))
            .isInstanceOf(CategoryNotFoundException.class)
            .hasMessage("Category not found with id: 999");
        
        verify(productRepository, never()).save(any());
    }
}
```

#### **⚠️ Testing Mistake #2: Not Testing Edge Cases**
```java
// INCOMPLETE: Only tests happy path
@Test
void shouldCalculateDiscount() {
    BigDecimal price = BigDecimal.valueOf(100);
    BigDecimal discount = priceService.calculateDiscount(price, 10);
    assertThat(discount).isEqualTo(BigDecimal.valueOf(10));
}

// COMPLETE: Tests edge cases too
@ParameterizedTest
@CsvSource({
    "100.00, 10, 10.00",      // Normal case
    "100.00, 0, 0.00",        // Zero discount
    "100.00, 100, 100.00",    // Full discount
    "0.01, 50, 0.01"          // Minimum price
})
void shouldCalculateDiscountCorrectly(BigDecimal price, int percentage, BigDecimal expected) {
    BigDecimal discount = priceService.calculateDiscount(price, percentage);
    assertThat(discount).isEqualByComparingTo(expected);
}

@Test
void shouldThrowExceptionForNegativePrice() {
    assertThatThrownBy(() -> 
        priceService.calculateDiscount(BigDecimal.valueOf(-1), 10)
    ).isInstanceOf(IllegalArgumentException.class);
}
```

#### **🎯 Integration Testing Pattern**
```java
@SpringBootTest
@TestContainers
@Transactional
class ProductServiceIntegrationTest {
    
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");
    
    @Autowired
    private ProductService productService;
    
    @Autowired
    private TestEntityManager entityManager;
    
    @Test
    @DisplayName("Should save product with images to database")
    void shouldSaveProductWithImages() {
        // Given
        Category category = new Category("Electronics");
        entityManager.persistAndFlush(category);
        
        CreateProductRequest request = new CreateProductRequest(
            "iPhone 15", category.getId(), BigDecimal.valueOf(999.99)
        );
        request.setImageUrls(List.of(
            "https://example.com/image1.jpg",
            "https://example.com/image2.jpg"
        ));
        
        // When
        ProductDTO result = productService.createProduct(request);
        
        // Then
        Product savedProduct = entityManager.find(Product.class, result.getId());
        assertThat(savedProduct).isNotNull();
        assertThat(savedProduct.getImages()).hasSize(2);
        assertThat(savedProduct.getImages().get(0).getImageUrl())
            .isEqualTo("https://example.com/image1.jpg");
    }
}
```

#### **💡 Study Case: Spotify's Testing Strategy**
```
Spotify's Backend Testing Approach:

1. Unit Tests: Business logic in isolation
   - Service methods with mocked dependencies
   - Domain object behaviors
   - Utility functions

2. Component Tests: Single service with real database
   - Use TestContainers for real PostgreSQL
   - Test repository queries
   - Test transaction boundaries

3. Contract Tests: Service-to-service communication
   - API contract verification
   - Schema validation
   - Backward compatibility

4. Chaos Engineering: Resilience testing
   - Kill random services
   - Simulate network failures
   - Database connection timeouts
```

### **🎯 Production-Ready Patterns**

#### **Pattern #1: Repository Pattern with Specifications**
```java
// Complex query building without string concatenation
public interface ProductSpecification {
    static Specification<Product> hasName(String name) {
        return (root, query, criteriaBuilder) ->
            name == null ? null : 
            criteriaBuilder.like(root.get("name"), "%" + name + "%");
    }
    
    static Specification<Product> inCategory(Long categoryId) {
        return (root, query, criteriaBuilder) ->
            categoryId == null ? null :
            criteriaBuilder.equal(root.get("category").get("id"), categoryId);
    }
    
    static Specification<Product> priceBetween(BigDecimal min, BigDecimal max) {
        return (root, query, criteriaBuilder) -> {
            if (min == null && max == null) return null;
            if (min == null) return criteriaBuilder.lessThanOrEqualTo(root.get("price"), max);
            if (max == null) return criteriaBuilder.greaterThanOrEqualTo(root.get("price"), min);
            return criteriaBuilder.between(root.get("price"), min, max);
        };
    }
}

@Service
public class ProductService {
    
    public Page<Product> searchProducts(ProductSearchCriteria criteria, Pageable pageable) {
        Specification<Product> spec = Specification.where(null);
        
        if (criteria.getName() != null) {
            spec = spec.and(ProductSpecification.hasName(criteria.getName()));
        }
        if (criteria.getCategoryId() != null) {
            spec = spec.and(ProductSpecification.inCategory(criteria.getCategoryId()));
        }
        if (criteria.getMinPrice() != null || criteria.getMaxPrice() != null) {
            spec = spec.and(ProductSpecification.priceBetween(
                criteria.getMinPrice(), criteria.getMaxPrice()));
        }
        
        return productRepository.findAll(spec, pageable);
    }
}
```

#### **Pattern #2: Event-Driven Architecture**
```java
// Domain events for loose coupling
@Entity
public class Product extends AuditableEntity {
    
    @DomainEvents
    Collection<Object> domainEvents() {
        return Arrays.asList(
            new ProductCreatedEvent(this.id, this.name, this.category.getId()),
            new InventoryUpdateRequiredEvent(this.id, this.initialStock)
        );
    }
}

@Component
public class ProductEventHandler {
    
    @EventListener
    @Async
    public void handleProductCreated(ProductCreatedEvent event) {
        // Update search index
        searchIndexService.indexProduct(event.getProductId());
        
        // Send notification to inventory service
        inventoryService.createInventoryRecord(event.getProductId());
        
        // Update analytics
        analyticsService.trackProductCreation(event.getCategoryId());
    }
    
    @EventListener
    @Transactional
    public void handleInventoryUpdate(InventoryUpdateRequiredEvent event) {
        inventoryRepository.createInitialStock(
            event.getProductId(), 
            event.getInitialQuantity()
        );
    }
}
```

---

## 🌐 BONUS SESSION: Service Decomposition Strategies

### **🧠 Mindset Shift #4: From Monolith to Microservices**

#### **Study Case: Evolving from Monolithic E-commerce**
```
Monolithic Structure (What you know):
src/
├── modules/
│   ├── users/
│   ├── products/
│   ├── orders/
│   ├── payments/
│   └── notifications/
└── shared/
    ├── database/
    └── config/

Challenge: As business grows
- 100+ developers working on same codebase
- Deploy cycle takes 2 hours (full system restart)
- One bug in orders module breaks entire system
- Scaling payment processing requires scaling everything
```

#### **💡 Study Case: Netflix's Service Evolution**
```
2008: Netflix was a monolith
- DVD rental system
- Single Rails application
- 30 engineers

2015: Netflix became 700+ microservices
- Streaming platform
- Each service owns specific business capability
- 2000+ engineers

Key insight: They didn't start with microservices, they evolved into them!
```

#### **🔥 Decomposition Strategy #1: Decompose by Business Capability**

**Strategy Overview:**
```
Instead of technical layers (controllers, services, repositories)
Think in business domains (user management, catalog, ordering)

Business Capabilities for E-commerce:
├── User Management (Authentication, Profile, Preferences)
├── Product Catalog (Search, Categories, Inventory)
├── Order Processing (Cart, Checkout, Payment)
├── Shipping & Fulfillment (Tracking, Delivery)
├── Customer Support (Tickets, Chat, Reviews)
└── Analytics & Reporting (Sales, User behavior)
```

**Java Implementation:**
```java
// BEFORE: Monolithic structure
@RestController
@RequestMapping("/api")
public class EcommerceController {
    
    @Autowired UserService userService;
    @Autowired ProductService productService;
    @Autowired OrderService orderService;
    @Autowired PaymentService paymentService;
    
    // All endpoints in one controller = tight coupling
}

// AFTER: Decomposed by business capability

// User Service (Separate microservice)
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    
    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUser(@PathVariable String id) {
        // Only handles user-related operations
    }
    
    @PostMapping("/authenticate")
    public ResponseEntity<AuthTokenDTO> authenticate(@RequestBody LoginRequest request) {
        // Authentication logic
    }
}

// Product Service (Separate microservice)
@RestController  
@RequestMapping("/api/v1/products")
public class ProductController {
    
    @GetMapping("/search")
    public ResponseEntity<Page<ProductDTO>> searchProducts(
        @RequestParam String query,
        @RequestParam(required = false) String category,
        Pageable pageable
    ) {
        // Product catalog operations only
    }
}

// Order Service (Separate microservice)
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
    
    @PostMapping
    public ResponseEntity<OrderDTO> createOrder(@RequestBody CreateOrderRequest request) {
        // Coordinates with other services via APIs/events
        UserDTO user = userServiceClient.getUser(request.getUserId());
        List<ProductDTO> products = productServiceClient.getProducts(request.getProductIds());
        
        return ResponseEntity.ok(orderService.createOrder(request, user, products));
    }
}
```

#### **🎯 Decomposition Strategy #2: Domain-Driven Design (DDD)**

**Study Case: Shopee's Domain Model**
```java
// Identify Bounded Contexts
// Each context becomes a potential microservice

// User Context
@Entity
@Table(name = "users")
public class User {
    private String userId;
    private String email;
    private String hashedPassword;
    private UserProfile profile;
    private List<Address> addresses;
    // User-specific behavior only
}

// Product Context  
@Entity
@Table(name = "products")
public class Product {
    private String productId;
    private String name;
    private String description;
    private BigDecimal price;
    private Category category;
    private Inventory inventory;
    // Product-specific behavior only
}

// Order Context
@Entity
@Table(name = "orders") 
public class Order {
    private String orderId;
    private String customerId; // Reference to User, not embedded
    private List<OrderLine> orderLines;
    private OrderStatus status;
    private ShippingAddress shippingAddress;
    
    // Order-specific business rules
    public void validateOrder() {
        if (orderLines.isEmpty()) {
            throw new EmptyOrderException();
        }
        // Complex order validation logic
    }
}

// Each bounded context has its own representation of concepts
// User service knows User details
// Order service only knows customerId (reference)
```

#### **⚠️ Decomposition Anti-Pattern: Distributed Monolith**

**Common Mistake: Chatty Services**
```java
// WRONG: Too many service calls for simple operation
@Service
public class OrderService {
    
    public OrderDTO createOrder(CreateOrderRequest request) {
        // 10+ service calls for one operation!
        UserDTO user = userService.getUser(request.getUserId());
        AddressDTO address = addressService.getAddress(user.getDefaultAddressId());
        
        for (OrderLineRequest line : request.getOrderLines()) {
            ProductDTO product = productService.getProduct(line.getProductId());
            InventoryDTO inventory = inventoryService.checkStock(line.getProductId());
            PricingDTO pricing = pricingService.getPrice(line.getProductId(), user.getTier());
            // Each call = network latency + failure point
        }
        
        // Network calls dominate processing time
        return new OrderDTO();
    }
}

// BETTER: Aggregate necessary data, reduce calls
@Service
public class OrderService {
    
    public OrderDTO createOrder(CreateOrderRequest request) {
        // Batch operations where possible
        List<String> productIds = request.getOrderLines().stream()
            .map(OrderLineRequest::getProductId)
            .collect(Collectors.toList());
            
        // Single call for multiple products
        List<ProductDTO> products = productService.getProducts(productIds);
        UserDTO user = userService.getUser(request.getUserId());
        
        // Process locally
        return orderProcessor.process(request, user, products);
    }
}
```

#### **🚀 Real-World Decomposition Example: Grab**

**Grab's Service Evolution:**
```
2012: Taxi booking monolith
├── User registration
├── Driver management  
├── Ride matching
├── Payment processing
└── Notification system

2018: 300+ microservices
├── User Service (Profile, Authentication)
├── Driver Service (Onboarding, Documents)
├── Location Service (GPS tracking, Maps)
├── Matching Service (Supply-demand algorithm)
├── Pricing Service (Surge pricing, Discounts)
├── Payment Service (Cards, Wallets, Banking)
├── Trip Service (Booking, Status, History)
├── Notification Service (SMS, Push, Email)
└── Analytics Service (Data pipeline, ML)
```

**Java Implementation - Location Service:**
```java
// Location Service - Single responsibility
@RestController
@RequestMapping("/api/v1/locations")
public class LocationController {
    
    // Real-time driver location updates
    @PostMapping("/drivers/{driverId}/position")
    public ResponseEntity<Void> updateDriverLocation(
        @PathVariable String driverId,
        @RequestBody LocationUpdate update
    ) {
        locationService.updateDriverLocation(driverId, update);
        
        // Publish event for other services
        eventPublisher.publishEvent(new DriverLocationUpdated(driverId, update));
        
        return ResponseEntity.ok().build();
    }
    
    // Find nearby drivers
    @GetMapping("/drivers/nearby")
    public ResponseEntity<List<NearbyDriverDTO>> findNearbyDrivers(
        @RequestParam Double latitude,
        @RequestParam Double longitude,
        @RequestParam(defaultValue = "5.0") Double radiusKm
    ) {
        return ResponseEntity.ok(
            locationService.findNearbyDrivers(latitude, longitude, radiusKm)
        );
    }
}

@Service
public class LocationService {
    
    private final RedisTemplate<String, String> redisTemplate;
    
    public void updateDriverLocation(String driverId, LocationUpdate update) {
        // Store in Redis for fast geo-queries
        String geoKey = "driver:locations";
        redisTemplate.opsForGeo().add(geoKey, 
            new Point(update.getLongitude(), update.getLatitude()), 
            driverId);
            
        // Update last seen timestamp
        redisTemplate.opsForValue().set(
            "driver:lastseen:" + driverId, 
            String.valueOf(System.currentTimeMillis()),
            Duration.ofMinutes(10)
        );
    }
    
    public List<NearbyDriverDTO> findNearbyDrivers(Double lat, Double lon, Double radius) {
        String geoKey = "driver:locations";
        
        // Redis geospatial query
        GeoResults<RedisGeoCommands.GeoLocation<String>> results = 
            redisTemplate.opsForGeo().radius(geoKey,
                new Circle(new Point(lon, lat), new Distance(radius, Metrics.KILOMETERS)),
                RedisGeoCommands.GeoRadiusCommandArgs.newGeoRadiusArgs()
                    .includeDistance()
                    .includeCoordinates()
                    .sortAscending()
                    .limit(20)
            );
            
        return results.getContent().stream()
            .map(this::mapToNearbyDriverDTO)
            .collect(Collectors.toList());
    }
}
```

#### **📏 Service Size Guidelines (Martin Fowler's Rules)**

**The Two Pizza Rule (Amazon):**
```
"A service team should be small enough that it can be fed with two pizzas"
- 6-8 people maximum per service
- One team owns the entire service lifecycle
- Reduces communication overhead
```

**Single Responsibility Principle for Services:**
```java
// GOOD: PaymentService has one clear responsibility
@Service
public class PaymentService {
    
    public PaymentResult processPayment(PaymentRequest request) {
        // Only payment-related logic
        // Validate payment method
        // Process with payment gateway
        // Handle payment failures
        // Store payment records
    }
    
    public PaymentHistory getPaymentHistory(String userId) {
        // Only payment history retrieval
    }
}

// BAD: Mixed responsibilities
@Service  
public class PaymentAndOrderService {
    
    public PaymentResult processPaymentAndCreateOrder(OrderRequest request) {
        // Payment logic + Order logic = two responsibilities
        // Violates single responsibility principle
        // Makes service harder to maintain and scale
    }
}
```

#### **🌊 Communication Strategy #3: Sync vs Async Patterns**

**Study Case: Uber Ride Booking Flow**
```
Synchronous Operations (Need immediate response):
1. User authentication → Must validate before allowing booking
2. Driver availability check → Need real-time status  
3. Payment authorization → Must confirm before trip starts
4. Trip pricing calculation → User needs to see cost upfront

Asynchronous Operations (Can happen in background):
1. Trip history logging → Can be delayed
2. Analytics data collection → Not user-facing
3. Email notifications → User doesn't wait for email
4. Driver rating aggregation → Background calculation
```

#### **🔄 Synchronous Communication Patterns**

**Pattern #1: HTTP/REST (Request-Response)**
```java
// User Service calling Product Service synchronously
@Service
public class OrderService {
    
    private final ProductServiceClient productServiceClient;
    private final UserServiceClient userServiceClient;
    
    public OrderDTO createOrder(CreateOrderRequest request) {
        // Synchronous call - blocks until response
        UserDTO user = userServiceClient.getUser(request.getUserId());
        
        // Synchronous call - user waits for product validation
        List<ProductDTO> products = productServiceClient.validateProducts(
            request.getProductIds()
        );
        
        // If any service is down, entire operation fails
        if (products.isEmpty()) {
            throw new ProductValidationException("Products not available");
        }
        
        return orderProcessor.createOrder(request, user, products);
    }
}

// Feign Client for service-to-service communication
@FeignClient(name = "product-service", url = "${services.product.url}")
public interface ProductServiceClient {
    
    @GetMapping("/api/v1/products/validate")
    List<ProductDTO> validateProducts(@RequestParam List<String> productIds);
    
    @GetMapping("/api/v1/products/{id}")
    ProductDTO getProduct(@PathVariable String id);
}
```

**Pattern #2: gRPC (High Performance)**
```java
// When you need faster communication than REST
// Protocol Buffers for efficient serialization

// product-service.proto
syntax = "proto3";

service ProductService {
    rpc GetProduct(GetProductRequest) returns (ProductResponse);
    rpc ValidateProducts(ValidateProductsRequest) returns (ValidateProductsResponse);
}

message GetProductRequest {
    string product_id = 1;
}

message ProductResponse {
    string id = 1;
    string name = 2;
    double price = 3;
    bool available = 4;
}

// Java implementation
@Service
public class ProductGrpcService extends ProductServiceGrpc.ProductServiceImplBase {
    
    @Override
    public void getProduct(GetProductRequest request, 
                          StreamObserver<ProductResponse> responseObserver) {
        
        Product product = productRepository.findById(request.getProductId())
            .orElseThrow(() -> new ProductNotFoundException(request.getProductId()));
            
        ProductResponse response = ProductResponse.newBuilder()
            .setId(product.getId())
            .setName(product.getName())
            .setPrice(product.getPrice().doubleValue())
            .setAvailable(product.isAvailable())
            .build();
            
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}

// Client usage
@Service
public class OrderService {
    
    private final ProductServiceGrpc.ProductServiceBlockingStub productServiceStub;
    
    public OrderDTO createOrder(CreateOrderRequest request) {
        // gRPC call - faster than REST
        ProductResponse product = productServiceStub.getProduct(
            GetProductRequest.newBuilder()
                .setProductId(request.getProductId())
                .build()
        );
        
        return processOrder(request, product);
    }
}
```

#### **📡 Asynchronous Communication Patterns**

**Pattern #1: Message Queues (RabbitMQ)**
```java
// Publisher Service - Order Service
@Service
public class OrderService {
    
    private final RabbitTemplate rabbitTemplate;
    
    public OrderDTO createOrder(CreateOrderRequest request) {
        // Create order immediately
        Order order = new Order(request);
        orderRepository.save(order);
        
        // Publish event asynchronously - fire and forget
        OrderCreatedEvent event = new OrderCreatedEvent(
            order.getId(),
            order.getUserId(),
            order.getTotalAmount(),
            order.getItems()
        );
        
        rabbitTemplate.convertAndSend("order.exchange", "order.created", event);
        
        // Return immediately - don't wait for processing
        return orderMapper.toDTO(order);
    }
}

// Consumer Service - Inventory Service
@Component
public class InventoryEventHandler {
    
    @RabbitListener(queues = "inventory.order.queue")
    public void handleOrderCreated(OrderCreatedEvent event) {
        try {
            // Process in background
            inventoryService.reserveItems(event.getOrderId(), event.getItems());
            
            // Publish success event
            inventoryEventPublisher.publishReservationSuccess(event.getOrderId());
            
        } catch (InsufficientStockException e) {
            // Publish failure event
            inventoryEventPublisher.publishReservationFailed(
                event.getOrderId(), e.getMessage()
            );
        }
    }
}

// Consumer Service - Notification Service
@Component
public class NotificationEventHandler {
    
    @RabbitListener(queues = "notification.order.queue")
    public void handleOrderCreated(OrderCreatedEvent event) {
        // Send email asynchronously
        emailService.sendOrderConfirmation(event.getUserId(), event.getOrderId());
        
        // Send SMS asynchronously  
        smsService.sendOrderSMS(event.getUserId(), event.getOrderId());
        
        // User doesn't wait for these notifications
    }
}
```

**Pattern #2: Event Streaming (Kafka)**
```java
// High-throughput event streaming for analytics
@Service
public class OrderAnalyticsService {
    
    private final KafkaTemplate<String, Object> kafkaTemplate;
    
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        // Stream to analytics pipeline
        OrderAnalyticsEvent analyticsEvent = new OrderAnalyticsEvent(
            event.getOrderId(),
            event.getUserId(),
            event.getTotalAmount(),
            event.getTimestamp(),
            event.getProductCategories()
        );
        
        // Send to Kafka topic for real-time analytics
        kafkaTemplate.send("order-analytics", analyticsEvent);
    }
}

// Analytics Consumer (Different team/service)
@KafkaListener(topics = "order-analytics", groupId = "analytics-group")
public void processOrderAnalytics(OrderAnalyticsEvent event) {
    // Update real-time dashboards
    dashboardService.updateOrderMetrics(event);
    
    // Feed machine learning models
    mlPipelineService.processOrderData(event);
    
    // Update recommendation engine
    recommendationService.updateUserPreferences(event);
}
```

#### **🎯 Real-World Example: Shopee Order Processing**

**Synchronous Flow (User waits):**
```java
@PostMapping("/orders")
public ResponseEntity<OrderDTO> createOrder(@RequestBody CreateOrderRequest request) {
    
    // 1. SYNC: Validate user (must be authenticated)
    UserDTO user = userService.getUser(request.getUserId());
    
    // 2. SYNC: Check cart items availability (user needs to know)
    List<ProductDTO> products = productService.validateCartItems(request.getItems());
    
    // 3. SYNC: Calculate pricing (user sees total cost)
    PricingResult pricing = pricingService.calculateTotal(products, user.getTier());
    
    // 4. SYNC: Authorize payment (must succeed before order)
    PaymentAuthResult auth = paymentService.authorizePayment(
        user.getPaymentMethod(), pricing.getTotal()
    );
    
    // 5. Create order record
    Order order = orderService.createOrder(request, products, pricing, auth);
    
    // 6. ASYNC: Everything else happens in background
    asyncOrderProcessor.processOrderAsync(order);
    
    return ResponseEntity.ok(orderMapper.toDTO(order));
}
```

**Asynchronous Flow (Background processing):**
```java
@Service
public class AsyncOrderProcessor {
    
    @Async
    public void processOrderAsync(Order order) {
        
        // 1. ASYNC: Reserve inventory
        CompletableFuture<Void> inventoryReservation = CompletableFuture.runAsync(() -> {
            inventoryService.reserveItems(order.getId(), order.getItems());
        });
        
        // 2. ASYNC: Process payment
        CompletableFuture<Void> paymentProcessing = CompletableFuture.runAsync(() -> {
            paymentService.capturePayment(order.getPaymentAuthId());
        });
        
        // 3. ASYNC: Send notifications
        CompletableFuture<Void> notifications = CompletableFuture.runAsync(() -> {
            notificationService.sendOrderConfirmation(order);
            smsService.sendOrderSMS(order);
        });
        
        // 4. ASYNC: Update analytics
        CompletableFuture<Void> analytics = CompletableFuture.runAsync(() -> {
            analyticsService.trackOrderCreated(order);
            recommendationService.updateUserBehavior(order);
        });
        
        // Wait for critical operations only
        CompletableFuture.allOf(inventoryReservation, paymentProcessing)
            .thenRun(() -> {
                orderService.markOrderAsConfirmed(order.getId());
                
                // Start shipping process
                shippingService.createShippingLabel(order);
            })
            .exceptionally(throwable -> {
                // Handle critical failures
                orderService.markOrderAsFailed(order.getId(), throwable.getMessage());
                return null;
            });
    }
}
```

#### **⚡ Performance Comparison**

**Netflix Case Study: API Gateway Response Times**
```
Synchronous Chain (Bad):
User Request → API Gateway → User Service → Product Service → Inventory Service
Total Time: 50ms + 30ms + 40ms + 35ms = 155ms

Asynchronous + Parallel (Good):
User Request → API Gateway 
             → User Service (parallel)
             → Product Service (parallel) 
             → Inventory Service (async)
Total Time: 50ms + max(30ms, 40ms) = 90ms (42% faster)

Async Background Processing:
User gets immediate response: 50ms
Everything else happens in background
User Experience: Instant feedback
```

#### **🚨 When to Use Each Pattern**

**Use Synchronous When:**
```java
// Critical for business logic
public boolean authenticateUser(String token) {
    // Must validate immediately
    return authService.validateToken(token);
}

// User needs immediate feedback
public PriceCalculation calculateOrderTotal(CartItems items) {
    // User waits to see total cost
    return pricingService.calculate(items);
}

// Data consistency is critical
public PaymentResult processPayment(PaymentRequest request) {
    // Must know if payment succeeded
    return paymentGateway.charge(request);
}
```

**Use Asynchronous When:**
```java
// Background operations
@EventListener
public void handleUserRegistered(UserRegisteredEvent event) {
    // Send welcome email (user doesn't wait)
    emailService.sendWelcomeEmail(event.getUserId());
    
    // Update analytics (background)
    analyticsService.trackUserRegistration(event);
    
    // Setup user preferences (background)
    preferenceService.createDefaultPreferences(event.getUserId());
}

// High-volume data processing
public void processClickEvent(ClickEvent event) {
    // Fire and forget to analytics pipeline
    kafkaProducer.send("user-clicks", event);
}

// Long-running operations
public void generateMonthlyReport(String userId) {
    // Don't make user wait 5 minutes
    reportGeneratorService.generateAsync(userId);
}
```

---

## 🌐 ADVANCED SESSION: Data Consistency in Distributed Systems

### **🧠 Mindset Shift #5: From Single Database to Distributed Data**

#### **Study Case: Order Processing like Shopee/Grab**
```
Monolithic Challenge: All data in one database
- Orders table
- Inventory table  
- Payment table
- User table

What happens when we split into microservices?
- Order Service (with its own DB)
- Inventory Service (with its own DB)
- Payment Service (with its own DB)
- User Service (with its own DB)

Business Flow: User places order for iPhone
1. Check user exists and has valid payment method
2. Check inventory has iPhone in stock
3. Reserve iPhone (decrease inventory)
4. Process payment
5. Create order record
6. Send confirmation email

Problem: What if step 4 (payment) fails after step 3 (inventory reserved)?
```

#### **💡 Study Case: The CAP Theorem in Real Life**

**CAP Theorem:**
- **C**onsistency: All nodes see the same data at the same time
- **A**vailability: System remains operational 
- **P**artition tolerance: System continues despite network failures

```
Netflix Example (Chooses AP - Availability + Partition tolerance):
- Movie recommendations might be slightly stale
- But streaming never stops
- Better to show last week's "trending" than no recommendations

Banking Example (Chooses CP - Consistency + Partition tolerance):  
- Account balance must be exactly correct
- System might be temporarily unavailable during network issues
- Better to block transactions than show wrong balance
```

#### **🔥 Real-World Consistency Patterns**

**Pattern #1: Eventual Consistency (Amazon Shopping Cart)**
```java
// Amazon's shopping cart is eventually consistent
// You might see different cart contents on different devices briefly

@Service
public class ShoppingCartService {
    
    // Write to primary database
    public void addItemToCart(String userId, String productId, int quantity) {
        CartItem item = new CartItem(userId, productId, quantity);
        cartRepository.save(item); // Writes to master DB
        
        // Async replication to read replicas
        eventPublisher.publishEvent(new CartUpdatedEvent(userId, item));
    }
    
    // Read from replica (might be slightly stale)
    @Cacheable("cart")
    public List<CartItem> getCartItems(String userId) {
        return cartReadRepository.findByUserId(userId); // Reads from replica
    }
}

// Event handler for async updates
@EventListener
@Async
public void handleCartUpdated(CartUpdatedEvent event) {
    // Update cache
    cacheManager.evict("cart", event.getUserId());
    
    // Update recommendation engine
    recommendationService.updateUserPreferences(event.getUserId(), event.getItem());
    
    // Update analytics
    analyticsService.trackCartActivity(event);
}
```

**Pattern #2: Saga Pattern (Distributed Transactions)**
```java
// Two-Phase Commit alternative for microservices
// Example: Order processing across multiple services

@Component
public class OrderProcessingSaga {
    
    public void processOrder(CreateOrderRequest request) {
        SagaTransaction saga = sagaManager.begin("order-processing");
        
        try {
            // Step 1: Reserve inventory
            ReservationResult reservation = inventoryService.reserveItems(
                request.getItems()
            );
            saga.addCompensation(() -> 
                inventoryService.cancelReservation(reservation.getReservationId())
            );
            
            // Step 2: Process payment  
            PaymentResult payment = paymentService.processPayment(
                request.getUserId(), 
                request.getTotalAmount()
            );
            saga.addCompensation(() ->
                paymentService.refundPayment(payment.getPaymentId())
            );
            
            // Step 3: Create order
            Order order = orderService.createOrder(request, reservation, payment);
            saga.addCompensation(() ->
                orderService.cancelOrder(order.getId())
            );
            
            // Step 4: Send confirmation
            notificationService.sendOrderConfirmation(order);
            
            saga.commit();
            
        } catch (Exception e) {
            saga.rollback(); // Executes all compensations in reverse order
            throw new OrderProcessingException("Failed to process order", e);
        }
    }
}
```

**Pattern #3: Event Sourcing (Bank Account)**
```java
// Instead of storing current state, store all events
// Account balance = sum of all deposit/withdrawal events

@Entity
public class AccountEvent {
    private String accountId;
    private String eventType; // DEPOSIT, WITHDRAWAL, TRANSFER
    private BigDecimal amount;
    private LocalDateTime timestamp;
    private String description;
    private Long version; // For optimistic locking
}

@Service
public class AccountService {
    
    public void deposit(String accountId, BigDecimal amount, String description) {
        // Load all events for this account
        List<AccountEvent> events = eventRepository.findByAccountIdOrderByVersion(accountId);
        
        // Calculate current balance
        BigDecimal currentBalance = events.stream()
            .map(this::calculateBalanceChange)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        // Create new event
        AccountEvent depositEvent = new AccountEvent(
            accountId, 
            "DEPOSIT", 
            amount, 
            LocalDateTime.now(),
            description,
            events.size() + 1L
        );
        
        // Save event (this is the only write operation)
        eventRepository.save(depositEvent);
        
        // Publish event for other services
        eventPublisher.publishEvent(new AccountDepositedEvent(accountId, amount));
    }
    
    public BigDecimal getBalance(String accountId) {
        // Option 1: Calculate from events (slow but always correct)
        return eventRepository.findByAccountIdOrderByVersion(accountId)
            .stream()
            .map(this::calculateBalanceChange)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
            
        // Option 2: Use cached snapshot + recent events (fast)
        // This is how banks actually do it
    }
}
```

#### **⚠️ Common Distributed Data Mistakes**

**Mistake #1: Distributed Transactions with 2PC**
```java
// WRONG: Two-Phase Commit across microservices
@Transactional // This won't work across different databases!
public void transferMoney(String fromAccount, String toAccount, BigDecimal amount) {
    accountServiceA.withdraw(fromAccount, amount); // Different database
    accountServiceB.deposit(toAccount, amount);    // Different database
    // If second call fails, first one is already committed!
}

// RIGHT: Use Saga pattern or eventual consistency
public void transferMoney(TransferRequest request) {
    TransferSaga saga = new TransferSaga(request);
    sagaOrchestrator.execute(saga);
}
```

**Mistake #2: Ignoring Network Partitions**
```java
// WRONG: Assuming services are always reachable
public OrderDTO createOrder(CreateOrderRequest request) {
    // This will fail if inventory service is down
    InventoryCheck check = inventoryService.checkAvailability(request.getItems());
    if (!check.isAvailable()) {
        throw new OutOfStockException();
    }
    
    return orderRepository.save(new Order(request));
}

// RIGHT: Design for failure
public OrderDTO createOrder(CreateOrderRequest request) {
    try {
        InventoryCheck check = inventoryService.checkAvailability(request.getItems());
        if (!check.isAvailable()) {
            throw new OutOfStockException();
        }
    } catch (ServiceUnavailableException e) {
        // Fallback: Create order with "PENDING_INVENTORY_CHECK" status
        // Process asynchronously when service is back
        return createPendingOrder(request);
    }
    
    return orderRepository.save(new Order(request));
}
```

#### **🎯 Netflix Case: Distributed Data at Scale**
```
Netflix Challenge: 200M+ users, 15K+ movies
- User service: User profiles, preferences
- Content service: Movie metadata, ratings  
- Recommendation service: ML models, viewing history
- Streaming service: Video files, CDN

Consistency Strategy:
1. User profile updates: Strong consistency (payment info must be correct)
2. Movie ratings: Eventual consistency (ok if rating is slightly delayed)
3. Recommendations: Eventual consistency (can use yesterday's data)
4. Viewing history: Eventual consistency with ordered events

Key Insight: Different data has different consistency requirements!
```

#### **🚀 Hands-on: Mini Distributed System**
```java
// Build a simple distributed order system with Java

// Order Service
@RestController
public class OrderController {
    
    @PostMapping("/orders")
    public ResponseEntity<OrderDTO> createOrder(@RequestBody CreateOrderRequest request) {
        // 1. Validate request
        // 2. Start saga
        // 3. Return order with PENDING status
        // 4. Process asynchronously
    }
}

// Inventory Service  
@RestController
public class InventoryController {
    
    @PostMapping("/reservations")
    public ResponseEntity<ReservationDTO> reserveItems(@RequestBody ReserveItemsRequest request) {
        // 1. Check availability
        // 2. Create reservation (temporary hold)
        // 3. Set expiration time (5 minutes)
        // 4. Return reservation ID
    }
    
    @PostMapping("/reservations/{id}/confirm")
    public ResponseEntity<Void> confirmReservation(@PathVariable String id) {
        // Convert reservation to actual inventory deduction
    }
    
    @DeleteMapping("/reservations/{id}")  
    public ResponseEntity<Void> cancelReservation(@PathVariable String id) {
        // Release reserved items back to available inventory
    }
}
```

---

## 📝 DAY 2 CHALLENGE PROJECT

### **Build: Advanced Product Catalog API**

**Requirements:**
1. **Product CRUD** with category relationships
2. **Image management** (upload, delete, reorder)
3. **Search functionality** with filters
4. **Unit & Integration tests** (minimum 80% coverage)
5. **Performance optimization** (solve N+1 queries)

**API Endpoints:**
```java
@RestController
@RequestMapping("/api/v1/products")
public class ProductController {
    
    @GetMapping
    public ResponseEntity<Page<ProductDTO>> searchProducts(
        @RequestParam(required = false) String name,
        @RequestParam(required = false) Long categoryId,
        @RequestParam(required = false) BigDecimal minPrice,
        @RequestParam(required = false) BigDecimal maxPrice,
        Pageable pageable
    ) {
        // Implementation here
    }
    
    @PostMapping
    public ResponseEntity<ProductDTO> createProduct(
        @Valid @RequestBody CreateProductRequest request
    ) {
        // Implementation here
    }
    
    @PostMapping("/{productId}/images")
    public ResponseEntity<ProductImageDTO> addImage(
        @PathVariable Long productId,
        @RequestParam("file") MultipartFile file
    ) {
        // Implementation here
    }
}
```

---

## 🎯 DAY 2 COMPLETION CHECKLIST

### **Morning Session:**
- [ ] Understand JPA relationships (@OneToMany, @ManyToOne, @ManyToMany)
- [ ] Implement Category-Product relationship
- [ ] Solve N+1 query problem with @Query and JOIN FETCH
- [ ] Add product images with proper cascade settings

### **Evening Session:**
- [ ] Write comprehensive unit tests with Mockito
- [ ] Create integration tests with TestContainers
- [ ] Implement Repository Pattern with Specifications
- [ ] Add event-driven patterns for loose coupling

### **Bonus Challenges:**
- [ ] Add caching with @Cacheable annotations
- [ ] Implement soft delete for products
- [ ] Add audit logging (created_at, updated_at, created_by)
- [ ] Performance test with large dataset (1M+ products)

---

## 🧠 DAY 2 REFLECTION QUESTIONS

1. **JPA vs TypeORM:** What are the key differences in handling relationships?
2. **Testing Strategy:** How does Java testing compare to Jest/Supertest?
3. **Performance:** What new performance considerations did you discover?
4. **Architecture:** How do events help with microservices design?

---

## 📚 STUDY CASES FOR DEEP THINKING

### **🔥 Netflix Case: Content Recommendation**
```
Problem: Netflix needs to show "Movies you might like" 
- 200M+ users
- 15K+ movies
- Real-time recommendations
- Sub-second response time

Questions to consider:
- How do they structure movie-genre relationships?
- What caching strategies do they use?
- How do they handle user preference updates?
- What's their testing strategy for recommendation algorithms?
```

### **🏗️ Architecture Decision: When to Denormalize**
```
Scenario: E-commerce product search
- 10M+ products
- 1000+ categories (nested)
- Real-time inventory updates
- Search response < 100ms

Trade-offs:
- Normalized: Consistent data, complex queries
- Denormalized: Fast reads, eventual consistency challenges

When would you choose each approach?
```

---

**📅 Tomorrow: DAY 3 - Security, Authentication & Microservices Patterns**

**🎯 Coming up:**
- JWT authentication implementation
- Role-based access control (RBAC)
- API gateway patterns
- Circuit breaker implementation
- Distributed tracing setup

---

**💡 Remember:** The goal isn't just to write code that works, but to understand the architectural decisions behind each pattern. Think like a senior engineer - consider scalability, maintainability, and team collaboration in every design choice!
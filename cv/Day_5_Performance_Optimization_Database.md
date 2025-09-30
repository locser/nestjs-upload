# ⚡ DAY 5: PERFORMANCE OPTIMIZATION & DATABASE DEEP DIVE

> **Today's Reality Check:** You can build features, but can you build them FAST? Real backend engineers don't just make things work - they make them work under pressure. We're diving deep into performance bottlenecks, database optimization, and the specific errors that crash production systems.

---

## 🎯 TODAY'S MISSION: FROM SLOW TO BLAZING FAST

**Morning Focus:** Database Performance & Query Optimization  
**Afternoon Focus:** Application Performance & Memory Management  
**Evening Challenge:** Real Production Performance Crisis Simulation

---

## 🔍 MORNING SESSION: DATABASE PERFORMANCE DEEP DIVE

### **The Performance Reality Check**

```java
// ❌ WRONG: This kills your database (N+1 Problem)
@RestController
public class OrderController {
    
    @GetMapping("/orders")
    public List<OrderResponse> getOrders() {
        List<Order> orders = orderRepository.findAll(); // 1 query
        return orders.stream()
            .map(order -> {
                // N queries - DISASTER!
                Customer customer = customerRepository.findById(order.getCustomerId());
                List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
                return new OrderResponse(order, customer, items);
            })
            .collect(toList());
    }
}
```

**The Error You'll See:**
```
HikariPool-1 - Connection is not available, request timed out after 30000ms.
```

**Production Impact:** 1000 orders = 3001 database queries = Dead system

---

### **✅ CORRECT: Optimized Database Access**

```java
// Repository Layer with Proper Joins
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    
    @Query("""
        SELECT DISTINCT o FROM Order o 
        JOIN FETCH o.customer c 
        JOIN FETCH o.orderItems oi 
        JOIN FETCH oi.product p 
        WHERE o.status = :status 
        AND o.createdAt >= :fromDate
        """)
    List<Order> findOrdersWithDetailsOptimized(
        @Param("status") OrderStatus status,
        @Param("fromDate") LocalDateTime fromDate
    );
    
    // For pagination with count query optimization
    @Query(value = """
        SELECT o FROM Order o 
        JOIN FETCH o.customer 
        JOIN FETCH o.orderItems
        """,
        countQuery = "SELECT COUNT(o) FROM Order o")
    Page<Order> findAllWithDetails(Pageable pageable);
}
```

```java
// Service Layer with Smart Caching
@Service
@Transactional(readOnly = true)
public class OrderService {
    
    @Cacheable(value = "orders", key = "#status + '_' + #page + '_' + #size")
    public Page<OrderResponse> getOrders(OrderStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        
        // Single optimized query instead of N+1
        Page<Order> orders = orderRepository.findOrdersWithStatus(status, pageable);
        
        return orders.map(this::toOrderResponse);
    }
    
    // Batch processing for bulk operations
    @Transactional
    public void processLargeOrderBatch(List<Long> orderIds) {
        // Process in chunks to avoid memory overflow
        int batchSize = 1000;
        for (int i = 0; i < orderIds.size(); i += batchSize) {
            List<Long> batch = orderIds.subList(i, 
                Math.min(i + batchSize, orderIds.size()));
            
            List<Order> orders = orderRepository.findAllById(batch);
            processOrderBatch(orders);
            
            // Clear persistence context to free memory
            entityManager.flush();
            entityManager.clear();
        }
    }
}
```

---

### **Database Index Strategy (Real Production Examples)**

```sql
-- ❌ SLOW: Missing index on commonly queried fields
SELECT * FROM orders WHERE customer_id = 12345 AND status = 'PENDING' AND created_at > '2024-01-01';
-- Execution time: 2.3 seconds on 1M records

-- ✅ FAST: Proper composite index
CREATE INDEX idx_orders_customer_status_date 
ON orders(customer_id, status, created_at);
-- Execution time: 15ms on 1M records

-- Index for sorting and pagination
CREATE INDEX idx_orders_created_desc ON orders(created_at DESC);

-- Partial index for specific use cases
CREATE INDEX idx_orders_pending ON orders(customer_id, created_at) 
WHERE status = 'PENDING';
```

---

## ⚡ AFTERNOON SESSION: APPLICATION PERFORMANCE OPTIMIZATION

### **Memory Leak Detection & Prevention**

```java
// ❌ MEMORY LEAK: Static collections that grow forever
public class SessionManager {
    private static final Map<String, UserSession> sessions = new HashMap<>(); // LEAK!
    
    public void addSession(String sessionId, UserSession session) {
        sessions.put(sessionId, session); // Never cleaned up!
    }
}
```

**The Error You'll See:**
```
java.lang.OutOfMemoryError: Java heap space
GC overhead limit exceeded
```

```java
// ✅ CORRECT: Proper memory management
@Component
public class SessionManager {
    
    // Use concurrent map with proper cleanup
    private final ConcurrentHashMap<String, UserSession> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor();
    
    @PostConstruct
    public void initCleanup() {
        // Clean expired sessions every 5 minutes
        cleaner.scheduleAtFixedRate(this::cleanExpiredSessions, 5, 5, TimeUnit.MINUTES);
    }
    
    public void addSession(String sessionId, UserSession session) {
        sessions.put(sessionId, session);
        
        // Optional: Set max size limit
        if (sessions.size() > 10000) {
            cleanOldestSessions();
        }
    }
    
    private void cleanExpiredSessions() {
        long now = System.currentTimeMillis();
        sessions.entrySet().removeIf(entry -> 
            entry.getValue().getLastAccessTime() + TimeUnit.HOURS.toMillis(2) < now
        );
    }
    
    @PreDestroy
    public void shutdown() {
        cleaner.shutdown();
        sessions.clear();
    }
}
```

---

### **Connection Pool Optimization**

```yaml
# application.yml - Real production settings
spring:
  datasource:
    hikari:
      # Connection pool settings for high-load systems
      maximum-pool-size: 20  # Not more than DB max_connections/number_of_instances
      minimum-idle: 5
      connection-timeout: 20000  # 20 seconds
      idle-timeout: 300000      # 5 minutes
      max-lifetime: 1200000     # 20 minutes
      leak-detection-threshold: 60000  # 1 minute - detect connection leaks
      
      # Performance optimization
      auto-commit: false
      connection-test-query: SELECT 1
      validation-timeout: 5000
      
      # Monitoring
      register-mbeans: true
      pool-name: HikariCP-Production
```

```java
// Connection leak detection
@Component
public class DatabaseHealthChecker {
    
    @Autowired
    private HikariDataSource dataSource;
    
    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void checkConnectionPool() {
        HikariPoolMXBean poolBean = dataSource.getHikariPoolMXBean();
        
        int activeConnections = poolBean.getActiveConnections();
        int totalConnections = poolBean.getTotalConnections();
        int idleConnections = poolBean.getIdleConnections();
        
        // Alert if connection usage is too high
        if (activeConnections > totalConnections * 0.8) {
            log.warn("High connection usage: {}/{}", activeConnections, totalConnections);
            // Send alert to monitoring system
            metricsService.incrementCounter("database.connection.high_usage");
        }
        
        // Check for connection leaks
        if (poolBean.getConnectionCreationFailureCount() > 0) {
            log.error("Connection creation failures detected: {}", 
                poolBean.getConnectionCreationFailureCount());
        }
    }
}
```

---

### **Real Performance Bottleneck: File Upload Optimization**

```java
// ❌ WRONG: Loading entire file into memory
@PostMapping("/upload")
public ResponseEntity<String> uploadFile(@RequestParam("file") MultipartFile file) {
    try {
        byte[] fileBytes = file.getBytes(); // DANGER: OutOfMemoryError for large files
        
        // Process entire file in memory
        String content = new String(fileBytes);
        processFileContent(content);
        
        return ResponseEntity.ok("File uploaded successfully");
    } catch (IOException e) {
        return ResponseEntity.status(500).body("Upload failed");
    }
}
```

```java
// ✅ CORRECT: Streaming file processing
@PostMapping("/upload")
public ResponseEntity<String> uploadFileOptimized(@RequestParam("file") MultipartFile file) {
    
    // Validate file size before processing
    if (file.getSize() > 100 * 1024 * 1024) { // 100MB limit
        return ResponseEntity.badRequest().body("File too large");
    }
    
    try (InputStream inputStream = file.getInputStream();
         BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
        
        String line;
        int lineCount = 0;
        List<String> batch = new ArrayList<>();
        
        // Process file line by line
        while ((line = reader.readLine()) != null) {
            batch.add(line);
            
            // Process in batches to control memory usage
            if (batch.size() >= 1000) {
                processBatch(batch);
                batch.clear();
            }
            
            lineCount++;
            
            // Progress reporting for large files
            if (lineCount % 10000 == 0) {
                log.info("Processed {} lines", lineCount);
            }
        }
        
        // Process remaining lines
        if (!batch.isEmpty()) {
            processBatch(batch);
        }
        
        return ResponseEntity.ok("File processed successfully. Lines: " + lineCount);
        
    } catch (IOException e) {
        log.error("File processing failed", e);
        return ResponseEntity.status(500).body("Upload failed: " + e.getMessage());
    }
}

private void processBatch(List<String> lines) {
    // Batch database operations
    List<DataRecord> records = lines.stream()
        .map(this::parseLineToRecord)
        .filter(Objects::nonNull)
        .collect(toList());
    
    if (!records.isEmpty()) {
        dataRepository.saveAll(records); // Batch insert
    }
}
```

---

## 🚨 EVENING CHALLENGE: PRODUCTION CRISIS SIMULATION

### **Scenario: Your API is Dying Under Load**

**The Problem:** Your order API response time went from 200ms to 8 seconds. Revenue is dropping by $1000/minute.

**Step 1: Immediate Diagnosis**

```java
// Add performance monitoring to existing endpoints
@RestController
public class OrderController {
    
    private final MeterRegistry meterRegistry;
    private final Timer.Sample sample;
    
    @GetMapping("/orders/{id}")
    public ResponseEntity<OrderResponse> getOrder(@PathVariable Long id) {
        Timer.Sample sample = Timer.start(meterRegistry);
        
        try {
            // Your existing code
            Order order = orderService.findById(id);
            
            // Log slow queries for debugging
            if (sample.stop(Timer.builder("order.fetch.time").register(meterRegistry)).toMillis() > 1000) {
                log.warn("Slow order fetch for ID {}: {}ms", id, sample.stop().toMillis());
            }
            
            return ResponseEntity.ok(orderMapper.toResponse(order));
            
        } catch (Exception e) {
            meterRegistry.counter("order.fetch.error").increment();
            throw e;
        }
    }
}
```

**Step 2: Database Query Analysis**

```sql
-- Find slow queries in production
SELECT 
    query,
    mean_exec_time,
    calls,
    total_exec_time,
    (total_exec_time/calls) as avg_time
FROM pg_stat_statements 
WHERE mean_exec_time > 1000  -- Queries taking more than 1 second
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check for missing indexes
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM orders o 
JOIN customers c ON o.customer_id = c.id 
WHERE o.status = 'PENDING' 
AND o.created_at > NOW() - INTERVAL '1 day';
```

**Step 3: Emergency Performance Fix**

```java
// Emergency caching for hot data
@Component
public class EmergencyOrderCache {
    
    private final Cache<Long, OrderResponse> cache = Caffeine.newBuilder()
        .maximumSize(10000)
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .recordStats()
        .build();
    
    public OrderResponse getOrderCached(Long orderId, Supplier<OrderResponse> fallback) {
        return cache.get(orderId, key -> {
            log.info("Cache miss for order {}", key);
            return fallback.get();
        });
    }
    
    @Scheduled(fixedRate = 60000) // Every minute
    public void logCacheStats() {
        CacheStats stats = cache.stats();
        log.info("Cache stats - Hit rate: {:.2f}%, Evictions: {}", 
            stats.hitRate() * 100, stats.evictionCount());
    }
}
```

---

## 🎯 SPECIFIC ERRORS YOU'LL ENCOUNTER & FIXES

### **1. OutOfMemoryError in Production**

```java
// Error stack trace you'll see:
/*
Exception in thread "http-nio-8080-exec-1" java.lang.OutOfMemoryError: Java heap space
    at java.util.Arrays.copyOf(Arrays.java:3210)
    at java.util.ArrayList.grow(ArrayList.java:267)
    at com.company.service.OrderService.processLargeDataset(OrderService.java:45)
*/

// Debug with heap analysis
@Component
public class MemoryMonitor {
    
    @EventListener
    public void handleOutOfMemory(OutOfMemoryError error) {
        // Emergency heap dump for analysis
        try {
            ManagementFactory.getPlatformMXBean(HotSpotDiagnosticMXBean.class)
                .dumpHeap("/tmp/heap-dump-" + System.currentTimeMillis() + ".hprof", true);
        } catch (IOException e) {
            log.error("Failed to create heap dump", e);
        }
    }
    
    @Scheduled(fixedRate = 30000)
    public void checkMemoryUsage() {
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        MemoryUsage heapUsage = memoryBean.getHeapMemoryUsage();
        
        long used = heapUsage.getUsed();
        long max = heapUsage.getMax();
        double percentage = (double) used / max * 100;
        
        if (percentage > 85) {
            log.warn("High memory usage: {:.2f}% ({}/{})", percentage, used, max);
            // Trigger garbage collection if critical
            if (percentage > 95) {
                System.gc();
            }
        }
    }
}
```

### **2. Database Connection Pool Exhaustion**

```java
// The error you'll see:
/*
HikariPool-1 - Connection is not available, request timed out after 30000ms.
Caused by: java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available
*/

// Fix with proper connection management
@Service
public class OrderService {
    
    @Transactional(timeout = 30) // Prevent long-running transactions
    public void processOrder(Order order) {
        try {
            // Your business logic here
            orderRepository.save(order);
            
        } catch (Exception e) {
            // Ensure connection is released even on error
            log.error("Order processing failed for order {}", order.getId(), e);
            throw new OrderProcessingException("Failed to process order", e);
        }
    }
    
    // For bulk operations, use proper batching
    @Transactional
    public void processBulkOrders(List<Order> orders) {
        int batchSize = 100;
        
        for (int i = 0; i < orders.size(); i += batchSize) {
            List<Order> batch = orders.subList(i, Math.min(i + batchSize, orders.size()));
            orderRepository.saveAll(batch);
            orderRepository.flush(); // Force write to DB
            
            // Clear persistence context every batch
            if (i % (batchSize * 10) == 0) {
                entityManager.clear();
            }
        }
    }
}
```

---

## 🏆 TODAY'S ACHIEVEMENTS

By the end of Day 5, you've tackled:

1. **Database Performance:** Eliminated N+1 queries, optimized indexes, implemented proper pagination
2. **Memory Management:** Fixed memory leaks, implemented streaming file processing, added memory monitoring
3. **Connection Pooling:** Configured production-ready connection pools with leak detection
4. **Performance Monitoring:** Added metrics, logging, and alerting for production issues
5. **Crisis Response:** Learned to diagnose and fix performance issues under pressure

**💡 Senior Engineer Insight:** Performance isn't just about making things fast - it's about understanding the limits of your system and designing for graceful degradation. Today you learned to think like a production engineer: monitor everything, fail fast, and always have a rollback plan.

---

## 🚀 TOMORROW'S PREVIEW: DAY 6

**Message Queues & Event-Driven Architecture** - Building systems that scale horizontally with RabbitMQ, Kafka, and distributed event processing.

Ready to handle millions of events per second? 🔥
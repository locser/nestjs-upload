# 📨 DAY 6: MESSAGE QUEUES & EVENT-DRIVEN ARCHITECTURE

> **Today's Reality Check:** Your monolith is cracking under pressure. 10,000 users trying to place orders simultaneously? Your database is crying. Time to learn how Netflix, Uber, and Amazon handle millions of events per second without breaking a sweat.

---

## 🤔 WHY MESSAGE QUEUES MATTER IN REAL WORLD

### **The Scaling Problem**
Imagine you're building an e-commerce system. Initially, with 100 users per day, everything works fine. But what happens when you hit 10,000 concurrent users during Black Friday?

**Without Message Queues:**
- Your API response time goes from 200ms to 30 seconds
- Database connections get exhausted 
- Payment gateway timeouts cause money loss
- Customers abandon carts due to slow responses
- Your system crashes and revenue drops by millions

**With Message Queues:**
- API responds in 50ms (just creates order and queues tasks)
- Background workers handle heavy operations
- System gracefully handles traffic spikes
- Failed operations can be retried automatically
- You can scale individual components independently

### **Message Queue Patterns in Production**

**1. Work Queues:** Distribute time-consuming tasks among workers
- **Use Case:** Image processing, PDF generation, email sending
- **Example:** Shopee processes millions of product images daily

**2. Publish/Subscribe:** Broadcast events to multiple services
- **Use Case:** User registration triggers email, SMS, analytics, recommendations
- **Example:** When you like a post on Facebook, 15+ services get notified

**3. RPC Queues:** Remote procedure calls with reliability
- **Use Case:** Microservice communication with fallback
- **Example:** Payment service calling fraud detection service

**4. Dead Letter Queues:** Handle failed messages gracefully
- **Use Case:** Failed payment processing, corrupted data recovery
- **Example:** Amazon SQS stores failed messages for manual investigation

---

## 🎯 TODAY'S MISSION: FROM SYNCHRONOUS HELL TO ASYNC PARADISE

**Morning Focus:** RabbitMQ Fundamentals & Dead Letter Queues  
**Afternoon Focus:** Apache Kafka & Event Sourcing  
**Evening Challenge:** Building a Real-Time Order Processing Pipeline

---

## 🧠 UNDERSTANDING MESSAGE QUEUES ARCHITECTURE

### **The Core Concepts**

**Producer:** Service that sends messages
- Creates and publishes messages to queues/topics
- Examples: Order service, User service, Payment service

**Consumer:** Service that processes messages
- Subscribes to queues/topics and processes messages
- Examples: Email service, SMS service, Analytics service

**Broker:** The message queue server
- Stores, routes, and delivers messages
- Examples: RabbitMQ, Apache Kafka, Amazon SQS

**Queue vs Topic:**
- **Queue:** Point-to-point (one consumer gets each message)
- **Topic:** Publish-subscribe (all subscribers get each message)

### **Message Delivery Guarantees**

**At Most Once:** Message delivered 0 or 1 times (may be lost)
- Fast but unreliable
- Use for: Analytics data, logging

**At Least Once:** Message delivered 1 or more times (may duplicate)
- Reliable but may have duplicates
- Use for: Email notifications, payment processing

**Exactly Once:** Message delivered exactly 1 time
- Slow but perfect reliability
- Use for: Financial transactions, critical business logic

---

## 🐰 MORNING SESSION: RABBITMQ DEEP DIVE

### **The Synchronous Nightmare**

```java
// ❌ WRONG: Synchronous order processing (System killer)
@RestController
public class OrderController {
    
    @PostMapping("/orders")
    public ResponseEntity<OrderResponse> createOrder(@RequestBody OrderRequest request) {
        // Each step blocks the request thread - DISASTER!
        Order order = orderService.createOrder(request);           // 200ms
        paymentService.processPayment(order);                      // 2000ms (external API)
        inventoryService.reserveItems(order);                     // 300ms
        emailService.sendConfirmation(order.getCustomerEmail());  // 1500ms (SMTP)
        smsService.sendNotification(order.getCustomerPhone());    // 800ms (SMS API)
        
        // Total: 4.8 seconds per order!
        // 100 concurrent orders = 480 seconds of blocked threads
        return ResponseEntity.ok(orderMapper.toResponse(order));
    }
}
```

**The Error You'll See:**
```
org.apache.tomcat.util.threads.ThreadPoolExecutor$RejectedExecutionException: 
Task org.apache.coyote.RequestGroupInfo@abc rejected from 
java.util.concurrent.ThreadPoolExecutor@def[Running, pool size = 200, active threads = 200]
```

---

### **✅ CORRECT: Event-Driven Order Processing**

```java
// RabbitMQ Configuration
@Configuration
@EnableRabbit
public class RabbitConfig {
    
    // Order Events Exchange
    @Bean
    public TopicExchange orderExchange() {
        return ExchangeBuilder.topicExchange("order.exchange")
                .durable(true)
                .build();
    }
    
    // Payment Processing Queue
    @Bean
    public Queue paymentQueue() {
        return QueueBuilder.durable("payment.queue")
                .withArgument("x-dead-letter-exchange", "dlx.exchange")
                .withArgument("x-dead-letter-routing-key", "payment.failed")
                .withArgument("x-message-ttl", 300000) // 5 minutes TTL
                .build();
    }
    
    // Dead Letter Queue for failed payments
    @Bean
    public Queue paymentDeadLetterQueue() {
        return QueueBuilder.durable("payment.dlq").build();
    }
    
    @Bean
    public Binding paymentBinding() {
        return BindingBuilder.bind(paymentQueue())
                .to(orderExchange())
                .with("order.payment.process");
    }
}
```

```java
// Fast Async Order Controller
@RestController
public class OrderController {
    
    @Autowired
    private RabbitTemplate rabbitTemplate;
    
    @PostMapping("/orders")
    public ResponseEntity<OrderResponse> createOrder(@RequestBody OrderRequest request) {
        
        // Only create order in database - FAST!
        Order order = orderService.createOrder(request); // 50ms
        
        // Publish events asynchronously
        publishOrderEvents(order);
        
        // Return immediately to user
        return ResponseEntity.ok(OrderResponse.builder()
                .orderId(order.getId())
                .status("PROCESSING")
                .message("Order received and being processed")
                .build());
    }
    
    private void publishOrderEvents(Order order) {
        String exchange = "order.exchange";
        
        // Payment processing event
        PaymentEvent paymentEvent = PaymentEvent.builder()
                .orderId(order.getId())
                .amount(order.getTotalAmount())
                .customerId(order.getCustomerId())
                .timestamp(Instant.now())
                .build();
        
        rabbitTemplate.convertAndSend(exchange, "order.payment.process", paymentEvent);
        
        // Inventory reservation event
        InventoryEvent inventoryEvent = InventoryEvent.builder()
                .orderId(order.getId())
                .items(order.getItems())
                .build();
        
        rabbitTemplate.convertAndSend(exchange, "order.inventory.reserve", inventoryEvent);
        
        // Notification events
        EmailEvent emailEvent = EmailEvent.builder()
                .orderId(order.getId())
                .customerEmail(order.getCustomerEmail())
                .template("order_confirmation")
                .build();
        
        rabbitTemplate.convertAndSend(exchange, "order.email.send", emailEvent);
    }
}
```

---

### **Payment Service with Retry Logic**

```java
@Component
public class PaymentEventListener {
    
    private final PaymentService paymentService;
    private final RabbitTemplate rabbitTemplate;
    
    @RabbitListener(queues = "payment.queue")
    public void handlePaymentEvent(
            @Payload PaymentEvent event,
            @Header Map<String, Object> headers,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        
        try {
            log.info("Processing payment for order: {}", event.getOrderId());
            
            // Idempotency check - crucial for retries
            if (paymentService.isPaymentAlreadyProcessed(event.getOrderId())) {
                log.info("Payment already processed for order: {}", event.getOrderId());
                channel.basicAck(deliveryTag, false);
                return;
            }
            
            // Process payment
            PaymentResult result = paymentService.processPayment(event);
            
            if (result.isSuccess()) {
                // Publish success event
                PaymentSuccessEvent successEvent = PaymentSuccessEvent.builder()
                        .orderId(event.getOrderId())
                        .transactionId(result.getTransactionId())
                        .amount(event.getAmount())
                        .build();
                
                rabbitTemplate.convertAndSend("order.exchange", 
                        "order.payment.success", successEvent);
                
                // Acknowledge message
                channel.basicAck(deliveryTag, false);
                
            } else {
                // Handle payment failure
                handlePaymentFailure(event, result, channel, deliveryTag);
            }
            
        } catch (Exception e) {
            log.error("Payment processing failed for order: {}", event.getOrderId(), e);
            handlePaymentError(event, e, channel, deliveryTag);
        }
    }
    
    private void handlePaymentFailure(PaymentEvent event, PaymentResult result, 
                                    Channel channel, long deliveryTag) throws IOException {
        
        // Get retry count from headers
        Integer retryCount = (Integer) headers.getOrDefault("x-retry-count", 0);
        
        if (retryCount < 3) {
            // Retry with exponential backoff
            rabbitTemplate.convertAndSend("order.exchange", "order.payment.process", 
                    event, message -> {
                        message.getMessageProperties().setHeader("x-retry-count", retryCount + 1);
                        message.getMessageProperties().setExpiration(String.valueOf(
                                (long) Math.pow(2, retryCount) * 1000)); // 1s, 2s, 4s
                        return message;
                    });
            
            channel.basicAck(deliveryTag, false);
            
        } else {
            // Max retries reached - send to dead letter queue
            log.error("Payment failed after {} retries for order: {}", retryCount, event.getOrderId());
            
            PaymentFailedEvent failedEvent = PaymentFailedEvent.builder()
                    .orderId(event.getOrderId())
                    .reason(result.getFailureReason())
                    .retryCount(retryCount)
                    .build();
            
            rabbitTemplate.convertAndSend("order.exchange", "order.payment.failed", failedEvent);
            channel.basicReject(deliveryTag, false); // Send to DLQ
        }
    }
}
```

---

---

## 📊 RABBITMQ VS KAFKA: WHEN TO USE WHAT?

### **RabbitMQ - The Reliable Workhorse**

**Best For:**
- Traditional message queuing patterns
- Complex routing requirements
- When you need guaranteed message delivery
- Smaller to medium message volumes (< 100K messages/sec)

**Strengths:**
- Easy to setup and manage
- Rich routing capabilities (exchanges, bindings)
- Built-in clustering and high availability
- Great tooling and management UI

**Weaknesses:**
- Lower throughput compared to Kafka
- Messages are deleted after consumption
- Not designed for data streaming

### **Apache Kafka - The High-Throughput Beast**

**Best For:**
- High-throughput data streaming
- Event sourcing and log aggregation
- Real-time analytics and data pipelines
- Large message volumes (> 1M messages/sec)

**Strengths:**
- Massive throughput and scalability
- Messages are persistent (retained for configured time)
- Built-in partitioning for parallel processing
- Perfect for event sourcing patterns

**Weaknesses:**
- More complex to setup and manage
- Limited routing capabilities
- Requires more operational expertise

### **Real-World Usage Examples:**

**Netflix:** Uses Kafka for real-time recommendation system
- 8+ trillion events per day
- Powers "Because you watched..." recommendations
- Handles user behavior tracking in real-time

**Uber:** Uses both RabbitMQ and Kafka
- RabbitMQ: Driver-rider matching, payment processing
- Kafka: Real-time pricing, analytics, fraud detection

**Shopee:** Uses Kafka for order processing
- Handles millions of orders during flash sales
- Real-time inventory updates across regions
- Powers recommendation engine with user behavior

---

## 🚀 AFTERNOON SESSION: APACHE KAFKA & EVENT SOURCING

### **Why Event Sourcing Changes Everything**

Traditional systems store the **current state** of data:
```
User: { id: 123, name: "John", balance: 1000 }
```

Event sourcing stores the **sequence of events** that led to current state:
```
1. UserCreated(id: 123, name: "John", initialBalance: 0)
2. MoneyDeposited(id: 123, amount: 1500)
3. MoneyWithdrawn(id: 123, amount: 500)
Current Balance = 0 + 1500 - 500 = 1000
```

**Benefits:**
- **Complete Audit Trail:** Every change is recorded forever
- **Time Travel:** Recreate system state at any point in time
- **Debugging:** See exactly what happened when bugs occur
- **Analytics:** Rich data for business intelligence
- **Compliance:** Perfect for financial and healthcare systems

**Challenges:**
- **Complexity:** More complex than CRUD operations
- **Storage:** Events accumulate over time
- **Performance:** Need to replay events to get current state
- **Schema Evolution:** Handling event format changes

### **Kafka Producer Configuration for High Throughput**

```java
@Configuration
public class KafkaProducerConfig {
    
    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> configProps = new HashMap<>();
        
        // Basic configuration
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        
        // Performance optimization
        configProps.put(ProducerConfig.ACKS_CONFIG, "1"); // Leader acknowledgment
        configProps.put(ProducerConfig.RETRIES_CONFIG, 3);
        configProps.put(ProducerConfig.BATCH_SIZE_CONFIG, 16384); // 16KB batches
        configProps.put(ProducerConfig.LINGER_MS_CONFIG, 5); // Wait 5ms for batching
        configProps.put(ProducerConfig.BUFFER_MEMORY_CONFIG, 33554432); // 32MB buffer
        
        // Compression for high throughput
        configProps.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "snappy");
        
        // Idempotence for exactly-once semantics
        configProps.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        
        return new DefaultKafkaProducerFactory<>(configProps);
    }
    
    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        KafkaTemplate<String, Object> template = new KafkaTemplate<>(producerFactory());
        
        // Add error handling
        template.setProducerListener(new ProducerListener<String, Object>() {
            @Override
            public void onError(ProducerRecord<String, Object> producerRecord, 
                              RecordMetadata recordMetadata, Exception exception) {
                log.error("Failed to send message to topic: {}, partition: {}", 
                        producerRecord.topic(), recordMetadata.partition(), exception);
                
                // Send to dead letter topic or retry queue
                handleKafkaError(producerRecord, exception);
            }
        });
        
        return template;
    }
}
```

### **Event Sourcing Implementation**

```java
// Event Store for Order Aggregate
@Entity
@Table(name = "order_events")
public class OrderEvent {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "aggregate_id", nullable = false)
    private String aggregateId; // Order ID
    
    @Column(name = "event_type", nullable = false)
    private String eventType;
    
    @Column(name = "event_data", columnDefinition = "TEXT")
    private String eventData; // JSON
    
    @Column(name = "version", nullable = false)
    private Long version;
    
    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;
    
    @Column(name = "correlation_id")
    private String correlationId;
    
    // Constructors, getters, setters
}

// Order Aggregate
public class OrderAggregate {
    private String orderId;
    private String customerId;
    private OrderStatus status;
    private BigDecimal totalAmount;
    private List<OrderItem> items;
    private Long version;
    
    // Apply events to rebuild state
    public void apply(OrderEvent event) {
        switch (event.getEventType()) {
            case "OrderCreated":
                applyOrderCreated(event);
                break;
            case "PaymentProcessed":
                applyPaymentProcessed(event);
                break;
            case "OrderShipped":
                applyOrderShipped(event);
                break;
            case "OrderCancelled":
                applyOrderCancelled(event);
                break;
        }
        this.version = event.getVersion();
    }
    
    private void applyOrderCreated(OrderEvent event) {
        OrderCreatedEvent data = parseEventData(event, OrderCreatedEvent.class);
        this.orderId = data.getOrderId();
        this.customerId = data.getCustomerId();
        this.status = OrderStatus.CREATED;
        this.totalAmount = data.getTotalAmount();
        this.items = data.getItems();
    }
    
    // Business logic methods that generate events
    public List<OrderEvent> processPayment(PaymentInfo paymentInfo) {
        if (this.status != OrderStatus.CREATED) {
            throw new IllegalStateException("Cannot process payment for order in status: " + this.status);
        }
        
        // Create payment processed event
        PaymentProcessedEvent eventData = PaymentProcessedEvent.builder()
                .orderId(this.orderId)
                .amount(paymentInfo.getAmount())
                .transactionId(paymentInfo.getTransactionId())
                .timestamp(Instant.now())
                .build();
        
        OrderEvent event = OrderEvent.builder()
                .aggregateId(this.orderId)
                .eventType("PaymentProcessed")
                .eventData(toJson(eventData))
                .version(this.version + 1)
                .timestamp(Instant.now())
                .correlationId(paymentInfo.getCorrelationId())
                .build();
        
        return List.of(event);
    }
}
```

### **Event Store Service**

```java
@Service
@Transactional
public class EventStoreService {
    
    @Autowired
    private OrderEventRepository eventRepository;
    
    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;
    
    public void saveEvents(String aggregateId, List<OrderEvent> events, Long expectedVersion) {
        
        // Optimistic concurrency control
        Long currentVersion = eventRepository.findMaxVersionByAggregateId(aggregateId).orElse(0L);
        
        if (!currentVersion.equals(expectedVersion)) {
            throw new ConcurrencyException(
                "Expected version " + expectedVersion + " but current version is " + currentVersion);
        }
        
        // Save events atomically
        for (OrderEvent event : events) {
            event.setVersion(++currentVersion);
            eventRepository.save(event);
            
            // Publish to Kafka for read models and other services
            publishEventToKafka(event);
        }
    }
    
    public OrderAggregate loadAggregate(String aggregateId) {
        List<OrderEvent> events = eventRepository.findByAggregateIdOrderByVersion(aggregateId);
        
        if (events.isEmpty()) {
            throw new AggregateNotFoundException("Order not found: " + aggregateId);
        }
        
        OrderAggregate aggregate = new OrderAggregate();
        events.forEach(aggregate::apply);
        
        return aggregate;
    }
    
    private void publishEventToKafka(OrderEvent event) {
        try {
            kafkaTemplate.send("order-events", event.getAggregateId(), event)
                    .addCallback(
                        result -> log.debug("Event published successfully: {}", event.getId()),
                        failure -> log.error("Failed to publish event: {}", event.getId(), failure)
                    );
        } catch (Exception e) {
            log.error("Error publishing event to Kafka: {}", event.getId(), e);
            // Don't fail the transaction - event is saved, can be republished later
        }
    }
}
```

---

---

## 📈 SAGA PATTERN: MANAGING DISTRIBUTED TRANSACTIONS

### **The Distributed Transaction Problem**

In microservices, you can't use database transactions across services. Consider this order flow:

1. **Order Service:** Create order
2. **Payment Service:** Charge credit card  
3. **Inventory Service:** Reserve items
4. **Shipping Service:** Schedule delivery

**What if step 3 fails?** You've already charged the customer and created the order!

### **Two Saga Patterns**

**1. Choreography (Event-driven):**
- Each service publishes events
- Other services react to events
- No central coordinator
- **Pros:** Loose coupling, high performance
- **Cons:** Hard to debug, complex error handling

**2. Orchestration (Command-driven):**
- Central orchestrator manages the flow
- Orchestrator sends commands to services
- **Pros:** Easy to debug, centralized logic
- **Cons:** Single point of failure, tighter coupling

### **When Sagas Go Wrong: Compensation Actions**

Each saga step must have a **compensating action:**

| Step | Action | Compensation |
|------|--------|-------------|
| 1 | Create Order | Cancel Order |
| 2 | Charge Payment | Refund Payment |
| 3 | Reserve Inventory | Release Inventory |
| 4 | Schedule Shipping | Cancel Shipping |

**Example Failure Scenario:**
1. ✅ Order created
2. ✅ Payment charged  
3. ❌ Inventory failed (out of stock)
4. 🔄 Compensate: Refund payment, cancel order

---

## 🔥 EVENING CHALLENGE: REAL-TIME ORDER PROCESSING PIPELINE

### **The Business Challenge**

You're building an order system for a major e-commerce platform. Requirements:

- **Performance:** Handle 10,000 orders/minute during peak hours
- **Reliability:** No lost orders, no double charges
- **Scalability:** Auto-scale based on queue depth
- **Monitoring:** Real-time visibility into order flow
- **Recovery:** Handle service failures gracefully

### **Order Saga Orchestrator**

```java
@Component
public class OrderSagaOrchestrator {
    
    @Autowired
    private EventStoreService eventStoreService;
    
    @KafkaListener(topics = "order-events", groupId = "order-saga")
    public void handleOrderEvent(@Payload OrderEvent event, 
                                @Header KafkaHeaders.RECEIVED_TOPIC String topic,
                                @Header KafkaHeaders.RECEIVED_PARTITION_ID int partition) {
        
        log.info("Processing event: {} for order: {}", event.getEventType(), event.getAggregateId());
        
        try {
            switch (event.getEventType()) {
                case "OrderCreated":
                    handleOrderCreated(event);
                    break;
                case "PaymentProcessed":
                    handlePaymentProcessed(event);
                    break;
                case "InventoryReserved":
                    handleInventoryReserved(event);
                    break;
                case "PaymentFailed":
                    handlePaymentFailed(event);
                    break;
                case "InventoryUnavailable":
                    handleInventoryUnavailable(event);
                    break;
            }
        } catch (Exception e) {
            log.error("Saga processing failed for event: {}", event.getId(), e);
            // Implement compensation logic or retry
            handleSagaFailure(event, e);
        }
    }
    
    private void handleOrderCreated(OrderEvent event) {
        OrderCreatedEvent data = parseEventData(event, OrderCreatedEvent.class);
        
        // Start payment process
        PaymentCommand paymentCommand = PaymentCommand.builder()
                .orderId(data.getOrderId())
                .customerId(data.getCustomerId())
                .amount(data.getTotalAmount())
                .correlationId(event.getCorrelationId())
                .build();
        
        kafkaTemplate.send("payment-commands", data.getOrderId(), paymentCommand);
        
        // Start inventory reservation
        InventoryCommand inventoryCommand = InventoryCommand.builder()
                .orderId(data.getOrderId())
                .items(data.getItems())
                .correlationId(event.getCorrelationId())
                .build();
        
        kafkaTemplate.send("inventory-commands", data.getOrderId(), inventoryCommand);
    }
    
    private void handlePaymentProcessed(OrderEvent event) {
        // Check if inventory is also reserved
        OrderAggregate order = eventStoreService.loadAggregate(event.getAggregateId());
        
        if (order.isInventoryReserved() && order.isPaymentProcessed()) {
            // Both conditions met - confirm order
            ConfirmOrderCommand confirmCommand = ConfirmOrderCommand.builder()
                    .orderId(event.getAggregateId())
                    .build();
            
            kafkaTemplate.send("order-commands", event.getAggregateId(), confirmCommand);
        }
    }
    
    private void handlePaymentFailed(OrderEvent event) {
        // Compensate - release inventory if reserved
        OrderAggregate order = eventStoreService.loadAggregate(event.getAggregateId());
        
        if (order.isInventoryReserved()) {
            ReleaseInventoryCommand releaseCommand = ReleaseInventoryCommand.builder()
                    .orderId(event.getAggregateId())
                    .items(order.getItems())
                    .reason("Payment failed")
                    .build();
            
            kafkaTemplate.send("inventory-commands", event.getAggregateId(), releaseCommand);
        }
        
        // Cancel order
        CancelOrderCommand cancelCommand = CancelOrderCommand.builder()
                .orderId(event.getAggregateId())
                .reason("Payment failed")
                .build();
        
        kafkaTemplate.send("order-commands", event.getAggregateId(), cancelCommand);
    }
}
```

---

## 🚨 COMMON KAFKA ERRORS & SOLUTIONS

### **1. Consumer Lag Monitoring**

```java
@Component
public class KafkaMonitoringService {
    
    @Autowired
    private KafkaListenerEndpointRegistry endpointRegistry;
    
    @Scheduled(fixedRate = 30000) // Every 30 seconds
    public void monitorConsumerLag() {
        endpointRegistry.getListenerContainers().forEach(container -> {
            if (container instanceof ConcurrentMessageListenerContainer) {
                ConcurrentMessageListenerContainer concurrent = 
                    (ConcurrentMessageListenerContainer) container;
                
                concurrent.getContainers().forEach(listenerContainer -> {
                    Collection<TopicPartition> assignments = listenerContainer.getAssignedPartitions();
                    
                    assignments.forEach(partition -> {
                        long currentOffset = getCurrentOffset(partition);
                        long endOffset = getEndOffset(partition);
                        long lag = endOffset - currentOffset;
                        
                        if (lag > 1000) { // Alert if lag > 1000 messages
                            log.warn("High consumer lag detected: Topic={}, Partition={}, Lag={}", 
                                    partition.topic(), partition.partition(), lag);
                            
                            // Send alert to monitoring system
                            metricsService.recordGauge("kafka.consumer.lag", lag, 
                                    "topic", partition.topic(), 
                                    "partition", String.valueOf(partition.partition()));
                        }
                    });
                });
            }
        });
    }
}
```

### **2. Dead Letter Topic Pattern**

```java
@Configuration
public class KafkaErrorHandlingConfig {
    
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = 
                new ConcurrentKafkaListenerContainerFactory<>();
        
        factory.setConsumerFactory(consumerFactory());
        
        // Configure error handling
        factory.setCommonErrorHandler(new DefaultErrorHandler(
                deadLetterPublishingRecoverer(), // Send to DLT after retries
                new FixedBackOff(1000L, 3L))); // 3 retries with 1 second interval
        
        return factory;
    }
    
    @Bean
    public DeadLetterPublishingRecoverer deadLetterPublishingRecoverer() {
        return new DeadLetterPublishingRecoverer(kafkaTemplate(),
                (record, exception) -> {
                    // Determine DLT topic name
                    String originalTopic = record.topic();
                    return new TopicPartition(originalTopic + ".DLT", -1);
                });
    }
    
    // Dead Letter Topic Consumer
    @KafkaListener(topics = "order-events.DLT", groupId = "dlt-processor")
    public void handleDeadLetterMessages(@Payload ConsumerRecord<String, Object> record,
                                       @Header Map<String, Object> headers) {
        
        log.error("Processing dead letter message from topic: {}, offset: {}", 
                record.topic(), record.offset());
        
        // Extract original exception information
        byte[] exceptionBytes = (byte[]) headers.get("kafka_dlt-exception-stacktrace");
        String exceptionStackTrace = new String(exceptionBytes);
        
        // Store for manual investigation
        DeadLetterMessage dlMessage = DeadLetterMessage.builder()
                .originalTopic(record.topic().replace(".DLT", ""))
                .key(record.key())
                .value(record.value().toString())
                .exception(exceptionStackTrace)
                .timestamp(Instant.now())
                .processed(false)
                .build();
        
        deadLetterRepository.save(dlMessage);
        
        // Send alert to operations team
        alertService.sendDeadLetterAlert(dlMessage);
    }
}
```

---

## 🎯 PERFORMANCE METRICS YOU MUST TRACK

```java
@Component
public class MessageQueueMetrics {
    
    private final MeterRegistry meterRegistry;
    private final Counter messagesSent;
    private final Counter messagesReceived;
    private final Timer processingTime;
    
    public MessageQueueMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.messagesSent = Counter.builder("messages.sent")
                .description("Number of messages sent")
                .register(meterRegistry);
        this.messagesReceived = Counter.builder("messages.received")
                .description("Number of messages received")
                .register(meterRegistry);
        this.processingTime = Timer.builder("message.processing.time")
                .description("Message processing time")
                .register(meterRegistry);
    }
    
    public void recordMessageSent(String topic) {
        messagesSent.increment(Tags.of("topic", topic));
    }
    
    public void recordMessageReceived(String topic) {
        messagesReceived.increment(Tags.of("topic", topic));
    }
    
    public Timer.Sample startProcessingTimer() {
        return Timer.start(meterRegistry);
    }
    
    public void recordProcessingTime(Timer.Sample sample, String topic, boolean success) {
        sample.stop(Timer.builder("message.processing.time")
                .tag("topic", topic)
                .tag("success", String.valueOf(success))
                .register(meterRegistry));
    }
}
```

---

---

## 🎓 KEY LEARNINGS & PRODUCTION INSIGHTS

### **Message Queue Selection Criteria**

**Choose RabbitMQ when:**
- You need complex routing (topic exchanges, headers)
- Message volumes < 100K/sec
- You want easy setup and management
- Strong consistency is more important than throughput

**Choose Kafka when:**
- You need high throughput (> 1M messages/sec)  
- Building event sourcing systems
- Need message replay capabilities
- Building real-time analytics pipelines

### **Common Production Pitfalls**

**1. Poison Messages:**
- **Problem:** Malformed messages that crash consumers
- **Solution:** Input validation + dead letter queues
- **Real Example:** A null value in payment amount crashed payment service for 2 hours

**2. Message Ordering Issues:**
- **Problem:** Out-of-order processing causes inconsistent state
- **Solution:** Partition messages by entity ID (user ID, order ID)
- **Real Example:** User balance updates processed out of order showed negative balance

**3. Consumer Lag Accumulation:**
- **Problem:** Slow consumers can't keep up with producers
- **Solution:** Auto-scaling based on queue depth + parallel processing
- **Real Example:** Email service lag during marketing campaigns delayed notifications by hours

**4. Duplicate Message Handling:**
- **Problem:** Network issues cause message redelivery
- **Solution:** Idempotent consumers with deduplication logic
- **Real Example:** Double-charged customers during payment retry storms

### **Monitoring & Alerting Strategy**

**Critical Metrics to Track:**
- **Queue Depth:** Alert if > 1000 messages
- **Consumer Lag:** Alert if lag > 30 seconds
- **Error Rate:** Alert if > 1% failed messages
- **Processing Time:** Alert if > 5 seconds average
- **Dead Letter Count:** Alert on any DLQ messages

**Production Dashboards:**
- Real-time message flow visualization
- Consumer health and performance metrics
- Error rate trends and anomaly detection
- Resource utilization (CPU, memory, disk)

---

## 🏆 TODAY'S ACHIEVEMENTS

By the end of Day 6, you've mastered:

1. **Architecture Decisions:** When to use RabbitMQ vs Kafka vs SQS
2. **RabbitMQ Patterns:** Dead letter queues, retry logic, message durability  
3. **Kafka Mastery:** High-throughput producers, consumer lag monitoring, error handling
4. **Event Sourcing:** Complete event store implementation with aggregate rebuilding
5. **Saga Pattern:** Distributed transaction management with compensation logic
6. **Production Monitoring:** Comprehensive metrics and alerting for message queues
7. **Failure Handling:** Dead letter topics, poison message detection, circuit breakers

**💡 Senior Engineer Insight:** Event-driven architecture isn't just about sending messages - it's about designing for failure, ensuring message ordering, and maintaining data consistency across distributed systems. The difference between junior and senior engineers is understanding that every message can fail, be duplicated, or arrive out of order - and designing systems that handle these scenarios gracefully.

---

## 🚀 TOMORROW'S PREVIEW: DAY 7

**Docker, Kubernetes & DevOps Pipeline** - Containerizing your applications and deploying them to production with zero-downtime deployments, auto-scaling, and monitoring.

Ready to ship code like a DevOps ninja? 🚢
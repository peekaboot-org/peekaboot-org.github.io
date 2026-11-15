Spring Boot leaves `spring.task.execution.propagate-context` off, and Peekaboot does not set
it. Turn it on:

```yaml
spring:
  task:
    execution:
      propagate-context: true
```

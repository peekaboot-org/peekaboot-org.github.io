Set `spring.task.execution.propagate-context: true`. Spring Boot leaves it off, and Peekaboot does
not set it.

```yaml
spring:
  task:
    execution:
      propagate-context: true
```

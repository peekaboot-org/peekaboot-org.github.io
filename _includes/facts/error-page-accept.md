Only a request whose `Accept` header names `text/html` gets the page. A bare `*/*`, as Swagger
UI, curl and `fetch()` send, does not count, and those clients get Spring Boot's usual error
response.

- **Username:** `peekaboot.security.username`, else your build's artifact id plus `-admin`,
  else `spring.application.name` plus `-admin`, else `peekaboot-admin`. A derived name is
  lowercased and every character outside `a-z`, `0-9`, `.`, `_` and `-` becomes `-`, so
  `Orders Service!` gives `orders-service--admin`. A name you set is used as written.
- **Password**, the first that applies:
  1. `peekaboot.security.password` or the environment variable `PEEKABOOT_SECURITY_PASSWORD`.
  2. The hash stored in `security.properties`.
  3. A 26-character password generated on first start and printed once, in the startup log's
     `Peekaboot Security` block. Only its hash is stored, in `security.properties` in the
     [storage directory]({{ '/docs/configuration/' | relative_url }}#peekabootstorage) while
     storage is on, or at `peekaboot.security.credentials-file`. Without either, each start
     generates a new password.

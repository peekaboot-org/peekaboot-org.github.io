- **Username:** `peekaboot.security.username`, else your build's artifact id plus `-admin`,
  else `spring.application.name` plus `-admin`, else `peekaboot-admin`.
- **Password:** `peekaboot.security.password` or the environment variable
  `PEEKABOOT_SECURITY_PASSWORD`, else the hash stored in `security.properties`, else a
  26-character password generated on first start and printed once, in the startup log's
  `Peekaboot Security` block. Only its hash is stored, in `security.properties` in the [storage
  directory]({{ '/docs/configuration/' | relative_url }}#peekabootstorage) while storage is on,
  or at `peekaboot.security.credentials-file`. Without either, each start generates a new
  password.

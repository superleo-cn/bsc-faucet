# Architecture

## Overview
BSC Testnet faucet service. Components:
- HTTP API (Express)
- Claim Service (cooldown + concurrency guard)
- Tx Sender (viem wallet client)
- Persistence (SQLite via better-sqlite3)
- Metrics (prom-client) optional
- Rate limiting (express-rate-limit)

## Sequence (Claim)
1. Request POST /claim { address }
2. Normalize & validate address
3. Query last success claim
4. If cooldown active -> 429
5. Build & send transaction (native or BEP20)
6. Insert record SUCCESS or FAILED
7. Return JSON

## Concurrency & Idempotency
- In-memory Map inFlight to collapse parallel requests for same address.
- DB used for historical queries and cooldown enforcement.

## Future Improvements
- Redis distributed lock & rate limit
- Captcha / signature challenge
- Observability: tracing, structured error codes
- Circuit breaker for RPC errors

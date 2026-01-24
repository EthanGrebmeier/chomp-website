# Recipe URL Ingredients Sprint Plan

## Goal
Deliver a demoable API endpoint that accepts a recipe URL, authenticates via
Clerk, fetches and parses the page, uses Anthropic to extract ingredients, and
returns normalized JSON with robust error handling and tests.

## Sprint Tasks (Atomic, Committable)

### 1) Server Configuration and Env Validation
- **Status**: Done
- **Work**: Add centralized config for required env vars (Clerk + Anthropic),
  validate at server startup, and expose typed config values.
- **Notes**: Added `server/config.ts` with validation and startup guard.
- **Tests/Validation**: Unit test config validation; manual run without env vars
  returns clear error at startup.
- **Deliverable**: `config.ts` (or similar) and validation logic.

### 2) Request/Response Types and Schemas
- **Status**: Done
- **Work**: Defined TypeScript types for request/response/errors and added Zod
  schemas for request/response/error validation (including http/https URL checks).
- **Tests/Validation**: Types check via `pnpm tsc`.
- **Deliverable**: `server/recipe-url-ingredients/types.ts` and
  `server/recipe-url-ingredients/schema.ts`.

### 3) Clerk Auth Middleware
- **Status**: Not started
- **Work**: Implement middleware to verify Clerk session token, attach `userId`,
  and return standardized `401` on failure.
- **Tests/Validation**: Unit test with mocked Clerk verification; integration
  test with invalid token returns `401`.
- **Deliverable**: `auth.ts` middleware + error mapping.

### 4) Rate Limiting Middleware
- **Status**: Not started
- **Work**: Add per-user rate limiting (e.g., 30 req/min). Use memory store for
  now; structure for future Redis.
- **Tests/Validation**: Unit test throttle behavior; manual test by hitting
  endpoint > limit returns `429`.
- **Deliverable**: `rateLimit.ts` middleware.

### 5) URL Validation + SSRF Protections
- **Status**: Not started
- **Work**: Validate scheme, reject localhost/private IPs, and disallow file
  URLs. Resolve DNS and reject private ranges including IPv6.
- **Tests/Validation**: Unit tests for SSRF edge cases.
- **Deliverable**: `urlValidation.ts` with comprehensive validation.

### 6) HTML Fetching with Limits
- **Status**: Not started
- **Work**: Implement fetch with timeouts, max size (2 MB), and redirect cap.
- **Tests/Validation**: Unit test for timeout and content size behavior using
  mocked fetch; manual test with large response.
- **Deliverable**: `htmlFetch.ts`.

### 7) Main Content Extraction
- **Status**: Not started
- **Work**: Parse HTML, strip scripts/styles, attempt readability extraction,
  fallback to body text if needed.
- **Tests/Validation**: Unit tests with sample HTML snapshots.
- **Deliverable**: `contentExtract.ts`.

### 8) Anthropic Client Setup
- **Status**: Not started
- **Work**: Create Anthropic client wrapper with injected API key, timeouts, and
  request tracing.
- **Tests/Validation**: Unit test client construction and error wrapping.
- **Deliverable**: `anthropicClient.ts`.

### 9) Prompt + AI Response Parsing
- **Status**: Not started
- **Work**: Build prompt to request strict JSON output; parse and validate AI
  response against schema; return `422` on malformed response.
- **Tests/Validation**: Unit tests with mocked Anthropic responses (valid/invalid).
- **Deliverable**: `aiExtract.ts`.

### 10) Ingredient Normalization
- **Status**: Not started
- **Work**: Normalize names, whitespace, and units (lowercase); handle nulls.
- **Tests/Validation**: Unit tests for normalization edge cases (fractions, units).
- **Deliverable**: `normalizeIngredients.ts`.

### 11) API Route Assembly
- **Status**: Not started
- **Work**: Add `POST /api/recipes/ingredients-from-url` route, chain middleware,
  and return success/error responses per spec.
- **Tests/Validation**: Integration test for happy path with mocked AI + fetch.
- **Deliverable**: Route handler wired into server.

### 12) Error Handling + Standard Responses
- **Status**: Not started
- **Work**: Implement centralized error handler with consistent error codes and
  response shape.
- **Tests/Validation**: Unit tests for error mapping; integration tests for
  invalid URL and fetch timeout.
- **Deliverable**: `errors.ts` + Express error middleware.

### 13) Observability and Logging
- **Status**: Not started
- **Work**: Add request id, user id, host, fetch latency, and AI latency logging.
  Avoid logging full URL query strings or HTML.
- **Tests/Validation**: Manual verification in dev logs.
- **Deliverable**: Logging utilities and middleware.

### 14) Integration Test Suite
- **Status**: Not started
- **Work**: Add integration tests covering success and key error paths. Use
  local mocks for fetch + Anthropic and a stubbed Clerk verifier.
- **Tests/Validation**: `pnpm test` (or equivalent) passes.
- **Deliverable**: Test files in server test directory.

### 15) Demo Script / Validation Checklist
- **Status**: Not started
- **Work**: Provide a simple curl script or README section that demonstrates
  successful request and error cases.
- **Tests/Validation**: Manual run against dev server.
- **Deliverable**: `docs/demo-recipe-url-api.md` or README update.

## Sequencing Rationale
- Start with configuration and types to stabilize interfaces.
- Add auth + rate limiting before network/AI work to protect resources.
- Implement fetch + extraction + AI in layered modules for testability.
- Assemble the route and error handler after core modules are ready.
- Finish with integration tests and demo checklist for a runnable demo.

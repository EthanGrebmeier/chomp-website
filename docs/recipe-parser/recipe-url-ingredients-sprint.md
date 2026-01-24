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
- **Status**: Done
- **Work**: Implemented `createClerkAuthMiddleware` using `@clerk/express`
  `clerkMiddleware()` + `getAuth()` to attach `userId` and return standardized
  `401` on failure.
- **Tests/Validation**: Types check via `pnpm tsc`.
- **Deliverable**: `server/recipe-url-ingredients/auth.ts`.

### 4) Rate Limiting Middleware
- **Status**: Done
- **Work**: Added per-user rate limiting (30 req/min) with in-memory store.
  Structured with `RateLimitStore` interface for future Redis migration.
  Includes rate limit headers (X-RateLimit-Limit/Remaining/Reset) and
  Retry-After on 429.
- **Tests/Validation**: Types check via `pnpm tsc`.
- **Deliverable**: `server/recipe-url-ingredients/rateLimit.ts`.

### 5) URL Validation + SSRF Protections
- **Status**: Done
- **Work**: Basic URL validation (scheme check) in `urlValidation.ts`. SSRF
  protection delegated to `request-filtering-agent` library which blocks private
  IPs, handles DNS rebinding, and works at the HTTP agent level during fetch.
- **Tests/Validation**: Types check via `pnpm tsc`.
- **Deliverable**: `server/recipe-url-ingredients/urlValidation.ts` +
  `request-filtering-agent` dependency.

### 6) HTML Fetching with Limits
- **Status**: Done
- **Work**: Implemented fetch with timeouts (10s default), max size (2MB),
  redirect cap (5), SSRF protection via request-filtering-agent, content-type
  validation, and streaming body reader with size enforcement.
- **Tests/Validation**: Types check via `pnpm tsc`.
- **Deliverable**: `server/recipe-url-ingredients/htmlFetch.ts`.

### 7) Main Content Extraction
- **Status**: Done
- **Work**: Implemented content extraction using `@mozilla/readability` and
  `linkedom`. Removes unwanted elements (scripts, styles, nav, ads), extracts
  article content via Readability, falls back to cleaned body text if needed.
- **Tests/Validation**: Types check via `pnpm tsc`.
- **Deliverable**: `server/recipe-url-ingredients/contentExtract.ts`.

### 8) Anthropic Client Setup
- **Status**: Done
- **Work**: Created Anthropic client wrapper using `@anthropic-ai/sdk` with
  configurable timeouts (default 30s), max retries, and request ID tracing.
  Includes typed error handling that maps Anthropic API errors to domain-specific
  error codes (api_error, authentication_error, rate_limit_error, timeout_error,
  invalid_request_error). Includes extraction prompt for ingredient parsing.
- **Tests/Validation**: Types check via `pnpm tsc`.
- **Deliverable**: `server/recipe-url-ingredients/anthropicClient.ts`.

### 9) Prompt + AI Response Parsing
- **Status**: Done
- **Work**: Implemented AI response parsing and validation in `aiExtract.ts`. Uses
  Zod schema to validate the raw JSON from Claude. Handles common edge cases like
  markdown code blocks around JSON. Exports typed `AIExtraction` result and
  `AIExtractError` for parse/validation failures. The prompt was already built
  into `anthropicClient.ts` (Task 8).
- **Tests/Validation**: Types check via `pnpm tsc`.
- **Deliverable**: `server/recipe-url-ingredients/aiExtract.ts`.

### 10) Ingredient Normalization
- **Status**: Done
- **Work**: Implemented ingredient normalization with whitespace cleanup, unit
  standardization (maps common variations like "tablespoons" → "tbsp"), and
  lowercase ingredient names. Handles null values and empty strings properly.
- **Tests/Validation**: 49 unit tests covering unit mappings, whitespace handling,
  fractional quantities, null/empty edge cases. Tests pass via `pnpm test`.
- **Deliverable**: `server/recipe-url-ingredients/normalizeIngredients.ts` +
  `server/recipe-url-ingredients/normalizeIngredients.test.ts`.

### 11) API Route Assembly
- **Status**: Done
- **Work**: Added `POST /api/recipes/ingredients-from-url` route that chains auth
  middleware (Clerk), rate limiting, and the main handler. Handler validates
  request body with Zod, validates URL structure, fetches HTML, extracts content,
  calls Anthropic AI, parses/validates AI response, normalizes ingredients, and
  returns standardized success/error responses.
- **Tests/Validation**: Types check via `pnpm tsc`. Existing tests pass.
- **Deliverable**: `server/recipe-url-ingredients/route.ts` + wired into
  `server/index.ts`.

### 12) Error Handling + Standard Responses
- **Status**: Done
- **Work**: Implemented centralized error handling with `RecipeUrlIngredientsError`
  custom error class, HTTP status code mappings, `asyncHandler` wrapper for async
  routes, and Express error middleware (`recipeUrlIngredientsErrorHandler`).
  Refactored route handler to throw errors that flow to centralized middleware
  while preserving rich metrics logging.
- **Tests/Validation**: Types check via `pnpm tsc`. Existing tests pass.
- **Deliverable**: `server/recipe-url-ingredients/errors.ts` + error middleware
  wired into `server/index.ts` + refactored `route.ts`.

### 13) Observability and Logging
- **Status**: Done
- **Work**: Added structured logging with request ID generation, timing helpers, and
  JSON log output. Logging middleware attaches request context (requestId, userId,
  startTime) to requests. Route handler logs fetch latency, AI latency, token usage,
  total latency, URL host (not full query strings), and error codes. Auth middleware
  populates userId in context for tracing.
- **Tests/Validation**: Types check via `pnpm tsc`. Existing tests pass.
- **Deliverable**: `server/recipe-url-ingredients/logging.ts` + updated route.ts and
  auth.ts.

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

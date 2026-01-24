# Recipe URL Ingredients API Spec

## Goal
Enable an authenticated user to submit a recipe URL and receive a normalized
ingredient list (plus optional metadata) extracted by AI from the page content.

## Scope
- Backend API endpoint only (no UI changes).
- Uses Clerk for authentication.
- Uses Anthropic for AI extraction.

## API Contract
### Endpoint
`POST /api/recipes/ingredients-from-url`

### Auth
`Authorization: Bearer <clerk_session_token>`

### Request Body
```json
{
  "url": "https://example.com/recipe/spaghetti"
}
```

### Success Response (200)
```json
{
  "sourceUrl": "https://example.com/recipe/spaghetti",
  "recipeName": "Spaghetti Pomodoro",
  "servings": "4",
  "ingredients": [
    { "name": "spaghetti", "quantity": 12, "unit": "oz" },
    { "name": "olive oil", "quantity": 2, "unit": "tbsp" },
    { "name": "garlic", "quantity": 3, "unit": "cloves", "notes": "minced" }
  ]
}
```

### Error Response
```json
{
  "error": {
    "code": "invalid_url",
    "message": "URL must be http(s) and publicly reachable."
  }
}
```

### Status Codes
- `200` OK: ingredients extracted successfully
- `400` invalid_url, unsupported_content
- `401` unauthorized
- `404` not_found (URL returns 404)
- `408` fetch_timeout
- `413` content_too_large
- `422` parse_failed (AI response not usable)
- `429` rate_limited
- `500` server_error

## Auth (Clerk)
- Client sends Clerk session token in `Authorization` header.
- Server verifies token with Clerk backend SDK (e.g. `clerk.verifyToken`).
- Missing or invalid token returns `401` with error body.
- Include `userId` in logs for traceability (no PII beyond Clerk id).

## Parsing Pipeline
1. **Validate URL**
   - Require `http` or `https`.
   - Reject localhost and private IP ranges.
2. **Fetch HTML**
   - Use a short connect/read timeout (e.g. 8s total).
   - Limit max response size (e.g. 2 MB).
   - Follow a small redirect chain (e.g. up to 3).
3. **Extract Main Content**
   - Strip scripts/styles and extract article-like content.
   - Fall back to full body text if extraction is low confidence.
4. **AI Extraction (Anthropic)**
   - Prompt model to return strict JSON matching schema below.
   - Include source URL and any visible ingredient list text.
5. **Validate & Normalize**
   - Validate JSON shape.
   - Normalize whitespace, units (lowercase), and ingredient names.
   - If no ingredients found, return `422 parse_failed`.

### AI Output Schema (expected)
```json
{
  "recipeName": "string | null",
  "servings": "string | null",
  "ingredients": [
    { "name": "string", "quantity": "number | null", "unit": "string | null", "notes": "string | null" }
  ]
}
```

## Security & Compliance
- SSRF protections: block private IPs, `localhost`, and non-http(s).
- Disallow file URLs and local network ranges.
- Enforce response size limit and timeout.
- Rate limit per user (e.g. 30 req/min).
- Do not store raw HTML content.

## Observability
- Log request id, user id, URL host, fetch latency, AI latency, and token usage.
- Do not log full page content or full URL query strings.

## Testing Plan
- Unit tests for URL validation and SSRF checks.
- Unit tests for response normalization.
- Mocked Anthropic response parsing.
- Integration test using a stable public recipe URL.

## Future Considerations
- Cache results by URL + userId for short TTL to reduce cost.
- Add ingredient normalization to a canonical grocery item list.

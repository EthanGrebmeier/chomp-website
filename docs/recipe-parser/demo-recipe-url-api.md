# Recipe URL Ingredients API Demo

This document provides curl examples to demonstrate the Recipe URL Ingredients API endpoint.

## Prerequisites

1. **Server running**: Start the dev server with `pnpm dev`
2. **Environment variables**: Ensure `.env` has valid `CLERK_SECRET_KEY` and `ANTHROPIC_API_KEY`
3. **Clerk session token**: Obtain a valid Clerk session token from your frontend app

## Endpoint

```
POST /api/recipes/ingredients-from-url
```

## Authentication

All requests require a valid Clerk session token in the `Authorization` header:

```
Authorization: Bearer <clerk_session_token>
```

## Success Example

### Request

```bash
curl -X POST http://localhost:3000/api/recipes/ingredients-from-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -d '{"url": "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"}'
```

### Response (200 OK)

```json
{
  "sourceUrl": "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/",
  "recipeName": "Best Chocolate Chip Cookies",
  "servings": "48 cookies",
  "ingredients": [
    { "name": "all-purpose flour", "quantity": 2.25, "unit": "cups", "notes": null },
    { "name": "baking soda", "quantity": 1, "unit": "tsp", "notes": null },
    { "name": "salt", "quantity": 1, "unit": "tsp", "notes": null },
    { "name": "butter", "quantity": 1, "unit": "cup", "notes": "softened" },
    { "name": "white sugar", "quantity": 0.75, "unit": "cup", "notes": null },
    { "name": "brown sugar", "quantity": 0.75, "unit": "cup", "notes": "packed" },
    { "name": "vanilla extract", "quantity": 1, "unit": "tsp", "notes": null },
    { "name": "eggs", "quantity": 2, "unit": null, "notes": "large" },
    { "name": "chocolate chips", "quantity": 2, "unit": "cups", "notes": null }
  ]
}
```

## Error Examples

### 1. Missing URL (400)

```bash
curl -X POST http://localhost:3000/api/recipes/ingredients-from-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -d '{}'
```

**Response:**

```json
{
  "error": {
    "code": "invalid_url",
    "message": "Invalid input: expected string, received undefined"
  }
}
```

### 2. Invalid URL Scheme (400)

```bash
curl -X POST http://localhost:3000/api/recipes/ingredients-from-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -d '{"url": "ftp://example.com/recipe"}'
```

**Response:**

```json
{
  "error": {
    "code": "invalid_url",
    "message": "URL must be http(s) and publicly reachable."
  }
}
```

### 3. SSRF Blocked - Private IP (400)

```bash
curl -X POST http://localhost:3000/api/recipes/ingredients-from-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -d '{"url": "http://192.168.1.1/recipe"}'
```

**Response:**

```json
{
  "error": {
    "code": "invalid_url",
    "message": "Request blocked: target address not allowed"
  }
}
```

### 4. Unauthorized - Missing Token (401)

```bash
curl -X POST http://localhost:3000/api/recipes/ingredients-from-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/recipe"}'
```

**Response:**

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Authentication required"
  }
}
```

### 5. Rate Limited (429)

After exceeding 30 requests per minute:

**Response:**

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded. Try again later."
  }
}
```

**Headers include:**

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706000000
Retry-After: 45
```

### 6. Non-Recipe Page (400)

```bash
curl -X POST http://localhost:3000/api/recipes/ingredients-from-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -d '{"url": "https://example.com/"}'
```

**Response:**

```json
{
  "error": {
    "code": "unsupported_content",
    "message": "No ingredients found in page"
  }
}
```

### 7. PDF or Non-HTML Content (400)

```bash
curl -X POST http://localhost:3000/api/recipes/ingredients-from-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -d '{"url": "https://example.com/recipe.pdf"}'
```

**Response:**

```json
{
  "error": {
    "code": "unsupported_content",
    "message": "Expected HTML content-type, got: application/pdf"
  }
}
```

## Error Code Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_url` | 400 | URL is malformed, not http(s), or blocked by SSRF protection |
| `unsupported_content` | 400 | Content is not HTML or page has no recipe ingredients |
| `unauthorized` | 401 | Missing or invalid Clerk session token |
| `not_found` | 404 | Target URL returns 404 |
| `fetch_timeout` | 408 | Request to URL timed out (> 10s) |
| `content_too_large` | 413 | Response exceeds 2MB limit |
| `parse_failed` | 422 | AI response couldn't be parsed as valid ingredients |
| `rate_limited` | 429 | Exceeded 30 requests per minute |
| `server_error` | 500 | Unexpected server error |

## Testing Checklist

- [ ] Valid recipe URL returns ingredients
- [ ] Missing URL returns 400 invalid_url
- [ ] Non-HTTP URL returns 400 invalid_url
- [ ] Localhost/private IP returns 400 invalid_url (SSRF blocked)
- [ ] Missing auth token returns 401 unauthorized
- [ ] Non-recipe page returns 400 unsupported_content
- [ ] Rate limiting kicks in after 30 requests/minute

## Shell Script for Quick Testing

Save the following as `test-recipe-api.sh`:

```bash
#!/bin/bash

# Set your Clerk session token
CLERK_TOKEN="${CLERK_SESSION_TOKEN:-your-token-here}"
BASE_URL="${API_BASE_URL:-http://localhost:3000}"

echo "=== Testing Recipe URL Ingredients API ==="
echo ""

# Test 1: Valid recipe URL
echo "1. Testing valid recipe URL..."
curl -s -X POST "$BASE_URL/api/recipes/ingredients-from-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d '{"url": "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"}' | jq .
echo ""

# Test 2: Missing URL
echo "2. Testing missing URL..."
curl -s -X POST "$BASE_URL/api/recipes/ingredients-from-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d '{}' | jq .
echo ""

# Test 3: Invalid URL scheme
echo "3. Testing invalid URL scheme..."
curl -s -X POST "$BASE_URL/api/recipes/ingredients-from-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d '{"url": "ftp://example.com/recipe"}' | jq .
echo ""

# Test 4: Missing auth token
echo "4. Testing missing auth token..."
curl -s -X POST "$BASE_URL/api/recipes/ingredients-from-url" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/recipe"}' | jq .
echo ""

echo "=== Done ==="
```

Run with:

```bash
export CLERK_SESSION_TOKEN="your-clerk-token"
chmod +x test-recipe-api.sh
./test-recipe-api.sh
```

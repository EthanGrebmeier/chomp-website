# API Specification: Recipe URL Ingredients

## Endpoint

```
POST /api/recipes/ingredients-from-url
```

## Authentication

Requires Clerk authentication. Include the session token as a Bearer token in the `Authorization` header.

---

## Request

**Content-Type:** `application/json`

**Body:**

```typescript
{
  url: string  // Required. Must be http:// or https://
  categories?: Array<{   // Optional. The user's categories, in display order.
    value: string        // Stable id, e.g. "produce", "spices", "costco-run"
    label: string        // Display name, e.g. "Fruit & Veg", "Spices"
  }>
}
```

If `categories` is missing, the defaults are used: `produce` (Produce), `deli` (Deli),
`dairy` (Dairy), `bakery` (Bakery), `frozen` (Frozen), `beverages` (Beverages),
`snacks` (Snacks), `health-beauty` (Health & Beauty), `household` (Household), `other` (Other).

Bad `categories` input is cleaned up and never rejects the request:

- Entries whose `value` or `label` isn't a non-empty string (after trimming) are dropped.
- Entries whose `value` or `label` is longer than 100 characters are dropped.
- Duplicate `value`s keep the first entry.
- At most the first 100 valid entries are kept.
- If nothing is left (or `categories` isn't an array), the defaults are used.

`other` is always offered to the model, even if it isn't in the list.

---

## Success Response

**Status:** `200 OK`

```typescript
{
  sourceUrl: string              // The original URL submitted
  recipeName: string | null      // Extracted recipe name (if found)
  servings: string | null        // Serving size info (if found)
  ingredients: Array<{
    name: string             // e.g., "chicken breast"
    quantity: number | null  // e.g., 2
    unit: string | null      // e.g., "cups", "lbs"
    notes: string | null     // e.g., "diced", "room temperature"
    category: string         // One of the offered category `value`s, or "other". Never a label.
  }>
}
```

---

## Error Response

**Format:**

```typescript
{
  error: {
    code: string   // Error code from table below
    message: string  // Human-readable description
  }
}
```

**Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_url` | 400 | URL is malformed or not http(s) |
| `unsupported_content` | 400 | Page doesn't contain recipe/ingredients |
| `unauthorized` | 401 | Missing or invalid auth token |
| `not_found` | 404 | Resource not found |
| `fetch_timeout` | 408 | Timed out fetching the URL |
| `content_too_large` | 413 | Page content exceeds size limit |
| `parse_failed` | 422 | Failed to parse ingredients from page |
| `rate_limited` | 429 | Too many requests |
| `server_error` | 500 | Internal server error |

---

## Rate Limiting

**Limit:** 30 requests per minute per authenticated user

**Response Headers:**

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests per window (30) |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Seconds until window resets |
| `Retry-After` | Seconds to wait (only on 429 responses) |

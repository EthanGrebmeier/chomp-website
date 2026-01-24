#!/bin/bash

# Set your Clerk session token
CLERK_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zN3A1VzV3MGhyc3Q3ZllQWmlOd3BxaWZVb2QiLCJ0eXAiOiJKV1QifQ.eyJlbWFpbCI6ImV0aGFuZ3JlYm1laWVyQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJleHAiOjE3NjkyMzUxMzgsImZ2YSI6WzI0LC0xXSwiaWF0IjoxNzY5MjM1MDc4LCJpc3MiOiJodHRwczovL2NsZXJrLmNob21wZ3JvY2VyeS5jb20iLCJqdGkiOiJlYzU4Y2VhYTMxM2ZiYTQzNjlkZCIsIm5iZiI6MTc2OTIzNTA2OCwic2lkIjoic2Vzc18zOGd1YU1FbEg1NUdyYlRkZ3JhRjhER1ltR0UiLCJzdHMiOiJhY3RpdmUiLCJzdWIiOiJ1c2VyXzM4UmIyUjVsQmc4YWZYWkNScnFDZURSNWEzTiIsInYiOjJ9.AApP8kO2c5SqtP65fzvdmXSbwfcGOt_WY0YiG3fa_ek6sO1XLb0aSsITDwRbjfnPE981jpNrh21lI5nVIYuStM8J7hPvNx56sewWkoO-QZoCkYu7u83GFb-u3a71JRsbIj6fZ2I2O2CjTntO6nAgb7nnI1AKhmmtFDlSijaMg_VL-Kikgjo1Y1P6fqyIt64ZjyIkvXQwbf9rKsqwuIPKoF3Nyg1jMQ0H8qeo2YtSnbRwctDo_pjiUapnph9FvpBf4c6-CPzFpqW8gwx14uYVONaELzGTVDU1fsca6DsO42zBRhP-Uhbe5qPJdVJRVoee3rceEnBufNd_MmitIWmPOg"
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
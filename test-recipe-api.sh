#!/bin/bash

# Set your Clerk session token
CLERK_TOKEN="eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zN3A1VzV3MGhyc3Q3ZllQWmlOd3BxaWZVb2QiLCJ0eXAiOiJKV1QifQ.eyJlbWFpbCI6ImV0aGFuZ3JlYm1laWVyQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJleHAiOjE3NjkyMzU4NjEsImZ2YSI6WzM2LC0xXSwiaWF0IjoxNzY5MjM1ODAxLCJpc3MiOiJodHRwczovL2NsZXJrLmNob21wZ3JvY2VyeS5jb20iLCJqdGkiOiIzMjA2YTQ1ZTZjN2RlNWQwNGIzNiIsIm5iZiI6MTc2OTIzNTc5MSwic2lkIjoic2Vzc18zOGd1YU1FbEg1NUdyYlRkZ3JhRjhER1ltR0UiLCJzdHMiOiJhY3RpdmUiLCJzdWIiOiJ1c2VyXzM4UmIyUjVsQmc4YWZYWkNScnFDZURSNWEzTiIsInYiOjJ9.on7zvKuIMYW2AoUBvw1qCIlrmB151Pn84bANj7mAMoNhSeJ6ZgqB_VpHFcW2HzclAkrLT-sOSY-3Omr6THhAasGaKMv7ZIReYYnVmiLaYcjkP7SYqu-bLEzzhdO0tJMZOTeu_Y8ImLrv2vX2UQH-z7oJZwICnUP6KzfRcD-YOvBITcIPCuJ3z9IOzZslzeSOKmqMUflxE0-eTDCzGS2ajy6rS9jaVoj50a3LtQDMJEX-lxyjhpBmw1enPKzs7-Dv_W9p_qdIaAzLoeQrk4kV2d72CYiUGe3tutjZ9DubUzSkZxCkRVS4fiWR5-UXKm7ha6eIyKWrkwjX34gnw7y5PQ"
BASE_URL="${API_BASE_URL:-http://localhost:3000}"

echo "=== Testing Recipe URL Ingredients API ==="
echo ""

# Test 1: Valid recipe URL
echo "1. Testing valid recipe URL..."
curl -s -X POST "$BASE_URL/api/recipes/ingredients-from-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -d '{"url": "https://easyhomecookingrecipes.net/sticky-garlic-chicken-noodles-recipe/"}' | jq .
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
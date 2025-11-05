#!/bin/bash

echo "=== Test 1: Get Auth Token ==="
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:30}..."
echo ""

echo "=== Test 2: Create Student ==="
curl -s -X POST http://localhost:3001/api/students \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"STU001","first_name":"John","last_name":"Doe","grade_level":10,"grade_category":"HONOR"}' | head -c 200
echo -e "\n"

echo "=== Test 3: List Students ==="
curl -s -X GET http://localhost:3001/api/students \
  -H "Authorization: Bearer $TOKEN" | head -c 500
echo -e "\n"

echo "=== Test 4: Search Students ==="
curl -s -X GET "http://localhost:3001/api/students/search/John?limit=10" \
  -H "Authorization: Bearer $TOKEN" | head -c 500
echo -e "\n"

#!/bin/bash

echo "=== Getting Auth Token ==="
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Token obtained: ${TOKEN:0:30}..."

echo ""
echo "=== Creating Test Student ==="
curl -s -X POST http://localhost:3001/api/students \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"STU001","first_name":"John","last_name":"Doe","grade_level":10,"grade_category":"HONOR"}'

echo ""
echo ""
echo "=== Listing Students ==="
curl -s -X GET http://localhost:3001/api/students \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""
echo "=== Testing Search ==="
curl -s -X GET "http://localhost:3001/api/students/search/John?limit=10" \
  -H "Authorization: Bearer $TOKEN"

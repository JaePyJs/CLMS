#!/bin/bash

# Get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo "Token: ${TOKEN:0:20}..."

# Create test student
curl -s -X POST http://localhost:3001/api/students \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"STU001","first_name":"John","last_name":"Doe","grade_level":10,"grade_category":"HONOR"}' | jq '.'

echo ""
echo "Getting student list..."
curl -s -X GET http://localhost:3001/api/students \
  -H "Authorization: Bearer $TOKEN" | jq '.'

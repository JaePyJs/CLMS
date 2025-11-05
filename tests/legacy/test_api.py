#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:3001/api"

def test_api():
    # Get auth token
    print("=== Test 1: Authentication ===")
    login_data = {"username": "admin", "password": "admin123"}
    login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    token_data = login_response.json()
    access_token = token_data['data']['accessToken']
    print(f"Token obtained: {access_token[:30]}...")
    print()

    # Create headers
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    # Test 2: Create student
    print("=== Test 2: Create Student (Jane Smith) ===")
    student_data = {
        "student_id": "STU002",
        "first_name": "Jane",
        "last_name": "Smith",
        "grade_level": 11,
        "grade_category": "ADVANCED"
    }
    create_response = requests.post(f"{BASE_URL}/students", headers=headers, json=student_data)
    print(f"Status: {create_response.status_code}")
    print(f"Response: {json.dumps(create_response.json(), indent=2)[:300]}")
    print()

    # Test 3: List students
    print("=== Test 3: List Students ===")
    list_response = requests.get(f"{BASE_URL}/students", headers=headers)
    print(f"Status: {list_response.status_code}")
    students = list_response.json()
    print(f"Found {students['count']} students")
    print()

    # Test 4: Search students
    print("=== Test 4: Search Students ===")
    search_response = requests.get(f"{BASE_URL}/students/search/Jane?limit=10", headers=headers)
    print(f"Status: {search_response.status_code}")
    search_results = search_response.json()
    print(f"Search results: {search_results['count']} students found")
    print()

    # Test 5: Generate barcode for student
    print("=== Test 5: Generate Barcode ===")
    if students['count'] > 0:
        student_id = students['data'][0]['id']
        barcode_response = requests.post(f"{BASE_URL}/students/generate-barcode/{student_id}", headers=headers)
        print(f"Status: {barcode_response.status_code}")
        barcode_data = barcode_response.json()
        if barcode_data.get('success'):
            print(f"Generated barcode: {barcode_data['data'].get('barcode', 'N/A')}")
        else:
            print(f"Error: {barcode_data.get('message')}")
    print()

    print("=== All tests completed ===")

if __name__ == "__main__":
    test_api()

#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:3001/api"

def test_barcode():
    # Get auth token
    print("Getting auth token...")
    login_data = {"username": "admin", "password": "admin123"}
    login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    access_token = login_response.json()['data']['accessToken']
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    # Get student with barcode
    print("\n=== Test: Get Student by Barcode ===")
    barcode = "96667823223"  # The barcode generated in the previous test
    barcode_response = requests.get(f"{BASE_URL}/students/barcode/{barcode}", headers=headers)
    print(f"Status: {barcode_response.status_code}")

    if barcode_response.status_code == 200:
        student = barcode_response.json()
        print(f"Success! Found student: {student['data']['first_name']} {student['data']['last_name']}")
        print(f"Student ID: {student['data']['student_id']}")
        print(f"Barcode: {student['data']['barcode']}")
    else:
        print(f"Error: {barcode_response.json()}")

    # Test invalid barcode
    print("\n=== Test: Invalid Barcode ===")
    invalid_response = requests.get(f"{BASE_URL}/students/barcode/99999999999", headers=headers)
    print(f"Status: {invalid_response.status_code}")
    print(f"Response: {invalid_response.json()}")

if __name__ == "__main__":
    test_barcode()

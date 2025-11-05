#!/usr/bin/env python3
"""
CLMS Comprehensive Integration Test
Tests complete workflows across all modules
"""
import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3001/api"

class CLMSIntegrationTest:
    def __init__(self):
        self.access_token = None
        self.test_data = {
            'student': None,
            'book': None,
            'equipment': None,
            'checkout': None
        }
        self.results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }

    def log_test(self, test_name, status, message=""):
        """Log test result"""
        icon = "[PASS]" if status else "[FAIL]"
        print(f"{icon} {test_name}: {message}")
        if status:
            self.results['passed'] += 1
        else:
            self.results['failed'] += 1
            self.results['errors'].append(f"{test_name}: {message}")

    def authenticate(self):
        """Authenticate and get access token"""
        print("\n" + "="*70)
        print("STEP 1: AUTHENTICATION")
        print("="*70)

        login_data = {"username": "admin", "password": "admin123"}
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)

        if response.status_code == 200:
            self.access_token = response.json()['data']['accessToken']
            self.log_test("Authentication", True, "Login successful")
            return True
        else:
            self.log_test("Authentication", False, f"Failed with status {response.status_code}")
            return False

    def test_student_workflow(self):
        """Test complete student management workflow"""
        print("\n" + "="*70)
        print("STEP 2: STUDENT WORKFLOW")
        print("="*70)

        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

        # Create student
        student_data = {
            "student_id": f"INT_TEST_{int(time.time())}",
            "first_name": "Integration",
            "last_name": "Test Student",
            "grade_level": 10,
            "grade_category": "GENERAL",
            "section": "A"
        }

        response = requests.post(f"{BASE_URL}/students", headers=headers, json=student_data)
        if response.status_code == 201:
            self.test_data['student'] = response.json()['data']
            self.log_test("Create Student", True, f"Student ID: {self.test_data['student']['id']}")
        else:
            self.log_test("Create Student", False, f"Status: {response.status_code}")
            return False

        # Read student
        response = requests.get(f"{BASE_URL}/students/{self.test_data['student']['id']}", headers=headers)
        if response.status_code == 200:
            self.log_test("Read Student", True, "Student retrieved successfully")
        else:
            self.log_test("Read Student", False, "Failed to retrieve student")
            return False

        # Update student
        update_data = {"grade_level": 11}
        response = requests.put(f"{BASE_URL}/students/{self.test_data['student']['id']}", headers=headers, json=update_data)
        if response.status_code == 200:
            self.log_test("Update Student", True, "Student updated successfully")
        else:
            self.log_test("Update Student", False, "Failed to update student")
            return False

        # Search students
        response = requests.get(f"{BASE_URL}/students/search?q=Integration", headers=headers)
        if response.status_code == 200:
            self.log_test("Search Students", True, f"Found {len(response.json()['data'])} students")
        else:
            self.log_test("Search Students", False, "Search failed")
            return False

        return True

    def test_book_workflow(self):
        """Test complete book management workflow"""
        print("\n" + "="*70)
        print("STEP 3: BOOK WORKFLOW")
        print("="*70)

        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

        # Create book
        book_data = {
            "title": "Integration Test Book",
            "author": "Test Author",
            "isbn": f"978-{int(time.time())}",
            "accession_no": f"INT_TEST_{int(time.time())}",
            "category": "FICTION",
            "year": 2024
        }

        response = requests.post(f"{BASE_URL}/books", headers=headers, json=book_data)
        if response.status_code == 201:
            self.test_data['book'] = response.json()['data']
            self.log_test("Create Book", True, f"Book ID: {self.test_data['book']['id']}")
        else:
            self.log_test("Create Book", False, f"Status: {response.status_code}")
            return False

        # Read book
        response = requests.get(f"{BASE_URL}/books/{self.test_data['book']['id']}", headers=headers)
        if response.status_code == 200:
            self.log_test("Read Book", True, "Book retrieved successfully")
        else:
            self.log_test("Read Book", False, "Failed to retrieve book")
            return False

        # Update book
        update_data = {"edition": "2nd Edition"}
        response = requests.put(f"{BASE_URL}/books/{self.test_data['book']['id']}", headers=headers, json=update_data)
        if response.status_code == 200:
            self.log_test("Update Book", True, "Book updated successfully")
        else:
            self.log_test("Update Book", False, "Failed to update book")
            return False

        # Search books
        response = requests.get(f"{BASE_URL}/books/search?q=Integration", headers=headers)
        if response.status_code == 200:
            self.log_test("Search Books", True, f"Found books successfully")
        else:
            self.log_test("Search Books", False, "Search failed")
            return False

        # Check availability
        response = requests.get(f"{BASE_URL}/books/{self.test_data['book']['id']}/availability", headers=headers)
        if response.status_code == 200:
            self.log_test("Check Book Availability", True, "Availability checked")
        else:
            self.log_test("Check Book Availability", False, "Failed to check availability")
            return False

        return True

    def test_checkout_workflow(self):
        """Test complete checkout/return workflow"""
        print("\n" + "="*70)
        print("STEP 4: CHECKOUT WORKFLOW")
        print("="*70)

        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

        # Skip if we don't have required data
        if not self.test_data.get('book') or not self.test_data.get('student'):
            self.log_test("Checkout Book", False, "Missing required test data")
            return False

        # Checkout book
        checkout_data = {
            "book_id": self.test_data['book']['id'],
            "student_id": self.test_data['student']['id'],
            "due_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        }

        response = requests.post(f"{BASE_URL}/borrows", headers=headers, json=checkout_data)
        if response.status_code == 201:
            self.test_data['checkout'] = response.json()['data']
            self.log_test("Checkout Book", True, f"Checkout ID: {self.test_data['checkout']['id']}")
        else:
            self.log_test("Checkout Book", False, f"Status: {response.status_code}")
            return False

        # Get checkout details
        response = requests.get(f"{BASE_URL}/borrows?status=ACTIVE", headers=headers)
        if response.status_code == 200:
            self.log_test("List Active Checkouts", True, f"Found active checkouts")
        else:
            self.log_test("List Active Checkouts", False, "Failed to list checkouts")
            return False

        # Get overdue books
        response = requests.get(f"{BASE_URL}/borrows/overdue", headers=headers)
        if response.status_code == 200:
            self.log_test("Get Overdue Books", True, "Overdue check successful")
        else:
            self.log_test("Get Overdue Books", False, "Failed to get overdue books")
            return False

        # Return book
        response = requests.put(f"{BASE_URL}/borrows/{self.test_data['checkout']['id']}/return", headers=headers)
        if response.status_code == 200:
            self.log_test("Return Book", True, "Book returned successfully")
        else:
            self.log_test("Return Book", False, "Failed to return book")
            return False

        return True

    def test_equipment_workflow(self):
        """Test complete equipment management workflow"""
        print("\n" + "="*70)
        print("STEP 5: EQUIPMENT WORKFLOW")
        print("="*70)

        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

        # Create equipment
        equipment_data = {
            "name": "Integration Test Equipment",
            "category": "COMPUTER",
            "serial_number": f"INT_TEST_{int(time.time())}",
            "status": "AVAILABLE",
            "purchase_date": "2024-01-01"
        }

        response = requests.post(f"{BASE_URL}/equipment", headers=headers, json=equipment_data)
        if response.status_code == 201:
            self.test_data['equipment'] = response.json()['data']
            self.log_test("Create Equipment", True, f"Equipment ID: {self.test_data['equipment']['id']}")
        else:
            self.log_test("Create Equipment", False, f"Status: {response.status_code}")
            return False

        # Read equipment
        response = requests.get(f"{BASE_URL}/equipment/{self.test_data['equipment']['id']}", headers=headers)
        if response.status_code == 200:
            self.log_test("Read Equipment", True, "Equipment retrieved successfully")
        else:
            self.log_test("Read Equipment", False, "Failed to retrieve equipment")
            return False

        # Update equipment
        update_data = {"status": "IN_USE"}
        response = requests.put(f"{BASE_URL}/equipment/{self.test_data['equipment']['id']}", headers=headers, json=update_data)
        if response.status_code == 200:
            self.log_test("Update Equipment", True, "Equipment updated successfully")
        else:
            self.log_test("Update Equipment", False, "Failed to update equipment")
            return False

        return True

    def test_self_service_workflow(self):
        """Test self-service scanning workflow"""
        print("\n" + "="*70)
        print("STEP 6: SELF-SERVICE WORKFLOW")
        print("="*70)

        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

        # Check student status if available
        if self.test_data.get('student') and self.test_data['student'].get('barcode'):
            response = requests.get(f"{BASE_URL}/self-service/status/{self.test_data['student']['barcode']}", headers=headers)
            if response.status_code == 200:
                self.log_test("Check Student Status", True, "Status retrieved successfully")
            else:
                self.log_test("Check Student Status", False, "Failed to check status")
                return False
        else:
            self.log_test("Check Student Status", True, "Skipped (no barcode)")

        # Get statistics
        response = requests.get(f"{BASE_URL}/self-service/statistics", headers=headers)
        if response.status_code == 200:
            self.log_test("Get Self-Service Stats", True, "Statistics retrieved")
        else:
            self.log_test("Get Self-Service Stats", False, "Failed to get statistics")
            return False

        return True

    def test_analytics_workflow(self):
        """Test analytics and reporting workflow"""
        print("\n" + "="*70)
        print("STEP 7: ANALYTICS WORKFLOW")
        print("="*70)

        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

        # Dashboard analytics
        response = requests.get(f"{BASE_URL}/analytics/dashboard", headers=headers)
        if response.status_code == 200:
            data = response.json()['data']
            self.log_test("Dashboard Analytics", True, f"Total students: {data['overview']['total_students']}")
        else:
            self.log_test("Dashboard Analytics", False, "Failed to get dashboard")
            return False

        # Student analytics
        response = requests.get(f"{BASE_URL}/analytics/students", headers=headers)
        if response.status_code == 200:
            self.log_test("Student Analytics", True, "Student analytics retrieved")
        else:
            self.log_test("Student Analytics", False, "Failed to get student analytics")
            return False

        # Book analytics
        response = requests.get(f"{BASE_URL}/analytics/books", headers=headers)
        if response.status_code == 200:
            self.log_test("Book Analytics", True, "Book analytics retrieved")
        else:
            self.log_test("Book Analytics", False, "Failed to get book analytics")
            return False

        # Borrow analytics
        response = requests.get(f"{BASE_URL}/analytics/borrows", headers=headers)
        if response.status_code == 200:
            self.log_test("Borrow Analytics", True, "Borrow analytics retrieved")
        else:
            self.log_test("Borrow Analytics", False, "Failed to get borrow analytics")
            return False

        # Equipment analytics
        response = requests.get(f"{BASE_URL}/analytics/equipment", headers=headers)
        if response.status_code == 200:
            self.log_test("Equipment Analytics", True, "Equipment analytics retrieved")
        else:
            self.log_test("Equipment Analytics", False, "Failed to get equipment analytics")
            return False

        return True

    def test_error_handling(self):
        """Test error handling and edge cases"""
        print("\n" + "="*70)
        print("STEP 8: ERROR HANDLING")
        print("="*70)

        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

        # Test invalid ID
        response = requests.get(f"{BASE_URL}/students/invalid-id", headers=headers)
        if response.status_code == 404:
            self.log_test("Invalid ID Handling", True, "Correctly returned 404")
        else:
            self.log_test("Invalid ID Handling", False, f"Expected 404, got {response.status_code}")

        # Test duplicate creation
        if self.test_data.get('student') and self.test_data['student'].get('student_id'):
            duplicate_data = {
                "student_id": self.test_data['student']['student_id'],
                "first_name": "Duplicate",
                "last_name": "Test",
                "grade_level": 10
            }
            response = requests.post(f"{BASE_URL}/students", headers=headers, json=duplicate_data)
            if response.status_code in [400, 409]:
                self.log_test("Duplicate Creation Handling", True, "Correctly rejected duplicate")
            else:
                self.log_test("Duplicate Creation Handling", False, f"Expected 400/409, got {response.status_code}")
        else:
            self.log_test("Duplicate Creation Handling", True, "Skipped (no student data)")

        # Test missing required fields
        invalid_data = {"first_name": "Incomplete"}
        response = requests.post(f"{BASE_URL}/students", headers=headers, json=invalid_data)
        if response.status_code in [400, 422]:
            self.log_test("Validation Error Handling", True, "Correctly rejected invalid data")
        else:
            self.log_test("Validation Error Handling", False, f"Expected 400/422, got {response.status_code}")

        return True

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n" + "="*70)
        print("STEP 9: CLEANUP")
        print("="*70)

        headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

        # Delete test student
        if self.test_data.get('student'):
            response = requests.delete(f"{BASE_URL}/students/{self.test_data['student']['id']}", headers=headers)
            if response.status_code == 200:
                self.log_test("Delete Test Student", True, "Student deleted")
            else:
                self.log_test("Delete Test Student", False, f"Status: {response.status_code}")

        # Delete test book
        if self.test_data.get('book'):
            response = requests.delete(f"{BASE_URL}/books/{self.test_data['book']['id']}", headers=headers)
            if response.status_code == 200:
                self.log_test("Delete Test Book", True, "Book deleted")
            else:
                self.log_test("Delete Test Book", False, f"Status: {response.status_code}")

        # Delete test equipment
        if self.test_data.get('equipment'):
            response = requests.delete(f"{BASE_URL}/equipment/{self.test_data['equipment']['id']}", headers=headers)
            if response.status_code == 200:
                self.log_test("Delete Test Equipment", True, "Equipment deleted")
            else:
                self.log_test("Delete Test Equipment", False, f"Status: {response.status_code}")

    def run_integration_test(self):
        """Run complete integration test suite"""
        print("="*70)
        print("CLMS COMPREHENSIVE INTEGRATION TEST")
        print("="*70)

        start_time = time.time()

        # Run all test suites
        if not self.authenticate():
            print("\n❌ INTEGRATION TEST FAILED: Authentication failed")
            return False

        self.test_student_workflow()
        self.test_book_workflow()
        self.test_checkout_workflow()
        self.test_equipment_workflow()
        self.test_self_service_workflow()
        self.test_analytics_workflow()
        self.test_error_handling()
        self.cleanup_test_data()

        # Print results
        elapsed_time = time.time() - start_time

        print("\n" + "="*70)
        print("INTEGRATION TEST RESULTS")
        print("="*70)
        print(f"[PASS] Passed: {self.results['passed']}")
        print(f"[FAIL] Failed: {self.results['failed']}")
        print(f"[TIME] Elapsed Time: {elapsed_time:.2f} seconds")
        print(f"[STAT] Success Rate: {(self.results['passed'] / (self.results['passed'] + self.results['failed']) * 100):.1f}%")

        if self.results['errors']:
            print("\n[FAIL] Errors:")
            for error in self.results['errors']:
                print(f"   - {error}")

        print("\n" + "="*70)
        if self.results['failed'] == 0:
            print("[PASS] INTEGRATION TEST PASSED!")
            print("="*70)
            return True
        else:
            print("[FAIL] INTEGRATION TEST FAILED!")
            print("="*70)
            return False

if __name__ == "__main__":
    test = CLMSIntegrationTest()
    success = test.run_integration_test()
    exit(0 if success else 1)

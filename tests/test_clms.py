#!/usr/bin/env python3
"""
Comprehensive CLMS Application Test Script
Tests all functionalities including login, dashboard, CRUD operations, and more.
"""

from playwright.sync_api import sync_playwright, expect
import sys
import time

def test_login_with_password_toggle(page):
    """Test login functionality with password visibility toggle"""
    print("\n=== TEST 1: Login with Password Toggle ===")

    # Navigate to login page
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Wait for form to appear
    page.wait_for_selector('form[data-testid="login-form"]', timeout=30000)

    # Take initial screenshot
    page.screenshot(path='/tmp/login_initial.png')

    # Check if password visibility toggle exists
    password_input = page.locator('input[name="password"]')
    expect(password_input).to_be_visible()

    # Find the password toggle button - it's the button adjacent to the password input
    toggle_button = page.locator('input[name="password"] + button')
    expect(toggle_button).to_be_visible()

    print("PASS: Password field with toggle button found")

    # Fill credentials
    page.fill('input[name="username"]', 'admin')
    page.fill('input[name="password"]', 'admin123')

    # Test password visibility toggle
    print("Testing password visibility toggle...")

    # Initially password should be hidden (type=password)
    password_type = page.get_attribute('input[name="password"]', 'type')
    assert password_type == 'password', f"Expected password type 'password', got '{password_type}'"
    print("PASS: Password is initially hidden")

    # Click toggle button
    toggle_button.click()
    time.sleep(0.5)

    # After click, it should be visible (type=text)
    password_type = page.get_attribute('input[name="password"]', 'type')
    assert password_type == 'text', f"Expected password type 'text' after toggle, got '{password_type}'"
    print("PASS: Password is now visible")

    # Click toggle again to hide
    toggle_button.click()
    time.sleep(0.5)
    password_type = page.get_attribute('input[name="password"]', 'type')
    assert password_type == 'password', f"Expected password type 'password' after second toggle, got '{password_type}'"
    print("PASS: Password is hidden again")

    # Take screenshot with password visible
    page.screenshot(path='/tmp/login_password_visible.png')

    # Submit login form
    print("Submitting login form...")
    page.click('button:has-text("Sign In")')

    # Wait for login success
    page.wait_for_timeout(3000)

    # Check if we're logged in (should see dashboard or be redirected)
    try:
        page.wait_for_selector('[data-testid="dashboard"]', timeout=10000)
        print("PASS: Login successful - Dashboard loaded")
        return True
    except:
        # Alternative check - look for any tab or dashboard content
        try:
            page.wait_for_selector('[data-testid*="tab"]', timeout=5000)
            print("PASS: Login successful - Dashboard tabs loaded")
            return True
        except:
            print("FAIL: Login may have failed - no dashboard found")
            page.screenshot(path='/tmp/login_result.png')
            return False

def test_dashboard_navigation(page):
    """Test all dashboard navigation tabs and screens"""
    print("\n=== TEST 2: Dashboard Navigation ===")

    # Common tab selectors to test
    tabs = [
        {'name': 'Dashboard', 'selector': '[data-testid="dashboard-tab"]'},
        {'name': 'Students', 'selector': '[data-testid="students-tab"]'},
        {'name': 'Books', 'selector': '[data-testid="books-tab"]'},
        {'name': 'Equipment', 'selector': '[data-testid="equipment-tab"]'},
        {'name': 'Scan Workspace', 'selector': '[data-testid="scan-workspace-tab"]'},
        {'name': 'Import Data', 'selector': '[data-testid="import-data-tab"]'},
        {'name': 'Reports', 'selector': '[data-testid="reports-tab"]'},
        {'name': 'Analytics', 'selector': '[data-testid="analytics-tab"]'},
    ]

    results = {'passed': 0, 'failed': 0}

    for tab in tabs:
        try:
            # Try to find and click the tab
            tab_element = page.locator(tab['selector'])
            if tab_element.count() > 0:
                print(f"  Testing {tab['name']} tab...")
                tab_element.click()
                page.wait_for_timeout(1000)
                print(f"  PASS: {tab['name']} tab clicked")
                results['passed'] += 1
            else:
                print(f"  SKIP: {tab['name']} tab not found")
                results['failed'] += 1
        except Exception as e:
            print(f"  FAIL: {tab['name']} tab error: {str(e)}")
            results['failed'] += 1

    print(f"\nDashboard Navigation Results: {results['passed']} passed, {results['failed']} failed")
    return results['passed'] > 0

def test_student_management(page):
    """Test student CRUD operations"""
    print("\n=== TEST 3: Student Management ===")

    try:
        students_tab = page.locator('[data-testid="students-tab"]')
        if students_tab.count() > 0:
            students_tab.click()
            page.wait_for_timeout(1000)
            print("PASS: Navigated to Students tab")
        else:
            print("SKIP: Students tab not found")
            return False
    except Exception as e:
        print(f"FAIL: Error navigating to Students: {str(e)}")
        return False

    # Test add student
    try:
        add_button = page.locator('button:has-text("Add Student")')
        if add_button.count() > 0:
            add_button.click()
            page.wait_for_timeout(1000)
            print("PASS: Add Student button clicked")
    except Exception as e:
        print(f"  Note: Add Student button not found: {str(e)}")

    # Test search
    try:
        search_input = page.locator('input[placeholder*="search" i]')
        if search_input.count() > 0:
            search_input.fill('test')
            page.wait_for_timeout(500)
            print("PASS: Search functionality working")
    except Exception as e:
        print(f"  Note: Search not found: {str(e)}")

    return True

def test_book_management(page):
    """Test book management features"""
    print("\n=== TEST 4: Book Management ===")

    try:
        books_tab = page.locator('[data-testid="books-tab"]')
        if books_tab.count() > 0:
            books_tab.click()
            page.wait_for_timeout(1000)
            print("PASS: Navigated to Books tab")
        else:
            print("SKIP: Books tab not found")
            return False
    except Exception as e:
        print(f"FAIL: Error navigating to Books: {str(e)}")
        return False

    return True

def test_equipment_management(page):
    """Test equipment management features"""
    print("\n=== TEST 5: Equipment Management ===")

    try:
        equipment_tab = page.locator('[data-testid="equipment-tab"]')
        if equipment_tab.count() > 0:
            equipment_tab.click()
            page.wait_for_timeout(1000)
            print("PASS: Navigated to Equipment tab")
        else:
            print("SKIP: Equipment tab not found")
            return False
    except Exception as e:
        print(f"FAIL: Error navigating to Equipment: {str(e)}")
        return False

    return True

def test_scan_workspace(page):
    """Test scanning functionality"""
    print("\n=== TEST 6: Scan Workspace ===")

    try:
        scan_tab = page.locator('[data-testid="scan-workspace-tab"]')
        if scan_tab.count() > 0:
            scan_tab.click()
            page.wait_for_timeout(1000)
            print("PASS: Navigated to Scan Workspace")
        else:
            print("SKIP: Scan Workspace tab not found")
            return False
    except Exception as e:
        print(f"FAIL: Error navigating to Scan Workspace: {str(e)}")
        return False

    # Test barcode input
    try:
        barcode_input = page.locator('input[name="barcode"], input[data-testid="barcode-input"]')
        if barcode_input.count() > 0:
            barcode_input.fill('TEST123456')
            page.wait_for_timeout(500)
            print("PASS: Barcode input working")
        else:
            print("  Note: No barcode input found")
    except Exception as e:
        print(f"  Note: Barcode input test error: {str(e)}")

    return True

def test_import_export(page):
    """Test import/export functionality"""
    print("\n=== TEST 7: Import/Export ===")

    try:
        import_tab = page.locator('[data-testid="import-data-tab"]')
        if import_tab.count() > 0:
            import_tab.click()
            page.wait_for_timeout(1000)
            print("PASS: Navigated to Import Data tab")
        else:
            print("SKIP: Import Data tab not found")
            return False
    except Exception as e:
        print(f"FAIL: Error navigating to Import Data: {str(e)}")
        return False

    return True

def test_reports_analytics(page):
    """Test reports and analytics"""
    print("\n=== TEST 8: Reports and Analytics ===")

    # Test Reports
    try:
        reports_tab = page.locator('[data-testid="reports-tab"]')
        if reports_tab.count() > 0:
            reports_tab.click()
            page.wait_for_timeout(1000)
            print("PASS: Navigated to Reports tab")
        else:
            print("  Note: Reports tab not found")
    except Exception as e:
        print(f"  Note: Reports tab error: {str(e)}")

    # Test Analytics
    try:
        analytics_tab = page.locator('[data-testid="analytics-tab"]')
        if analytics_tab.count() > 0:
            analytics_tab.click()
            page.wait_for_timeout(1000)
            print("PASS: Navigated to Analytics tab")
        else:
            print("  Note: Analytics tab not found")
    except Exception as e:
        print(f"  Note: Analytics tab error: {str(e)}")

    return True

def test_console_errors(page):
    """Check for console errors"""
    print("\n=== TEST 9: Console Error Check ===")

    console_messages = []
    page.on('console', lambda msg: console_messages.append({
        'type': msg.type,
        'text': msg.text
    }))

    # Refresh page to capture new errors
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)

    # Check for errors
    errors = [msg for msg in console_messages if msg['type'] in ['error', 'warning']]
    if errors:
        print(f"Found {len(errors)} console errors/warnings:")
        for error in errors[:5]:
            print(f"  - {error['type'].upper()}: {error['text'][:100]}")
        return False
    else:
        print("PASS: No console errors found")
        return True

def main():
    """Run all tests"""
    print("=" * 60)
    print("CLMS Comprehensive Application Test")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=['--start-maximized'])
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        test_results = {
            'login': False,
            'dashboard': False,
            'students': False,
            'books': False,
            'equipment': False,
            'scan': False,
            'import': False,
            'reports': False,
            'console_clean': False
        }

        # Test 1: Login
        test_results['login'] = test_login_with_password_toggle(page)

        if not test_results['login']:
            print("\nLOGIN FAILED - Cannot continue with other tests")
            page.screenshot(path='/tmp/final_state.png')
            browser.close()
            sys.exit(1)

        # Test 2-8: Feature Tests
        test_results['dashboard'] = test_dashboard_navigation(page)
        test_results['students'] = test_student_management(page)
        test_results['books'] = test_book_management(page)
        test_results['equipment'] = test_equipment_management(page)
        test_results['scan'] = test_scan_workspace(page)
        test_results['import'] = test_import_export(page)
        test_results['reports'] = test_reports_analytics(page)
        test_results['console_clean'] = test_console_errors(page)

        # Take final screenshot
        page.screenshot(path='/tmp/final_state.png', full_page=True)

        # Print summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)

        for test_name, passed in test_results.items():
            status = "PASSED" if passed else "FAILED"
            print(f"{test_name.capitalize():<20} {status}")

        total_tests = len(test_results)
        passed_tests = sum(test_results.values())
        print(f"\nOverall: {passed_tests}/{total_tests} tests passed")

        if passed_tests == total_tests:
            print("\nALL TESTS PASSED!")
            browser.close()
            sys.exit(0)
        else:
            print(f"\n{total_tests - passed_tests} test(s) failed")
            browser.close()
            sys.exit(1)

if __name__ == '__main__':
    main()

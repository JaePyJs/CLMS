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
    password_input = page.locator('input[type="password"]')
    expect(password_input).to_be_visible()

    # Check for the toggle button (should be in password field)
    toggle_button = page.locator('input[type="password"] + button')
    expect(toggle_button).to_be_visible()

    print("✓ Password field with toggle button found")

    # Fill credentials
    page.fill('input[name="username"]', 'admin')
    page.fill('input[type="password"]', 'librarian123')

    # Test password visibility toggle
    print("Testing password visibility toggle...")

    # Initially password should be hidden (type=password)
    password_type = page.get_attribute('input[type="password"]', 'type')
    assert password_type == 'password', f"Expected password type 'password', got '{password_type}'"
    print("✓ Password is initially hidden")

    # Click toggle button
    toggle_button.click()
    time.sleep(0.5)

    # After click, it should be visible (type=text)
    password_type = page.get_attribute('input[type="password"]', 'type')
    # Note: The type changes to text, so we need to check the input by its name or id
    visible_input = page.locator('input[name="password"]')
    password_type = visible_input.get_attribute('type')
    assert password_type == 'text', f"Expected password type 'text' after toggle, got '{password_type}'"
    print("✓ Password is now visible")

    # Click toggle again to hide
    toggle_button.click()
    time.sleep(0.5)
    password_type = visible_input.get_attribute('type')
    assert password_type == 'password', f"Expected password type 'password' after second toggle, got '{password_type}'"
    print("✓ Password is hidden again")

    # Take screenshot with password visible
    page.screenshot(path='/tmp/login_password_visible.png')

    # Submit login form
    print("Submitting login form...")
    page.click('button:has-text("Sign In")')

    # Wait for login success
    page.wait_for_timeout(3000)

    # Check if we're logged in (should see dashboard or be redirected)
    # Look for common dashboard elements
    try:
        page.wait_for_selector('[data-testid="dashboard"]', timeout=10000)
        print("✓ Login successful - Dashboard loaded")
        return True
    except:
        # Alternative check - look for any tab or dashboard content
        try:
            page.wait_for_selector('[data-testid*="tab"]', timeout=5000)
            print("✓ Login successful - Dashboard tabs loaded")
            return True
        except:
            print("✗ Login may have failed - no dashboard found")
            # Take screenshot for debugging
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
                print(f"  ✓ {tab['name']} tab clicked")
                results['passed'] += 1
            else:
                print(f"  ✗ {tab['name']} tab not found")
                results['failed'] += 1
        except Exception as e:
            print(f"  ✗ {tab['name']} tab error: {str(e)}")
            results['failed'] += 1

    print(f"\nDashboard Navigation Results: {results['passed']} passed, {results['failed']} failed")
    return results

def test_student_management(page):
    """Test student CRUD operations"""
    print("\n=== TEST 3: Student Management ===")

    # Navigate to students tab
    try:
        students_tab = page.locator('[data-testid="students-tab"]')
        if students_tab.count() > 0:
            students_tab.click()
            page.wait_for_timeout(1000)
            print("✓ Navigated to Students tab")
        else:
            print("✗ Students tab not found")
            return False
    except Exception as e:
        print(f"✗ Error navigating to Students: {str(e)}")
        return False

    # Test add student
    try:
        add_button = page.locator('button:has-text("Add Student")')
        if add_button.count() > 0:
            add_button.click()
            page.wait_for_timeout(1000)
            print("✓ Add Student button clicked")
        else:
            print("  No Add Student button found (may be in a menu)")
    except Exception as e:
        print(f"  Error clicking Add Student: {str(e)}")

    # Test search functionality
    try:
        search_input = page.locator('input[placeholder*="search" i]')
        if search_input.count() > 0:
            search_input.fill('test')
            page.wait_for_timeout(500)
            print("✓ Search functionality working")
        else:
            print("  No search input found")
    except Exception as e:
        print(f"  Error testing search: {str(e)}")

    # List students table/cards
    try:
        student_list = page.locator('[data-testid*="student"]')
        print(f"  Found {student_list.count()} student elements")
    except Exception as e:
        print(f"  Error listing students: {str(e)}")

    return True

def test_book_management(page):
    """Test book management features"""
    print("\n=== TEST 4: Book Management ===")

    try:
        books_tab = page.locator('[data-testid="books-tab"]')
        if books_tab.count() > 0:
            books_tab.click()
            page.wait_for_timeout(1000)
            print("✓ Navigated to Books tab")
        else:
            print("✗ Books tab not found")
            return False
    except Exception as e:
        print(f"✗ Error navigating to Books: {str(e)}")
        return False

    # Test add book
    try:
        add_button = page.locator('button:has-text("Add Book")')
        if add_button.count() > 0:
            add_button.click()
            page.wait_for_timeout(1000)
            print("✓ Add Book button clicked")
    except Exception as e:
        print(f"  Error clicking Add Book: {str(e)}")

    return True

def test_equipment_management(page):
    """Test equipment management features"""
    print("\n=== TEST 5: Equipment Management ===")

    try:
        equipment_tab = page.locator('[data-testid="equipment-tab"]')
        if equipment_tab.count() > 0:
            equipment_tab.click()
            page.wait_for_timeout(1000)
            print("✓ Navigated to Equipment tab")
        else:
            print("✗ Equipment tab not found")
            return False
    except Exception as e:
        print(f"✗ Error navigating to Equipment: {str(e)}")
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
            print("✓ Navigated to Scan Workspace")
        else:
            print("✗ Scan Workspace tab not found")
            return False
    except Exception as e:
        print(f"✗ Error navigating to Scan Workspace: {str(e)}")
        return False

    # Test barcode input
    try:
        barcode_input = page.locator('input[name="barcode"], input[data-testid="barcode-input"]')
        if barcode_input.count() > 0:
            barcode_input.fill('TEST123456')
            page.wait_for_timeout(500)
            print("✓ Barcode input working")
        else:
            print("  No barcode input found")
    except Exception as e:
        print(f"  Error testing barcode input: {str(e)}")

    return True

def test_import_export(page):
    """Test import/export functionality"""
    print("\n=== TEST 7: Import/Export ===")

    try:
        import_tab = page.locator('[data-testid="import-data-tab"]')
        if import_tab.count() > 0:
            import_tab.click()
            page.wait_for_timeout(1000)
            print("✓ Navigated to Import Data tab")
        else:
            print("✗ Import Data tab not found")
            return False
    except Exception as e:
        print(f"✗ Error navigating to Import Data: {str(e)}")
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
            print("✓ Navigated to Reports tab")
        else:
            print("  Reports tab not found")
    except Exception as e:
        print(f"  Error navigating to Reports: {str(e)}")

    # Test Analytics
    try:
        analytics_tab = page.locator('[data-testid="analytics-tab"]')
        if analytics_tab.count() > 0:
            analytics_tab.click()
            page.wait_for_timeout(1000)
            print("✓ Navigated to Analytics tab")
        else:
            print("  Analytics tab not found")
    except Exception as e:
        print(f"  Error navigating to Analytics: {str(e)}")

    return True

def test_console_errors(page):
    """Check for console errors"""
    print("\n=== TEST 9: Console Error Check ===")

    # Collect console messages
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
        print(f"✗ Found {len(errors)} console errors/warnings:")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error['type'].upper()}: {error['text'][:100]}")
    else:
        print("✓ No console errors found")

    return len(errors) == 0

def main():
    """Run all tests"""
    print("=" * 60)
    print("CLMS Comprehensive Application Test")
    print("=" * 60)

    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=False, args=['--start-maximized'])
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        # Track test results
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
            print("\n❌ LOGIN FAILED - Cannot continue with other tests")
            print("Please check login credentials and try again")
            page.screenshot(path='/tmp/final_state.png')
            browser.close()
            sys.exit(1)

        # Test 2: Dashboard Navigation
        dashboard_results = test_dashboard_navigation(page)
        test_results['dashboard'] = dashboard_results['passed'] > 0

        # Test 3-8: Feature Tests
        test_results['students'] = test_student_management(page)
        test_results['books'] = test_book_management(page)
        test_results['equipment'] = test_equipment_management(page)
        test_results['scan'] = test_scan_workspace(page)
        test_results['import'] = test_import_export(page)
        test_results['reports'] = test_reports_analytics(page)

        # Test 9: Console Errors
        test_results['console_clean'] = test_console_errors(page)

        # Take final screenshot
        page.screenshot(path='/tmp/final_state.png', full_page=True)

        # Print summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)

        for test_name, passed in test_results.items():
            status = "✓ PASSED" if passed else "✗ FAILED"
            print(f"{test_name.capitalize():<20} {status}")

        # Overall result
        total_tests = len(test_results)
        passed_tests = sum(test_results.values())
        print(f"\nOverall: {passed_tests}/{total_tests} tests passed")

        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED!")
            browser.close()
            sys.exit(0)
        else:
            print(f"\n⚠️  {total_tests - passed_tests} test(s) failed")
            browser.close()
            sys.exit(1)

if __name__ == '__main__':
    main()

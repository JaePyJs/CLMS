#!/usr/bin/env python3
"""
Debug auth state
"""

from playwright.sync_api import sync_playwright, expect
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=['--start-maximized'])
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()

    # Navigate to login page
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_selector('form[data-testid="login-form"]', timeout=30000)

    print("1. Login form loaded")

    # Fill credentials
    page.fill('input[name="username"]', 'admin')
    page.fill('input[name="password"]', 'admin123')

    # Click Sign In
    page.click('button:has-text("Sign In")')
    print("2. Sign In clicked")

    # Wait for loading states
    page.wait_for_timeout(3000)

    # Check localStorage for token
    token = page.evaluate('localStorage.getItem("clms_token")')
    user = page.evaluate('localStorage.getItem("clms_user")')

    print(f"\n3. After login:")
    print(f"   Token exists: {bool(token)}")
    if token:
        print(f"   Token preview: {token[:50]}...")

    print(f"   User in localStorage: {bool(user)}")
    if user:
        try:
            import json
            user_data = json.loads(user)
            print(f"   User data: {user_data}")
        except:
            print(f"   User raw: {user}")

    # Check for loading state
    loading = page.locator('text=Loading...')
    auth_checking = page.locator('text=Checking authentication...')

    print(f"\n4. UI State:")
    print(f"   Loading spinner visible: {loading.count() > 0}")
    print(f"   Auth checking text visible: {auth_checking.count() > 0}")

    # Check current URL
    print(f"   Current URL: {page.url}")

    # Try to find any dashboard-like elements
    elements_to_check = [
        '[data-testid="dashboard"]',
        '[id*="tab"]',
        'header',
        'nav',
        'main',
        'footer',
        '.tabs',
        '[role="tablist"]'
    ]

    print(f"\n5. Checking for dashboard elements:")
    for selector in elements_to_check:
        count = page.locator(selector).count()
        if count > 0:
            print(f"   Found {count} element(s): {selector}")

    # Take screenshot
    page.screenshot(path='/tmp/auth_state_check.png', full_page=True)
    print(f"\n6. Screenshot saved to /tmp/auth_state_check.png")

    # Wait more and check again
    page.wait_for_timeout(5000)
    print(f"\n7. After additional 5 second wait:")

    # Re-check elements
    for selector in elements_to_check:
        count = page.locator(selector).count()
        if count > 0:
            print(f"   Found {count} element(s): {selector}")

    # Check if login form is still visible
    login_form = page.locator('form[data-testid="login-form"]')
    print(f"\n8. Login form still visible: {login_form.count() > 0}")

    # Check for any error messages
    error_msg = page.locator('[data-testid="error-message"]')
    print(f"   Error message visible: {error_msg.count() > 0}")

    # Get page content to see what's actually rendered
    body_text = page.locator('body').inner_text()
    print(f"\n9. Page content preview (first 500 chars):")
    print(body_text[:500])

    browser.close()

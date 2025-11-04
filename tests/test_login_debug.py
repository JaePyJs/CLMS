#!/usr/bin/env python3
"""
Debug login flow
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

    # Take screenshot
    page.screenshot(path='/tmp/before_login.png')

    # Check for error messages
    error_msg = page.locator('[data-testid="error-message"]')
    if error_msg.count() > 0:
        print(f"Found error message: {error_msg.text_content()}")

    # Fill credentials
    page.fill('input[name="username"]', 'admin')
    page.fill('input[name="password"]', 'admin123')

    print("2. Credentials filled")

    # Click toggle
    toggle_button = page.locator('input[name="password"] + button')
    toggle_button.click()
    time.sleep(0.5)
    print("3. Password toggle clicked")

    # Click Sign In
    page.click('button:has-text("Sign In")')
    print("4. Sign In clicked")

    # Wait and check for errors
    page.wait_for_timeout(2000)
    page.screenshot(path='/tmp/after_login_click.png')

    # Check for error messages
    error_msg = page.locator('[data-testid="error-message"]')
    if error_msg.count() > 0:
        print(f"5. Error message found: {error_msg.text_content()}")
    else:
        print("5. No error message")

    # Check console
    print("\nConsole logs:")
    console_messages = []
    def handle_console(msg):
        console_messages.append({'type': msg.type, 'text': msg.text})
        if msg.type in ['error', 'warning']:
            print(f"  {msg.type}: {msg.text}")
    page.on('console', handle_console)

    # Wait more
    page.wait_for_timeout(5000)
    page.screenshot(path='/tmp/after_wait.png')

    # Check if redirected
    current_url = page.url
    print(f"\nCurrent URL: {current_url}")

    # Check for any elements that indicate dashboard
    try:
        dashboard = page.locator('[data-testid="dashboard"]')
        if dashboard.count() > 0:
            print("Dashboard element found!")
        else:
            print("No dashboard element found")

        # Look for any tabs
        tabs = page.locator('[data-testid*="tab"]')
        print(f"Found {tabs.count()} tab elements")

        # Look for navigation
        nav = page.locator('nav')
        print(f"Found {nav.count()} nav elements")

    except Exception as e:
        print(f"Error checking elements: {e}")

    browser.close()

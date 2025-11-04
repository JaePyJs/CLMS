#!/usr/bin/env python3
"""
Inspect the login page DOM structure
"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=['--start-maximized'])
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()

    # Navigate to login page
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(5000)

    # Take screenshot
    page.screenshot(path='/tmp/login_page.png', full_page=True)

    # Get the password input and its parent structure
    password_input = page.locator('input[name="password"]')
    if password_input.count() > 0:
        print("\n=== Password Input Found ===")
        html = password_input.evaluate('el => el.outerHTML')
        print(f"Password Input HTML:\n{html}\n")

        # Get parent element
        parent = password_input.evaluate('el => el.parentElement.outerHTML')
        print(f"Parent HTML:\n{parent}\n")

        # Get grandparent element
        grandparent = password_input.evaluate('el => el.parentElement.parentElement.outerHTML')
        print(f"Grandparent HTML:\n{grandparent}\n")

    # Find all buttons
    print("\n=== All Buttons on Page ===")
    buttons = page.locator('button')
    for i in range(buttons.count()):
        btn = buttons.nth(i)
        text = btn.inner_text()
        print(f"Button {i}: {text}")
        html = btn.evaluate('el => el.outerHTML')
        print(f"  HTML: {html}\n")

    # Find password toggle specifically
    print("\n=== Looking for Password Toggle Button ===")
    # Try different selectors
    selectors = [
        'input[type="password"] + button',
        'input[type="password"] ~ button',
        'input[name="password"] + button',
        'input[name="password"] ~ button',
        '.relative button',
        'div.relative button',
        'button:has-text("👁")',
        'button:has-text("eye")',
        'button svg',
    ]

    for selector in selectors:
        elements = page.locator(selector)
        count = elements.count()
        if count > 0:
            print(f"✓ Found {count} element(s) with selector: {selector}")
            html = elements.first.evaluate('el => el.outerHTML')
            print(f"  HTML: {html}\n")

    # Get all inputs
    print("\n=== All Input Elements ===")
    inputs = page.locator('input')
    for i in range(min(inputs.count(), 10)):  # Limit to first 10
        inp = inputs.nth(i)
        name = inp.get_attribute('name') or 'unnamed'
        type_attr = inp.get_attribute('type') or 'text'
        id_attr = inp.get_attribute('id') or 'no-id'
        print(f"Input {i}: name='{name}', type='{type_attr}', id='{id_attr}'")

    browser.close()

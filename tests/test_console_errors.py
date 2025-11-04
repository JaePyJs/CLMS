#!/usr/bin/env python3
"""
Check browser console for errors
"""

from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, args=['--start-maximized'])
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()

    # Collect all console messages
    console_messages = []
    def handle_console(msg):
        console_messages.append({
            'type': msg.type,
            'text': msg.text,
            'location': msg.location
        })
        print(f"[{msg.type}] {msg.text}")
        if msg.type in ['error', 'warning']:
            print(f"  Location: {msg.location}")
    page.on('console', handle_console)

    # Navigate to login page
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_selector('form[data-testid="login-form"]', timeout=30000)

    print("Login form loaded\n")

    # Fill credentials and login
    page.fill('input[name="username"]', 'admin')
    page.fill('input[name="password"]', 'admin123')
    page.click('button:has-text("Sign In")')

    print("\nWaiting for dashboard to load...")
    page.wait_for_timeout(8000)

    print(f"\n\nTotal console messages: {len(console_messages)}")
    print("\n=== ALL CONSOLE OUTPUT ===")
    for msg in console_messages:
        print(f"[{msg['type']}] {msg['text']}")

    browser.close()

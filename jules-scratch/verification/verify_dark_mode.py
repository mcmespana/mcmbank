from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    print("Navigating to login page...")
    # Go to the login page
    page.goto("http://localhost:3000/auth/login", timeout=60000)

    # Wait for the google button to be visible
    page.wait_for_selector('button:has-text("Entrar con Google")')

    # Wait for 5 seconds to allow styles to load
    page.wait_for_timeout(5000)

    print("Taking screenshot...")
    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/dark_mode_screenshot.png")
    print("Screenshot saved to jules-scratch/verification/dark_mode_screenshot.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

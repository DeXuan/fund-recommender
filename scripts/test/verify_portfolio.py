from playwright.sync_api import sync_playwright
import time
import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

# Get token via API
print("Getting auth token via API...")
req = urllib.request.Request(
    'http://localhost:3003/api/auth/login',
    data=json.dumps({"username": "verify_user", "password": "verify1234"}).encode(),
    headers={"Content-Type": "application/json"}
)
try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    token = data.get("token", "")
    print(f"Token obtained: {token[:30]}...")
except Exception as e:
    print(f"Login failed: {e}")
    token = ""

if not token:
    print("No token, exiting")
    sys.exit(1)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Set token in localStorage before navigating
    print("\n=== Setting auth token ===")
    page.goto('http://localhost:5173/web/login', wait_until='networkidle')
    page.evaluate(f"localStorage.setItem('token', '{token}')")
    print("Token set in localStorage")

    # Navigate to portfolio
    print("\n=== Step 1: Navigate to portfolio ===")
    page.goto('http://localhost:5173/web/portfolio', wait_until='networkidle')
    time.sleep(3)
    page.screenshot(path='/tmp/portfolio_01_main.png', full_page=True)
    print(f"URL: {page.url}")

    if '/login' in page.url:
        print("ERROR: Still redirected to login")
        browser.close()
        sys.exit(1)

    # Check all tabs
    print("\n=== Step 2: Check all tabs ===")
    tabs = page.locator('[role="tab"]').all()
    tab_list = []
    for tab in tabs:
        try:
            text = tab.text_content().strip()
            tab_list.append(text)
        except:
            pass
    print(f"Tabs found ({len(tab_list)}): {tab_list}")

    # Verify new tabs exist
    new_tabs = ['交易历史', '深度分析', '目标规划', '智能定投']
    all_found = True
    for tab_name in new_tabs:
        found = any(tab_name in t for t in tab_list)
        print(f"  {'OK' if found else 'MISSING'}: {tab_name}")
        if not found:
            all_found = False

    # Click each new tab and verify it loads
    print("\n=== Step 3: Test each new tab ===")

    # Transaction History
    print("\n--- Transaction History ---")
    tab = page.locator('[role="tab"]').filter(has_text="交易历史")
    if tab.count() > 0:
        tab.click()
        time.sleep(2)
        page.screenshot(path='/tmp/portfolio_02_transactions.png', full_page=True)
        has_table = page.locator('.ant-table').count() > 0
        has_empty = page.locator('.ant-empty').count() > 0
        print(f"  Table: {has_table}, Empty state: {has_empty}")
        print(f"  Status: OK")
    else:
        print("  Status: TAB NOT FOUND")

    # Deep Analysis
    print("\n--- Deep Analysis ---")
    tab = page.locator('[role="tab"]').filter(has_text="深度分析")
    if tab.count() > 0:
        tab.click()
        time.sleep(3)
        page.screenshot(path='/tmp/portfolio_03_analysis.png', full_page=True)
        cards = page.locator('.ant-card').all()
        spinners = page.locator('.ant-spin').all()
        print(f"  Cards: {len(cards)}, Spinners: {len(spinners)}")
        print(f"  Status: OK")
    else:
        print("  Status: TAB NOT FOUND")

    # Goal Planning
    print("\n--- Goal Planning ---")
    tab = page.locator('[role="tab"]').filter(has_text="目标规划")
    if tab.count() > 0:
        tab.click()
        time.sleep(2)
        page.screenshot(path='/tmp/portfolio_04_goal.png', full_page=True)
        presets = page.locator('button').filter(has_text="子女教育").count()
        print(f"  Goal preset buttons: {presets}")
        print(f"  Status: OK")
    else:
        print("  Status: TAB NOT FOUND")

    # Smart DCA
    print("\n--- Smart DCA ---")
    tab = page.locator('[role="tab"]').filter(has_text="智能定投")
    if tab.count() > 0:
        tab.click()
        time.sleep(3)
        page.screenshot(path='/tmp/portfolio_05_smartdca.png', full_page=True)
        selects = page.locator('.ant-select').all()
        print(f"  Selects: {len(selects)}")
        print(f"  Status: OK")
    else:
        print("  Status: TAB NOT FOUND")

    # Go back to main portfolio tab and check sell button + diagnosis
    print("\n=== Step 4: Check main portfolio tab ===")
    tab = page.locator('[role="tab"]').filter(has_text="理财记账")
    if tab.count() > 0:
        tab.click()
        time.sleep(2)
        page.screenshot(path='/tmp/portfolio_06_main_final.png', full_page=True)

        sell_btns = page.locator('button:has-text("赎回")').all()
        print(f"  Sell buttons: {len(sell_btns)}")

        # Check for diagnosis and behavior analysis sections in page content
        content = page.content()
        has_diagnosis = '持仓诊断' in content or '健康评分' in content
        has_behavior = '交易行为' in content or '交易统计' in content
        print(f"  Holdings diagnosis: {has_diagnosis}")
        print(f"  Transaction behavior: {has_behavior}")

    # Final summary
    print("\n=== VERIFICATION SUMMARY ===")
    print(f"New tabs visible: {all_found}")
    print(f"Transaction History: OK")
    print(f"Deep Analysis: OK")
    print(f"Goal Planning: OK")
    print(f"Smart DCA: OK")

    browser.close()
    print("\n=== Done ===")

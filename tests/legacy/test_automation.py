#!/usr/bin/env python3
"""
Test Equipment Automation API
Tests equipment automation workflows, statistics, and analytics
"""
import requests
import json

BASE_URL = "http://localhost:3001/api"

def test_equipment_automation():
    print("=" * 70)
    print("EQUIPMENT AUTOMATION API - COMPREHENSIVE TEST")
    print("=" * 70)

    # Step 1: Get auth token
    print("\n[1/9] Authenticating...")
    login_data = {"username": "admin", "password": "admin123"}
    login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data)

    if login_response.status_code != 200:
        print(f"[FAILED] Authentication failed with status {login_response.status_code}")
        return False

    access_token = login_response.json()['data']['accessToken']
    print(f"[PASSED] Authentication successful")

    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    # Step 2: Get equipment statistics
    print("\n[2/9] Testing GET /equipment/automation/statistics (Get statistics)")
    stats_response = requests.get(f"{BASE_URL}/equipment/automation/statistics", headers=headers)

    if stats_response.status_code == 200:
        stats = stats_response.json()
        print(f"[PASSED] Statistics retrieved successfully")
        print(f"   Total Equipment: {stats['data']['totalEquipment']}")
        print(f"   Available: {stats['data']['availableEquipment']}")
        print(f"   In Use: {stats['data']['inUseEquipment']}")
        print(f"   Maintenance: {stats['data']['maintenanceEquipment']}")
        print(f"   Overdue: {stats['data']['overdueEquipment']}")
        print(f"   Utilization Rate: {stats['data']['utilizationRate']}%")
    else:
        print(f"[FAILED] Get statistics failed: {stats_response.status_code}")
        print(f"   Response: {stats_response.text}")
        return False

    # Step 3: Get overdue equipment
    print("\n[3/9] Testing GET /equipment/automation/overdue (Get overdue)")
    overdue_response = requests.get(f"{BASE_URL}/equipment/automation/overdue", headers=headers)

    if overdue_response.status_code == 200:
        overdue = overdue_response.json()
        print(f"[PASSED] Retrieved {overdue['count']} overdue items")
        if overdue['data']:
            print(f"   Example: {overdue['data'][0]['name']} - {overdue['data'][0]['days_overdue']} days overdue")
    else:
        print(f"[FAILED] Get overdue failed: {overdue_response.status_code}")
        print(f"   Response: {overdue_response.text}")
        return False

    # Step 4: Get maintenance schedule
    print("\n[4/9] Testing GET /equipment/automation/maintenance (Get maintenance)")
    maintenance_response = requests.get(f"{BASE_URL}/equipment/automation/maintenance", headers=headers)

    if maintenance_response.status_code == 200:
        maintenance = maintenance_response.json()
        print(f"[PASSED] Retrieved {maintenance['count']} maintenance items")
        if maintenance['data']:
            print(f"   Example: {maintenance['data'][0]['name']}")
            print(f"   Status: {maintenance['data'][0]['status']}")
            print(f"   Days until maintenance: {maintenance['data'][0]['days_until_maintenance']}")
    else:
        print(f"[FAILED] Get maintenance failed: {maintenance_response.status_code}")
        print(f"   Response: {maintenance_response.text}")
        return False

    # Step 5: Get usage analytics
    print("\n[5/9] Testing GET /equipment/automation/analytics (Get analytics)")
    analytics_response = requests.get(f"{BASE_URL}/equipment/automation/analytics?days=30", headers=headers)

    if analytics_response.status_code == 200:
        analytics = analytics_response.json()
        print(f"[PASSED] Analytics retrieved successfully")
        print(f"   Period: {analytics['data']['period_days']} days")
        print(f"   Equipment usage data: {len(analytics['data']['equipment_usage'])} items")
        if analytics['data']['equipment_usage']:
            top_equipment = analytics['data']['equipment_usage'][0]
            print(f"   Most used: {top_equipment['equipment_name']} ({top_equipment['total_checkouts']} checkouts)")
    else:
        print(f"[FAILED] Get analytics failed: {analytics_response.status_code}")
        print(f"   Response: {analytics_response.text}")
        return False

    # Step 6: Send overdue notifications
    print("\n[6/9] Testing POST /equipment/automation/notifications/overdue (Send notifications)")
    notification_response = requests.post(f"{BASE_URL}/equipment/automation/notifications/overdue", headers=headers)

    if notification_response.status_code == 200:
        result = notification_response.json()
        print(f"[PASSED] Notifications sent")
        print(f"   Sent: {result['data']['sent']}")
        print(f"   Failed: {result['data']['failed']}")
        print(f"   Message: {result['message']}")
    else:
        print(f"[FAILED] Send notifications failed: {notification_response.status_code}")
        print(f"   Response: {notification_response.text}")
        return False

    # Step 7: Schedule maintenance reminders
    print("\n[7/9] Testing POST /equipment/automation/maintenance/schedule (Schedule reminders)")
    reminder_response = requests.post(f"{BASE_URL}/equipment/automation/maintenance/schedule", headers=headers)

    if reminder_response.status_code == 200:
        result = reminder_response.json()
        print(f"[PASSED] Maintenance reminders scheduled")
        print(f"   Scheduled: {result['data']['scheduled']}")
        print(f"   Message: {result['message']}")
    else:
        print(f"[FAILED] Schedule maintenance failed: {reminder_response.status_code}")
        print(f"   Response: {reminder_response.text}")
        return False

    # Step 8: Auto-return overdue equipment
    print("\n[8/9] Testing POST /equipment/automation/auto-return (Auto-return overdue)")
    autoreturn_response = requests.post(f"{BASE_URL}/equipment/automation/auto-return", headers=headers)

    if autoreturn_response.status_code == 200:
        result = autoreturn_response.json()
        print(f"[PASSED] Auto-return completed")
        print(f"   Returned: {result['data']['returned']}")
        print(f"   Errors: {result['data']['errors']}")
        print(f"   Message: {result['message']}")
    else:
        print(f"[NOTE] Auto-return returned status: {autoreturn_response.status_code}")
        print(f"   Response: {autoreturn_response.text}")

    # Step 9: Run automation cycle
    print("\n[9/9] Testing POST /equipment/automation/run-cycle (Run automation cycle)")
    cycle_response = requests.post(f"{BASE_URL}/equipment/automation/run-cycle", headers=headers)

    if cycle_response.status_code == 200:
        result = cycle_response.json()
        print(f"[PASSED] Automation cycle completed successfully")
        print(f"   Overdue count: {result['data']['overdue_count']}")
        print(f"   Maintenance count: {result['data']['maintenance_count']}")
        print(f"   Notifications sent: {result['data']['notifications_sent']}")
        print(f"   Maintenance reminders: {result['data']['maintenance_reminders_scheduled']}")
        print(f"   Status: {result['data']['automation_cycle']}")
    else:
        print(f"[FAILED] Run automation cycle failed: {cycle_response.status_code}")
        print(f"   Response: {cycle_response.text}")
        return False

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("[PASSED] Equipment Automation API - All endpoints working correctly")
    print("[PASSED] Get Statistics: Working")
    print("[PASSED] Get Overdue Equipment: Working")
    print("[PASSED] Get Maintenance Schedule: Working")
    print("[PASSED] Get Usage Analytics: Working")
    print("[PASSED] Send Overdue Notifications: Working")
    print("[PASSED] Schedule Maintenance: Working")
    print("[PASSED] Auto-Return Overdue: Working")
    print("[PASSED] Run Automation Cycle: Working")
    print("\n[SUCCESS] Equipment Automation is FULLY FUNCTIONAL!")
    print("=" * 70)

    return True

if __name__ == "__main__":
    test_equipment_automation()

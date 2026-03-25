#!/usr/bin/env python3
"""
Test for the team color / ghost team bug.

Reproduces the scenario:
  1. Game 1: White vs Blue → White wins
  2. Game 2: White vs Blue → Blue wins (challenger wins)
  3. Verify: new challenger team is White (not Blue)
  4. Verify: only 2 teams displayed (no ghost teams from old games)

Usage:
    python scripts/test-color-bug.py [BASE_URL] [ADMIN_ID]
"""

import json
import sys
import time
import urllib.request
import urllib.error

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8081"
ADMIN_ID = sys.argv[2] if len(sys.argv) > 2 else None
API = f"{BASE_URL}/api"

try:
    from faker import Faker
    fake = Faker()
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "faker", "-q"])
    from faker import Faker
    fake = Faker()

if not ADMIN_ID:
    print("Usage: python scripts/test-color-bug.py [BASE_URL] [ADMIN_ID]")
    sys.exit(1)


def api_request(method, path, body=None, user_id=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if user_id:
        headers["x-user-id"] = user_id
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())


def get(path, user_id=None):
    return api_request("GET", path, user_id=user_id)


def post(path, body=None, user_id=None):
    return api_request("POST", path, body=body, user_id=user_id)


def get_state(waitlist_id):
    return get(f"/waitlist/{waitlist_id}", user_id=ADMIN_ID)


def assert_eq(label, actual, expected):
    if actual != expected:
        print(f"  FAIL: {label}: expected {expected}, got {actual}")
        return False
    print(f"  PASS: {label}: {actual}")
    return True


passed = 0
failed = 0


def check(label, actual, expected):
    global passed, failed
    if assert_eq(label, actual, expected):
        passed += 1
    else:
        failed += 1


# ─── Setup ───

print("=== Color Bug Regression Test ===\n")

# Create waitlist
waitlist = post("/waitlist", user_id=ADMIN_ID)
wl_id = waitlist["id"]
print(f"Waitlist: {wl_id}")

# Generate token
token = post(f"/waitlist/{wl_id}/token", user_id=ADMIN_ID)["token"]

# Create 20 players (enough for 4 teams)
print("\nCreating 20 players...")
players = []
for i in range(20):
    first = fake.first_name_female()
    last = fake.last_name()
    user = post("/users", body={"first_name": first, "last_name": last, "phone": f"555200{i:04d}"})
    players.append(user)
    post(f"/waitlist/{wl_id}/join-token", body={"token": token}, user_id=user["id"])
    time.sleep(0.05)

print(f"  {len(players)} players joined")

# ─── Check initial auto-formation ───

print("\n--- Checking initial auto-formation ---")
state = get_state(wl_id)

check("Active game exists", state["activeGame"] is not None, True)
check("Staged teams count", len(state["stagedTeams"]), 0)

if state["activeGame"]:
    t1_color = state["activeGame"]["team1"]["color"]
    t2_color = state["activeGame"]["team2"]["color"]
    print(f"  Game 1: {t1_color} vs {t2_color}")
    check("Teams have different colors", t1_color != t2_color, True)

    game1_id = state["activeGame"]["id"]
    team1_id = state["activeGame"]["team1"]["id"]
    team2_id = state["activeGame"]["team2"]["id"]

    # Find which is White and which is Blue
    white_team = team1_id if t1_color == "White" else team2_id
    blue_team = team1_id if t1_color == "Blue" else team2_id

# ─── Game 1: White wins ───

print(f"\n--- Game 1: {t1_color} (team1) wins ---")
result = post(f"/games/{game1_id}/complete", body={"winner_id": white_team}, user_id=ADMIN_ID)

if "error" in result:
    print(f"  ERROR: {result['error']}")
    sys.exit(1)

print(f"  Streak: {result['streak']}, Maxed: {result['streak_maxed']}")

# Check state after game 1
time.sleep(0.5)
state = get_state(wl_id)

check("Game 2 auto-started", state["activeGame"] is not None, True)
check("Staged teams after game 1", len(state["stagedTeams"]), 0)

if state["activeGame"]:
    g2_t1_color = state["activeGame"]["team1"]["color"]
    g2_t2_color = state["activeGame"]["team2"]["color"]
    print(f"  Game 2: {g2_t1_color} vs {g2_t2_color}")
    check("Game 2 teams have different colors", g2_t1_color != g2_t2_color, True)
    check("Staying team (team1) is White", g2_t1_color, "White")
    check("Challenger (team2) is Blue", g2_t2_color, "Blue")

    game2_id = state["activeGame"]["id"]
    g2_team1_id = state["activeGame"]["team1"]["id"]
    g2_team2_id = state["activeGame"]["team2"]["id"]

# ─── Game 2: Blue wins (challenger wins → streak resets) ───

print(f"\n--- Game 2: Blue (challenger/team2) wins ---")
result = post(f"/games/{game2_id}/complete", body={"winner_id": g2_team2_id}, user_id=ADMIN_ID)

if "error" in result:
    print(f"  ERROR: {result['error']}")
    sys.exit(1)

print(f"  Streak: {result['streak']}, Maxed: {result['streak_maxed']}")
check("Streak reset to 1", result["streak"], 1)

# THE BUG CHECK: state after game 2
time.sleep(0.5)
state = get_state(wl_id)

check("Game 3 auto-started", state["activeGame"] is not None, True)
check("No staged teams (all in game)", len(state["stagedTeams"]), 0)

if state["activeGame"]:
    g3_t1_color = state["activeGame"]["team1"]["color"]
    g3_t2_color = state["activeGame"]["team2"]["color"]
    print(f"  Game 3: {g3_t1_color} vs {g3_t2_color}")

    # THE KEY ASSERTIONS:
    check("Game 3 teams have different colors", g3_t1_color != g3_t2_color, True)
    check("Staying team (team1) is Blue", g3_t1_color, "Blue")
    check("Challenger (team2) is White", g3_t2_color, "White")

# ─── Summary ───

print(f"\n{'='*40}")
print(f"Results: {passed} passed, {failed} failed")
if failed == 0:
    print("ALL TESTS PASSED")
else:
    print("SOME TESTS FAILED")
    sys.exit(1)

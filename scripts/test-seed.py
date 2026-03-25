#!/usr/bin/env python3
"""
Seed script for Women's All B-Ball.

Usage:
    python scripts/test-seed.py [BASE_URL]                  # Step 1: create admin
    python scripts/test-seed.py [BASE_URL] [ADMIN_ID]       # Step 2: seed players
    python scripts/test-seed.py [BASE_URL] [ADMIN_ID] [N]   # Seed N players (default 10)

Step 1 creates an admin user and tells you to promote them in the DB.
Step 2 creates N players, a waitlist, generates a token, and joins everyone.
"""

import json
import sys
import time
import urllib.request
import urllib.error

try:
    from faker import Faker
    fake = Faker()
except ImportError:
    print("Installing faker...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "faker", "-q"])
    from faker import Faker
    fake = Faker()

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8081"
ADMIN_ID = sys.argv[2] if len(sys.argv) > 2 else None
NUM_PLAYERS = int(sys.argv[3]) if len(sys.argv) > 3 else 10
API = f"{BASE_URL}/api"


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


print(f"=== Using API at {API} ===")

# ─── Step 1: Create admin user ───

if not ADMIN_ID:
    print("\n--- Creating admin user ---")
    admin = post("/users", body={
        "first_name": "Admin",
        "last_name": "User",
        "phone": "5550000000",
    })
    admin_id = admin["id"]
    print(f"  Admin ID: {admin_id}")
    print(f"\n!! Promote this user to admin in the DB, then re-run:")
    print(f"   UPDATE users SET role = 'admin' WHERE id = '{admin_id}';")
    print(f"\n   python scripts/test-seed.py {BASE_URL} {admin_id}")
    sys.exit(0)

print(f"  Admin ID: {ADMIN_ID}")

# ─── Create players ───

print(f"\n--- Creating {NUM_PLAYERS} players ---")
players = []
for i in range(NUM_PLAYERS):
    first = fake.first_name_female()
    last = fake.last_name()
    user = post("/users", body={
        "first_name": first,
        "last_name": last,
        "phone": f"555000{i+1:04d}",
    })
    players.append(user)
    print(f"  {i+1}. {first} {last} -> {user['id']}")

# ─── Create waitlist ───

print("\n--- Creating waitlist ---")
waitlist = post("/waitlist", user_id=ADMIN_ID)
if "error" in waitlist:
    print(f"  ERROR: {waitlist['error']}")
    sys.exit(1)
waitlist_id = waitlist["id"]
passcode = waitlist["passcode"]
print(f"  Waitlist ID: {waitlist_id}")
print(f"  Passcode: {passcode}")

# ─── Generate token ───

print("\n--- Generating join token ---")
token_result = post(f"/waitlist/{waitlist_id}/token", user_id=ADMIN_ID)
if "error" in token_result:
    print(f"  ERROR: {token_result['error']}")
    sys.exit(1)
token = token_result["token"]
print(f"  Token: {token}")

# ─── Join all players ───

print(f"\n--- Joining {NUM_PLAYERS} players via token ---")
for i, user in enumerate(players):
    result = post(
        f"/waitlist/{waitlist_id}/join-token",
        body={"token": token},
        user_id=user["id"],
    )
    if "error" in result:
        status = f"ERROR: {result['error']}"
    elif "authorized" in result:
        status = "already in queue"
    else:
        status = "joined"
    print(f"  {i+1}. {user['first_name']} {user['last_name']} -> {status}")
    time.sleep(0.05)

# ─── View queue ───

print("\n--- Current queue ---")
data = get(f"/waitlist/{waitlist_id}", user_id=ADMIN_ID)
queue = data.get("queue", [])
print(f"  {len(queue)} players in queue:")
for i, p in enumerate(queue):
    print(f"    {i+1}. {p['users']['first_name']} {p['users']['last_name'][0]}. ({p['status']})")

# ─── Summary ───

print(f"\n=== Seed complete ===")
print(f"  Waitlist ID: {waitlist_id}")
print(f"  Admin ID:    {ADMIN_ID}")
print(f"  Passcode:    {passcode}")
print(f"  Token:       {token}")
print(f"\nNext steps:")
print(f"  http POST {API}/waitlist/{waitlist_id}/form-team x-user-id:{ADMIN_ID}")
print(f"  http POST {API}/waitlist/{waitlist_id}/form-team x-user-id:{ADMIN_ID}")
print(f"  http POST {API}/games x-user-id:{ADMIN_ID} waitlist_id={waitlist_id} team1_id=TEAM1 team2_id=TEAM2")

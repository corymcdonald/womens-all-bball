#!/usr/bin/env python3
"""
Join existing users to a waitlist via token.

Usage:
    python scripts/test-join-existing.py [BASE_URL] [ADMIN_ID] [WAITLIST_ID]

Finds all non-admin users and joins them to the specified waitlist using a generated token.
If no waitlist ID is provided, uses the most recent one.
"""

import json
import sys
import time
import urllib.request
import urllib.error

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8081"
ADMIN_ID = sys.argv[2] if len(sys.argv) > 2 else None
WAITLIST_ID = sys.argv[3] if len(sys.argv) > 3 else None
API = f"{BASE_URL}/api"

if not ADMIN_ID:
    print("Usage: python scripts/test-join-existing.py [BASE_URL] [ADMIN_ID] [WAITLIST_ID]")
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
        body = json.loads(e.read())
        return body


def get(path, user_id=None):
    return api_request("GET", path, user_id=user_id)


def post(path, body=None, user_id=None):
    return api_request("POST", path, body=body, user_id=user_id)


print(f"=== Join existing users to waitlist ===")
print(f"API: {API}")
print(f"Admin: {ADMIN_ID}")

# --- Find or use waitlist ---
if not WAITLIST_ID:
    print("\n--- Using most recent waitlist ---")
    waitlists = get("/waitlist")
    if not waitlists:
        print("  No waitlists found. Create one first.")
        sys.exit(1)
    WAITLIST_ID = waitlists[0]["id"]

print(f"  Waitlist: {WAITLIST_ID}")

# --- Generate join token ---
print("\n--- Generating join token ---")
token_result = post(f"/waitlist/{WAITLIST_ID}/token", user_id=ADMIN_ID)
if "error" in token_result:
    print(f"  ERROR: {token_result['error']}")
    sys.exit(1)

TOKEN = token_result["token"]
print(f"  Token: {TOKEN}")

# --- Find all non-admin users ---
print("\n--- Finding users ---")
all_users = {}
for letter in "abcdefghijklmnopqrstuvwxyz":
    try:
        results = get(f"/users?q={letter}", user_id=ADMIN_ID)
        if isinstance(results, list):
            for u in results:
                if u["role"] != "admin" and u["id"] not in all_users:
                    all_users[u["id"]] = u
    except Exception:
        pass

users = list(all_users.values())
print(f"  Found {len(users)} non-admin users")

if not users:
    print("  No users found. Run test-seed.sh first.")
    sys.exit(1)

# --- Join all users via token ---
print(f"\n--- Joining {len(users)} users via token ---")
joined = 0
skipped = 0
errors = 0

for i, u in enumerate(users):
    name = f"{u['first_name']} {u['last_name']}"
    result = post(
        f"/waitlist/{WAITLIST_ID}/join-token",
        body={"token": TOKEN},
        user_id=u["id"],
    )

    if "error" in result:
        status = f"ERROR: {result['error']}"
        errors += 1
    elif "authorized" in result:
        status = "already in queue"
        skipped += 1
    else:
        status = "joined"
        joined += 1

    print(f"  {i+1}. {name} -> {status}")
    time.sleep(0.05)

# --- View the queue ---
print(f"\n--- Current queue ---")
data = get(f"/waitlist/{WAITLIST_ID}", user_id=ADMIN_ID)
queue = data.get("queue", [])
playing = data.get("playing", [])
print(f"  Queue: {len(queue)} players")
print(f"  Playing: {len(playing)} players")
for i, p in enumerate(queue):
    name = f"{p['users']['first_name']} {p['users']['last_name'][0]}."
    print(f"    {i+1}. {name} ({p['status']})")

print(f"\n=== Done ===")
print(f"  Joined: {joined}")
print(f"  Already in queue: {skipped}")
print(f"  Errors: {errors}")
print(f"\n  Waitlist: {WAITLIST_ID}")
print(f"  Token: {TOKEN}")

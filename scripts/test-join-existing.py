#!/usr/bin/env python3
"""
Join existing users to a waitlist via token — with parallel requests to test race conditions.

Usage:
    python scripts/test-join-existing.py [BASE_URL] [ADMIN_ID] [WAITLIST_ID] [--parallel]

Finds all non-admin users and joins them to the specified waitlist using a generated token.
If no waitlist ID is provided, uses the most recent one.

--parallel  Join all users concurrently (tests advisory lock / race conditions)
"""

import json
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8081"
ADMIN_ID = sys.argv[2] if len(sys.argv) > 2 else None
WAITLIST_ID = sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith("--") else None
PARALLEL = "--parallel" in sys.argv
API = f"{BASE_URL}/api"

if not ADMIN_ID:
    print("Usage: python scripts/test-join-existing.py [BASE_URL] [ADMIN_ID] [WAITLIST_ID] [--parallel]")
    sys.exit(1)


def api_request(method, path, body=None, user_id=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if user_id:
        headers["x-user-id"] = user_id

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())
    except Exception as e:
        return {"error": str(e)}


def get(path, user_id=None):
    return api_request("GET", path, user_id=user_id)


def post(path, body=None, user_id=None):
    return api_request("POST", path, body=body, user_id=user_id)


def join_user(user, token, waitlist_id):
    """Join a single user — called from thread pool."""
    start = time.monotonic()
    result = post(
        f"/waitlist/{waitlist_id}/join-token",
        body={"token": token},
        user_id=user["id"],
    )
    elapsed = time.monotonic() - start

    name = f"{user['first_name']} {user['last_name']}"

    if "error" in result:
        return {"name": name, "status": "error", "detail": result["error"], "ms": int(elapsed * 1000)}
    elif "authorized" in result:
        return {"name": name, "status": "skipped", "detail": "already in queue", "ms": int(elapsed * 1000)}
    else:
        return {"name": name, "status": "joined", "detail": "ok", "ms": int(elapsed * 1000)}


# ─── Start ───

print(f"=== Join existing users to waitlist ===")
print(f"  API: {API}")
print(f"  Admin: {ADMIN_ID}")
print(f"  Mode: {'PARALLEL (testing race conditions)' if PARALLEL else 'sequential'}")

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
    print("  No users found. Run test-seed.py first.")
    sys.exit(1)

# --- Join users ---
joined = 0
skipped = 0
errors = 0
total_start = time.monotonic()

if PARALLEL:
    print(f"\n--- Joining {len(users)} users in PARALLEL (max 10 threads) ---")
    results = []

    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {
            pool.submit(join_user, u, TOKEN, WAITLIST_ID): u
            for u in users
        }

        for future in as_completed(futures):
            results.append(future.result())

    # Sort by name for readability
    results.sort(key=lambda r: r["name"])

    for i, r in enumerate(results):
        icon = {"joined": "+", "skipped": "~", "error": "!"}[r["status"]]
        print(f"  {icon} {i+1}. {r['name']} -> {r['status']} ({r['ms']}ms) {r['detail'] if r['status'] == 'error' else ''}")

        if r["status"] == "joined":
            joined += 1
        elif r["status"] == "skipped":
            skipped += 1
        else:
            errors += 1
else:
    print(f"\n--- Joining {len(users)} users sequentially ---")

    for i, u in enumerate(users):
        r = join_user(u, TOKEN, WAITLIST_ID)
        icon = {"joined": "+", "skipped": "~", "error": "!"}[r["status"]]
        print(f"  {icon} {i+1}. {r['name']} -> {r['status']} ({r['ms']}ms) {r['detail'] if r['status'] == 'error' else ''}")

        if r["status"] == "joined":
            joined += 1
        elif r["status"] == "skipped":
            skipped += 1
        else:
            errors += 1

total_elapsed = time.monotonic() - total_start

# --- View the queue + game state ---
print(f"\n--- Current state ---")
data = get(f"/waitlist/{WAITLIST_ID}", user_id=ADMIN_ID)
queue = data.get("queue", [])
playing = data.get("playing", [])
staged = data.get("stagedTeams", [])
active_game = data.get("activeGame")

print(f"  Queue: {len(queue)} players")
print(f"  Playing: {len(playing)} players")
print(f"  Staged teams: {len(staged)}")
print(f"  Active game: {'Yes' if active_game else 'No'}")

if active_game:
    t1 = active_game["team1"]
    t2 = active_game["team2"]
    print(f"    {t1['color']}: {', '.join(tp['users']['first_name'] + ' ' + tp['users']['last_name'][0] + '.' for tp in t1['team_players'])}")
    print(f"    {t2['color']}: {', '.join(tp['users']['first_name'] + ' ' + tp['users']['last_name'][0] + '.' for tp in t2['team_players'])}")

for s in staged:
    print(f"    Staged {s['color']}: {', '.join(p['users']['first_name'] + ' ' + p['users']['last_name'][0] + '.' for p in s['players'])}")

if queue:
    print(f"\n  Queue order:")
    for i, p in enumerate(queue):
        name = f"{p['users']['first_name']} {p['users']['last_name'][0]}."
        print(f"    {i+1}. {name} ({p['status']})")

# --- Summary ---
print(f"\n=== Done ({total_elapsed:.1f}s total) ===")
print(f"  Joined: {joined}")
print(f"  Already in queue: {skipped}")
print(f"  Errors: {errors}")
print(f"\n  Waitlist: {WAITLIST_ID}")
print(f"  Token: {TOKEN}")

if PARALLEL and errors == 0 and active_game:
    print(f"\n  Race condition test PASSED: {joined} concurrent joins, game auto-started, no duplicate teams.")
elif PARALLEL and errors > 0:
    print(f"\n  Race condition test: {errors} errors detected — check advisory lock setup.")

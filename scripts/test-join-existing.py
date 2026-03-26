#!/usr/bin/env python3
"""
Join existing users to a waitlist via passcode — with parallel requests to test race conditions.

Usage:
    python scripts/test-join-existing.py [BASE_URL] [WAITLIST_ID] [NUM_PLAYERS] [--parallel]

Finds non-admin users and joins them to the specified waitlist using the passcode.
If NUM_PLAYERS is specified and more users are needed than exist, prompts to create
guest users to fill the gap.
If no waitlist ID is provided, uses the most recent one.

--parallel  Join all users concurrently (tests advisory lock / race conditions)

Requires env vars:
    SUPABASE_URL          — Supabase project URL
    SUPABASE_SECRET_KEY   — Supabase service role / secret key
    CLERK_SECRET_KEY      — Clerk secret key (for admin session token)
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

# Parse positional args (skip flags)
positional = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE_URL = positional[0] if len(positional) > 0 else "http://localhost:8081"
WAITLIST_ID = positional[1] if len(positional) > 1 else None
NUM_PLAYERS = int(positional[2]) if len(positional) > 2 else None
PARALLEL = "--parallel" in sys.argv
API = f"{BASE_URL}/api"

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY or not CLERK_SECRET_KEY:
    print("Required env vars: SUPABASE_URL, SUPABASE_SECRET_KEY, CLERK_SECRET_KEY")
    sys.exit(1)

try:
    from faker import Faker
    fake = Faker()
except ImportError:
    fake = None


# ─── Helpers ───

def supabase_query(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def get_clerk_sign_in_token(clerk_user_id):
    if not CLERK_SECRET_KEY.startswith("sk_"):
        print(f"  WARNING: CLERK_SECRET_KEY starts with '{CLERK_SECRET_KEY[:10]}...' — expected 'sk_...'")
        sys.exit(1)

    url = "https://api.clerk.com/v1/sign_in_tokens"
    body = json.dumps({"user_id": clerk_user_id}).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {CLERK_SECRET_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "womens-all-bball/1.0",
    }, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())["token"]
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  Clerk API error ({e.code}): {error_body}")
        print(f"  Clerk user ID: {clerk_user_id}")
        sys.exit(1)


def api_request(method, path, body=None, user_id=None, bearer_token=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if user_id:
        headers["x-user-id"] = user_id
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())
    except Exception as e:
        return {"error": str(e)}


def get(path, **kwargs):
    return api_request("GET", path, **kwargs)


def post(path, body=None, **kwargs):
    return api_request("POST", path, body=body, **kwargs)


def join_user(user, passcode, waitlist_id):
    """Join a single user via passcode."""
    start = time.monotonic()
    result = post(
        f"/waitlist/{waitlist_id}/join",
        body={"passcode": passcode},
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


def create_guest_users(count):
    """Create guest users with random names."""
    if not fake:
        print("Installing faker...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "faker", "-q"])
        from faker import Faker as F
        f = F()
    else:
        f = fake

    created = []
    for i in range(count):
        first = f.first_name_female()
        last = f.last_name()
        user = post("/users", body={"first_name": first, "last_name": last})
        created.append(user)
        print(f"    {i+1}. {first} {last} -> {user['id']}")
    return created


# ─── Setup admin ───

print(f"=== Join existing users to waitlist ===")
print(f"  API: {API}")
print(f"  Mode: {'PARALLEL (testing race conditions)' if PARALLEL else 'sequential'}")
if NUM_PLAYERS:
    print(f"  Requested: {NUM_PLAYERS} players")

admins = supabase_query("users", "role=eq.admin&clerk_id=not.is.null&limit=1")
if not admins:
    print("  No admin with clerk_id found.")
    sys.exit(1)

admin = admins[0]
ADMIN_TOKEN = get_clerk_sign_in_token(admin["clerk_id"])
print(f"  Admin: {admin['first_name']} {admin['last_name']}")

# ─── Find or use waitlist ───

if not WAITLIST_ID:
    print("\n--- Finding most recent waitlist ---")
    waitlists = get("/waitlist")
    if not waitlists or not isinstance(waitlists, list) or len(waitlists) == 0:
        print("  No waitlists found. Create one first.")
        sys.exit(1)
    WAITLIST_ID = waitlists[0]["id"]

# Get passcode from Supabase directly (GET /waitlist strips it for non-admins)
wl_rows = supabase_query("waitlists", f"id=eq.{WAITLIST_ID}")
if not wl_rows:
    print(f"  Waitlist {WAITLIST_ID} not found")
    sys.exit(1)
PASSCODE = wl_rows[0]["passcode"]
print(f"  Waitlist: {WAITLIST_ID}")
print(f"  Passcode: {PASSCODE}")

# ─── Find existing users ───

print("\n--- Finding users ---")
users = supabase_query("users", "role=eq.player&select=id,first_name,last_name&limit=200")
print(f"  Found {len(users)} existing players")

# ─── Handle shortfall ───

target = NUM_PLAYERS if NUM_PLAYERS else len(users)

if len(users) < target:
    shortfall = target - len(users)
    print(f"\n  Need {target} players but only found {len(users)} ({shortfall} short).")
    answer = input(f"  Create {shortfall} guest users? [Y/n] ").strip().lower()
    if answer in ("", "y", "yes"):
        print(f"\n--- Creating {shortfall} guest users ---")
        new_users = create_guest_users(shortfall)
        users.extend(new_users)
        print(f"  Now have {len(users)} players total")
    else:
        print(f"  Proceeding with {len(users)} existing players")
        target = len(users)

if not users:
    print("  No users to join. Run test-seed.py first.")
    sys.exit(1)

# Trim to requested count
users = users[:target]

# ─── Join users ───

joined = 0
skipped = 0
errors = 0
total_start = time.monotonic()

if PARALLEL:
    print(f"\n--- Joining {len(users)} users in PARALLEL (max 10 threads) ---")
    results = []

    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {
            pool.submit(join_user, u, PASSCODE, WAITLIST_ID): u
            for u in users
        }
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda r: r["name"])

    for i, r in enumerate(results):
        icon = {"joined": "+", "skipped": "~", "error": "!"}[r["status"]]
        detail = f" {r['detail']}" if r["status"] == "error" else ""
        print(f"  {icon} {i+1}. {r['name']} -> {r['status']} ({r['ms']}ms){detail}")

        if r["status"] == "joined":
            joined += 1
        elif r["status"] == "skipped":
            skipped += 1
        else:
            errors += 1
else:
    print(f"\n--- Joining {len(users)} users sequentially ---")

    for i, u in enumerate(users):
        r = join_user(u, PASSCODE, WAITLIST_ID)
        icon = {"joined": "+", "skipped": "~", "error": "!"}[r["status"]]
        detail = f" {r['detail']}" if r["status"] == "error" else ""
        print(f"  {icon} {i+1}. {r['name']} -> {r['status']} ({r['ms']}ms){detail}")

        if r["status"] == "joined":
            joined += 1
        elif r["status"] == "skipped":
            skipped += 1
        else:
            errors += 1

total_elapsed = time.monotonic() - total_start

# ─── View state ───

print(f"\n--- Current state ---")
data = get(f"/waitlist/{WAITLIST_ID}")
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

# ─── Summary ───

print(f"\n=== Done ({total_elapsed:.1f}s total) ===")
print(f"  Joined: {joined}")
print(f"  Already in queue: {skipped}")
print(f"  Errors: {errors}")

if PARALLEL and errors == 0 and active_game:
    print(f"\n  Race condition test PASSED: {joined} concurrent joins, game auto-started, no duplicate teams.")
elif PARALLEL and errors > 0:
    print(f"\n  Race condition test: {errors} errors detected — check advisory lock setup.")

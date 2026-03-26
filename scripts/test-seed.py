#!/usr/bin/env python3
"""
Seed script for Women's All B-Ball.

Usage:
    python scripts/test-seed.py [BASE_URL] [NUM_PLAYERS]

Finds an admin user from Supabase (must have clerk_id), obtains a Clerk session
token, creates guest players, a waitlist, and joins everyone via passcode.

Requires env vars:
    SUPABASE_URL          — Supabase project URL
    SUPABASE_SECRET_KEY   — Supabase service role / secret key
    CLERK_SECRET_KEY      — Clerk secret key (for generating sign-in tokens)
"""

import json
import os
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
NUM_PLAYERS = int(sys.argv[2]) if len(sys.argv) > 2 else 10
API = f"{BASE_URL}/api"

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY or not CLERK_SECRET_KEY:
    print("Required env vars: SUPABASE_URL, SUPABASE_SECRET_KEY, CLERK_SECRET_KEY")
    sys.exit(1)


# ─── Supabase direct query ───

def supabase_query(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


# ─── Clerk sign-in token ───

def get_clerk_session_token(clerk_user_id):
    """Create a Clerk sign-in token for the given user."""
    if not CLERK_SECRET_KEY.startswith("sk_"):
        print(f"  WARNING: CLERK_SECRET_KEY starts with '{CLERK_SECRET_KEY[:10]}...' — expected 'sk_...'")
        print("  Make sure you're using the Clerk secret key, not the Supabase key.")
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
            token_data = json.loads(resp.read())
        return token_data["token"]
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"  Clerk API error ({e.code}): {error_body}")
        print(f"  Clerk user ID: {clerk_user_id}")
        sys.exit(1)


# ─── API helpers ───

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
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())


def get(path, **kwargs):
    return api_request("GET", path, **kwargs)


def post(path, body=None, **kwargs):
    return api_request("POST", path, body=body, **kwargs)


# ─── Find admin ───

print(f"=== Using API at {API} ===")
print("\n--- Finding admin user from Supabase ---")

admins = supabase_query("users", "role=eq.admin&clerk_id=not.is.null&limit=1")
if not admins:
    print("  No admin user with clerk_id found in Supabase.")
    print("  Create a Clerk account, register via the app, then promote in DB:")
    print("    UPDATE users SET role = 'admin' WHERE id = '<your-user-id>';")
    sys.exit(1)

admin = admins[0]
admin_id = admin["id"]
admin_clerk_id = admin["clerk_id"]
print(f"  Admin: {admin['first_name']} {admin['last_name']} ({admin_id})")

print("\n--- Obtaining Clerk session token ---")
sign_in_token = get_clerk_session_token(admin_clerk_id)
print(f"  Sign-in token obtained")

# Exchange sign-in token for session JWT via Clerk Frontend API
# The sign-in token IS the bearer token we can use for admin ops
ADMIN_TOKEN = sign_in_token

# ─── Create players (as guests) ───

print(f"\n--- Creating {NUM_PLAYERS} guest players ---")
players = []
for i in range(NUM_PLAYERS):
    first = fake.first_name_female()
    last = fake.last_name()
    user = post("/users", body={
        "first_name": first,
        "last_name": last,
    })
    players.append(user)
    print(f"  {i+1}. {first} {last} -> {user['id']}")

# ─── Create waitlist ───

print("\n--- Creating waitlist ---")
waitlist = post("/waitlist", bearer_token=ADMIN_TOKEN)
if "error" in waitlist:
    print(f"  ERROR: {waitlist['error']}")
    sys.exit(1)
waitlist_id = waitlist["id"]
passcode = waitlist.get("passcode", "")
print(f"  Waitlist ID: {waitlist_id}")
print(f"  Passcode: {passcode}")

# ─── Join all players via passcode ───

print(f"\n--- Joining {NUM_PLAYERS} players via passcode ---")
for i, user in enumerate(players):
    result = post(
        f"/waitlist/{waitlist_id}/join",
        body={"passcode": passcode},
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
data = get(f"/waitlist/{waitlist_id}")
queue = data.get("queue", [])
print(f"  {len(queue)} players in queue:")
for i, p in enumerate(queue):
    print(f"    {i+1}. {p['users']['first_name']} {p['users']['last_name'][0]}. ({p['status']})")

# ─── Summary ───

print(f"\n=== Seed complete ===")
print(f"  Waitlist ID: {waitlist_id}")
print(f"  Admin ID:    {admin_id}")
print(f"  Passcode:    {passcode}")

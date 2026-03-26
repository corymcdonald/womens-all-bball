#!/usr/bin/env python3
"""
Full game flow test for Women's All B-Ball.

Usage:
    python scripts/test-full-game.py [BASE_URL] [NUM_PLAYERS]

Creates guest players, forms 2 teams, plays a game, completes it,
and verifies the orchestrator auto-starts the next game.

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
NUM_PLAYERS = int(sys.argv[2]) if len(sys.argv) > 2 else 12
API = f"{BASE_URL}/api"

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY or not CLERK_SECRET_KEY:
    print("Required env vars: SUPABASE_URL, SUPABASE_SECRET_KEY, CLERK_SECRET_KEY")
    sys.exit(1)


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
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())


def get(path, **kwargs):
    return api_request("GET", path, **kwargs)


def post(path, body=None, **kwargs):
    return api_request("POST", path, body=body, **kwargs)


def print_team(team):
    players = ", ".join(
        f"{tp['users']['first_name']} {tp['users']['last_name'][0]}."
        for tp in team["team_players"]
    )
    print(f"    {team['color']}: {players}")


# ─── Setup admin ───

print("=== Full game flow test ===")
print(f"  API: {API}")

admins = supabase_query("users", "role=eq.admin&clerk_id=not.is.null&limit=1")
if not admins:
    print("  No admin with clerk_id found. Set one up first.")
    sys.exit(1)

admin = admins[0]
ADMIN_TOKEN = get_clerk_sign_in_token(admin["clerk_id"])
print(f"  Admin: {admin['first_name']} {admin['last_name']}")

# ─── Create waitlist ───

print("\n--- Creating waitlist ---")
waitlist = post("/waitlist", bearer_token=ADMIN_TOKEN)
waitlist_id = waitlist["id"]
passcode = waitlist.get("passcode", "")
print(f"  Waitlist: {waitlist_id}")
print(f"  Passcode: {passcode}")

# ─── Create and join players (as guests, via passcode) ───

print(f"\n--- Creating {NUM_PLAYERS} players ---")
player_ids = []
for i in range(NUM_PLAYERS):
    first = fake.first_name_female()
    last = fake.last_name()
    user = post("/users", body={"first_name": first, "last_name": last})
    uid = user["id"]
    player_ids.append(uid)

    result = post(
        f"/waitlist/{waitlist_id}/join",
        body={"passcode": passcode},
        user_id=uid,
    )
    status = "joined" if "id" in result else result.get("error", "ok")
    print(f"  {first} {last}: {status}")
    time.sleep(0.05)

# ─── Form teams ───

print("\n--- Forming Team 1 ---")
team1_result = post(f"/waitlist/{waitlist_id}/form-team", bearer_token=ADMIN_TOKEN)
if "error" in team1_result:
    print(f"  ERROR: {team1_result['error']}")
    sys.exit(1)
team1 = team1_result["team"]
print(f"  {team1['color']} team: {', '.join(p['user']['first_name'] + ' ' + p['user']['last_name'][0] + '.' for p in team1_result['players'])}")

print("\n--- Forming Team 2 ---")
team2_result = post(f"/waitlist/{waitlist_id}/form-team", bearer_token=ADMIN_TOKEN)
if "error" in team2_result:
    print(f"  ERROR: {team2_result['error']}")
    sys.exit(1)
team2 = team2_result["team"]
print(f"  {team2['color']} team: {', '.join(p['user']['first_name'] + ' ' + p['user']['last_name'][0] + '.' for p in team2_result['players'])}")

# ─── Start game ───

print(f"\n--- Starting game: {team1['color']} vs {team2['color']} ---")
game = post("/games", body={
    "waitlist_id": waitlist_id,
    "team1_id": team1["id"],
    "team2_id": team2["id"],
}, bearer_token=ADMIN_TOKEN)
game_id = game["id"]
print(f"  Game ID: {game_id}")

# ─── View game ───

print("\n--- Game details ---")
game_detail = get(f"/games/{game_id}")
print_team(game_detail["team1"])
print_team(game_detail["team2"])
print(f"    Status: {game_detail['status']}")

# ─── Queue state ───

print("\n--- Queue state ---")
wl_state = get(f"/waitlist/{waitlist_id}")
queue = wl_state["queue"]
print(f"  {len(queue)} players in queue:")
for i, p in enumerate(queue):
    print(f"    {i+1}. {p['users']['first_name']} {p['users']['last_name'][0]}. ({p['status']})")

# ─── Complete game (team 1 wins) ───

print(f"\n--- Completing game ({team1['color']} wins) ---")
complete = post(f"/games/{game_id}/complete", body={
    "winner_id": team1["id"],
}, bearer_token=ADMIN_TOKEN)

if "error" in complete:
    print(f"  ERROR: {complete['error']}")
    sys.exit(1)

print(f"  Streak: {complete['streak']}")
print(f"  Maxed: {complete['streak_maxed']}")
print(f"  Players needed: {complete['players_needed']}")

# ─── Check auto-advance ───

print(f"\n--- Checking auto-advance ---")
time.sleep(0.5)
wl_state = get(f"/waitlist/{waitlist_id}")

if wl_state.get("activeGame"):
    ag = wl_state["activeGame"]
    print(f"  Next game auto-started!")
    print_team(ag["team1"])
    print_team(ag["team2"])
elif wl_state.get("stagedTeams"):
    print(f"  {len(wl_state['stagedTeams'])} teams staged, waiting for more players")
else:
    print(f"  No auto-advance (not enough players in queue)")

print(f"\n=== Full game flow complete ===")
print(f"  Waitlist: {waitlist_id}")

#!/usr/bin/env python3
"""
Full game flow test for Women's All B-Ball.

Usage:
    python scripts/test-full-game.py [BASE_URL] [ADMIN_USER_ID] [NUM_PLAYERS]

Creates players with random names (default 12), forms 2 teams, plays a game,
completes it, and auto-starts the next game with the winning team staying.

Requires: admin user already promoted in the DB.
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

NUM_PLAYERS = int(sys.argv[3]) if len(sys.argv) > 3 else 12

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8081"
ADMIN_ID = sys.argv[2] if len(sys.argv) > 2 else None
API = f"{BASE_URL}/api"

PLAYERS = [(fake.first_name_female(), fake.last_name()) for _ in range(NUM_PLAYERS)]

if not ADMIN_ID:
    print("Usage: python scripts/test-full-game.py [BASE_URL] [ADMIN_USER_ID] [NUM_PLAYERS]")
    print("Create an admin first with test-seed.sh, then promote them in the DB.")
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


def print_team(team):
    players = ", ".join(
        f"{tp['users']['first_name']} {tp['users']['last_name'][0]}."
        for tp in team["team_players"]
    )
    print(f"    {team['color']}: {players}")


# ─── Start ───

print("=== Full game flow test ===")
print(f"  API: {API}")
print(f"  Admin: {ADMIN_ID}")

# ─── Create waitlist ───

print("\n--- Creating waitlist ---")
waitlist = post("/waitlist", user_id=ADMIN_ID)
waitlist_id = waitlist["id"]
passcode = waitlist["passcode"]
print(f"  Waitlist: {waitlist_id}")
print(f"  Passcode: {passcode}")

# ─── Generate join token ───

print("\n--- Generating join token ---")
token_result = post(f"/waitlist/{waitlist_id}/token", user_id=ADMIN_ID)
if "error" in token_result:
    print(f"  ERROR: {token_result['error']}")
    sys.exit(1)
token = token_result["token"]
print(f"  Token: {token}")

# ─── Create and join players ───

print(f"\n--- Creating {len(PLAYERS)} players ---")
player_ids = []
for i, (first, last) in enumerate(PLAYERS):
    user = post("/users", body={
        "first_name": first,
        "last_name": last,
        "phone": f"555100{i+1:04d}",
    })
    uid = user["id"]
    player_ids.append(uid)

    result = post(
        f"/waitlist/{waitlist_id}/join-token",
        body={"token": token},
        user_id=uid,
    )
    status = "joined" if "id" in result else result.get("error", "ok")
    print(f"  {first} {last}: {status}")
    time.sleep(0.05)

# ─── Form teams ───

print("\n--- Forming Team 1 ---")
team1_result = post(f"/waitlist/{waitlist_id}/form-team", user_id=ADMIN_ID)
if "error" in team1_result:
    print(f"  ERROR: {team1_result['error']}")
    sys.exit(1)
team1 = team1_result["team"]
print(f"  {team1['color']} team: {', '.join(p['user']['first_name'] + ' ' + p['user']['last_name'][0] + '.' for p in team1_result['players'])}")

print("\n--- Forming Team 2 ---")
team2_result = post(f"/waitlist/{waitlist_id}/form-team", user_id=ADMIN_ID)
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
}, user_id=ADMIN_ID)
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
wl_state = get(f"/waitlist/{waitlist_id}", user_id=ADMIN_ID)
queue = wl_state["queue"]
print(f"  {len(queue)} players in queue:")
for i, p in enumerate(queue):
    print(f"    {i+1}. {p['users']['first_name']} {p['users']['last_name'][0]}. ({p['status']})")

# ─── Complete game (team 1 wins) ───

print(f"\n--- Completing game ({team1['color']} wins) ---")
complete = post(f"/games/{game_id}/complete", body={
    "winner_id": team1["id"],
}, user_id=ADMIN_ID)

if "error" in complete:
    print(f"  ERROR: {complete['error']}")
    sys.exit(1)

print(f"  Streak: {complete['streak']}")
print(f"  Maxed: {complete['streak_maxed']}")
print(f"  Players needed: {complete['players_needed']}")

# ─── Next game (winning team stays) ───

print(f"\n--- Starting next game ({team1['color']} stays) ---")
next_result = post(f"/games/{game_id}/next-game", body={
    "staying_team_id": team1["id"],
}, user_id=ADMIN_ID)

if "error" in next_result:
    print(f"  ERROR: {next_result['error']}")
    sys.exit(1)

next_game = next_result["game"]
challenger = next_result.get("challenger_team", {})
print(f"  New Game ID: {next_game['id']}")
print(f"  Challenger: {challenger.get('color', '?')}")
if "players" in challenger:
    for p in challenger["players"]:
        u = p.get("user", {})
        print(f"    - {u.get('first_name', '?')} {u.get('last_name', '?')[0]}.")

# ─── Done ───

print("\n=== Full game flow complete ===")
print(f"\n  Game 2 is now in progress: {next_game['id']}")
print(f"  Staying team: {team1['color']} ({team1['id']})")
print(f"  Challenger: {challenger.get('color', '?')} ({challenger.get('id', '?')})")
print(f"\n  To end game 2 ({team1['color']} wins again):")
print(f"    python -c \"import urllib.request,json; print(json.loads(urllib.request.urlopen(urllib.request.Request('{API}/games/{next_game['id']}/complete', json.dumps({{'winner_id':'{team1['id']}'}}).encode(), {{'Content-Type':'application/json','x-user-id':'{ADMIN_ID}'}}, method='POST')).read()))\"")
print(f"\n  Or with HTTPie:")
print(f"    http POST {API}/games/{next_game['id']}/complete x-user-id:{ADMIN_ID} winner_id={team1['id']}")
print(f"    http POST {API}/games/{next_game['id']}/next-game x-user-id:{ADMIN_ID} staying_team_id={team1['id']}")

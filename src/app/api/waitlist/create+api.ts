import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const PASSCODES = [
  "DRIBBLE",
  "PASS",
  "SHOOT",
  "REBOUND",
  "BLOCK",
  "STEAL",
  "SCREENPICK",
  "CUT",
  "DRIVE",
  "POSTUP",
  "JUMPSHOT",
  "LAYUP",
  "DUNK",
  "HOOKSHOT",
  "FLOATER",
  "PULLUPJUMPER",
  "STEPBACK",
  "FADEAWAY",
  "BANKSHOT",
  "TIPIN",
  "CHESTPASS",
  "BOUNCEPASS",
  "OVERHEADPASS",
  "NOLOOKPASS",
  "ALLEYOOP",
  "LOBPASS",
  "SKIPPASS",
  "ENTRYPASS",
  "OUTLETPASS",
  "KICKOUTPASS",
  "POINTGUARDPG",
  "SHOOTINGGUARD",
  "SMALLFORWARDSF",
  "POWERFORWARDPF",
  "CENTERC",
  "COMBOGUARD",
  "WING",
  "STRETCHFOUR",
  "DUALBIG",
  "SIXTHMAN",
  "PICKANDROLL",
  "PICKANDPOP",
  "ISOLATIONISO",
  "FASTBREAK",
  "MOTIONOFFENSE",
  "TRIANGLEOFFENSE",
  "HIGHLOW",
  "HORNSSET",
  "BACKDOORCUT",
  "SPOTUP",
  "MANTOMAN",
  "ZONEDEFENSE",
  "HELPDEFENSE",
  "SWITCHING",
  "HEDGING",
  "TRAPPING",
  "FULLCOURTPRESS",
  "HALFCOURTPRESS",
  "SAGGING",
  "CLOSEOUT",
  "PERPLAYEREFFICIENCYRATING",
  "TRUESHOOTINGTS",
  "BOXPLUSMINUSBPM",
  "VORP",
  "WINSHARES",
  "OFFENSIVERATING",
  "DEFENSIVERATING",
  "NETRATING",
  "USAGERATE",
  "EFFECTIVEFGEFG",
  "TRANSITION",
  "HALFCOURTOFFENSE",
  "CLUTCHTIME",
  "HACKAPLAYER",
  "FOULTOGIVE",
  "LATEGAMEFOUL",
  "INTENTIONALFOUL",
  "ANDONE",
  "DEADBALL",
  "LIVEBALL",
  "TRAVELING",
  "DOUBLEDRIBBLE",
  "CARRY",
  "GOALTENDING",
  "BACKCOURTVIOLATION",
  "SHOTCLOCKVIOLATION",
  "FLAGRANTFOUL",
  "TECHNICALFOUL",
  "CHARGE",
  "BLOCKINGFOUL",
  "PAINTLANE",
  "THREEPOINTARC",
  "MIDRANGE",
  "ELBOW",
  "HIGHPOST",
  "LOWPOST",
  "CORNERTHREE",
  "WINGTHREE",
  "HALFCOURT",
  "RESTRICTEDAREA",
];

export async function POST(request: Request) {
  await requireAdmin(request);

  const body = await request.json().catch(() => ({}));
  const passcode =
    body.passcode ?? PASSCODES[Math.floor(Math.random() * PASSCODES.length)];

  const { data, error } = await supabase
    .from("waitlists")
    .insert({ passcode })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}

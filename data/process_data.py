import csv
import json
from collections import defaultdict

rows = []
with open("crosby-game-by-game.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)

def safe_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

all_rows = [r for r in rows if r["situation"] == "all"]
fives_rows = [r for r in rows if r["situation"] == "5on5"]
pp_rows = [r for r in rows if r["situation"] == "5on4"]

game_stats = []
for r in all_rows:
    goals = safe_float(r["I_F_goals"])
    primary = safe_float(r["I_F_primaryAssists"])
    secondary = safe_float(r["I_F_secondaryAssists"])
    game_stats.append({
        "season": int(r["season"]),
        "gameId": r["gameId"],
        "gameDate": r["gameDate"],
        "opponent": r["opposingTeam"],
        "homeAway": r["home_or_away"],
        "goals": goals,
        "primaryAssists": primary,
        "secondaryAssists": secondary,
        "points": goals + primary + secondary,
        "xGoals": safe_float(r["I_F_xGoals"]),
        "shots": safe_float(r["I_F_shotsOnGoal"]),
        "gameScore": safe_float(r["gameScore"]),
        "icetime": safe_float(r["icetime"]) / 60,
        "lowDangerGoals": safe_float(r["I_F_lowDangerGoals"]),
        "medDangerGoals": safe_float(r["I_F_mediumDangerGoals"]),
        "highDangerGoals": safe_float(r["I_F_highDangerGoals"]),
        "lowDangerxGoals": safe_float(r["I_F_lowDangerxGoals"]),
        "medDangerxGoals": safe_float(r["I_F_mediumDangerxGoals"]),
        "highDangerxGoals": safe_float(r["I_F_highDangerxGoals"]),
        "corsiPct": safe_float(r["onIce_corsiPercentage"]),
    })

game_stats.sort(key=lambda x: x["gameDate"])

fives_by_game = {r["gameId"]: r for r in fives_rows}
pp_by_game = {r["gameId"]: r for r in pp_rows}
for g in game_stats:
    gid = g["gameId"]
    g["xGoals5v5"] = safe_float(fives_by_game.get(gid, {}).get("I_F_xGoals", 0))
    g["goals5v5"] = safe_float(fives_by_game.get(gid, {}).get("I_F_goals", 0))
    g["xGoalsPP"] = safe_float(pp_by_game.get(gid, {}).get("I_F_xGoals", 0))
    g["goalsPP"] = safe_float(pp_by_game.get(gid, {}).get("I_F_goals", 0))

season_groups = defaultdict(list)
for g in game_stats:
    season_groups[g["season"]].append(g)

fives_season = defaultdict(list)
for r in fives_rows:
    fives_season[int(r["season"])].append(r)

pp_season = defaultdict(list)
for r in pp_rows:
    pp_season[int(r["season"])].append(r)

season_stats = []
for season, games in sorted(season_groups.items()):
    gp = len(games)
    goals = sum(g["goals"] for g in games)
    primary = sum(g["primaryAssists"] for g in games)
    second = sum(g["secondaryAssists"] for g in games)
    points = sum(g["points"] for g in games)
    xGoals = sum(g["xGoals"] for g in games)
    avg_gs = sum(g["gameScore"] for g in games) / gp
    fives = fives_season.get(season, [])
    pp = pp_season.get(season, [])
    season_stats.append({
        "season": season,
        "seasonLabel": f"{season}-{str(season+1)[2:]}",
        "gp": gp,
        "goals": goals,
        "primaryAssists": primary,
        "secondaryAssists":second,
        "assists": primary + second,
        "points": points,
        "xGoals": xGoals,
        "avgGameScore": avg_gs,
        "goalsPerGame": goals  / gp,
        "pointsPerGame": points / gp,
        "lowDangerGoals": sum(g["lowDangerGoals"] for g in games),
        "medDangerGoals": sum(g["medDangerGoals"] for g in games),
        "highDangerGoals": sum(g["highDangerGoals"] for g in games),
        "lowDangerxGoals": sum(g["lowDangerxGoals"] for g in games),
        "medDangerxGoals": sum(g["medDangerxGoals"] for g in games),
        "highDangerxGoals": sum(g["highDangerxGoals"] for g in games),
        "goals5v5": sum(safe_float(r["I_F_goals"]) for r in fives),
        "xGoals5v5": sum(safe_float(r["I_F_xGoals"]) for r in fives),
        "goalsPP": sum(safe_float(r["I_F_goals"]) for r in pp),
        "xGoalsPP": sum(safe_float(r["I_F_xGoals"]) for r in pp),
    })

annotations = [
    {"season": 2009, "label": "Stanley Cup", "type": "championship"},
    {"season": 2011, "label": "Concussion", "type": "injury"},
    {"season": 2012, "label": "Lockout (48 GP)", "type": "lockout"},
    {"season": 2016, "label": "Stanley Cup", "type": "championship"},
    {"season": 2017, "label": "Stanley Cup", "type": "championship"},
    {"season": 2019, "label": "Surgery", "type": "injury"},
    {"season": 2021, "label": "COVID (56 GP)", "type": "lockout"},
]

with open("data/season_stats.json", "w") as f:
    json.dump(season_stats, f, indent=2)
with open("data/game_stats.json", "w") as f:
    json.dump(game_stats, f, indent=2)
with open("data/annotations.json", "w") as f:
    json.dump(annotations, f, indent=2)

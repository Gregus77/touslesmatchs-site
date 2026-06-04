import sqlite3
import json
import os
from datetime import datetime, timedelta

DB_PATH = os.environ.get("DB_PATH", "/app/data/history.db")


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Picks gratuits (≥ 8/10) — publiés sur le site
    c.execute("""
        CREATE TABLE IF NOT EXISTS picks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            match TEXT,
            bet TEXT,
            odds REAL,
            score TEXT,
            result TEXT,
            sport TEXT,
            confidence REAL,
            tier TEXT DEFAULT 'free',
            agents_votes TEXT,
            claude_reasoning TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Picks premium (7-7.9/10) — Telegram premium uniquement
    c.execute("""
        CREATE TABLE IF NOT EXISTS premium_picks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            match TEXT NOT NULL,
            bet TEXT NOT NULL,
            odds REAL,
            score TEXT,
            result TEXT,
            sport TEXT,
            confidence REAL,
            agents_votes TEXT,
            claude_reasoning TEXT,
            telegram_sent INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Performance des agents IA
    c.execute("""
        CREATE TABLE IF NOT EXISTS agent_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_name TEXT NOT NULL,
            date TEXT NOT NULL,
            recommendation TEXT,
            was_correct INTEGER,
            sport TEXT,
            confidence REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Abonnés premium Telegram
    c.execute("""
        CREATE TABLE IF NOT EXISTS premium_subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT UNIQUE NOT NULL,
            telegram_username TEXT,
            plan TEXT DEFAULT 'basic',
            price REAL,
            active INTEGER DEFAULT 1,
            expires_at TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def save_pick(date, match, bet, odds, sport, confidence, agents_votes, claude_reasoning, tier="free"):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO picks (date, match, bet, odds, sport, confidence, agents_votes, claude_reasoning, tier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (date, match, bet, odds, sport, confidence,
          json.dumps(agents_votes), claude_reasoning, tier))
    conn.commit()
    conn.close()


def save_premium_pick(date, match, bet, odds, sport, confidence, agents_votes, claude_reasoning):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO premium_picks (date, match, bet, odds, sport, confidence, agents_votes, claude_reasoning)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (date, match, bet, odds, sport, confidence,
          json.dumps(agents_votes), claude_reasoning))
    pick_id = c.lastrowid
    conn.commit()
    conn.close()
    return pick_id


def mark_premium_sent(pick_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE premium_picks SET telegram_sent=1 WHERE id=?", (pick_id,))
    conn.commit()
    conn.close()


def update_pick_result(date, score, result, tier="free"):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    table = "premium_picks" if tier == "premium" else "picks"
    c.execute(f"UPDATE {table} SET score=?, result=? WHERE date=?", (score, result, date))
    conn.commit()
    conn.close()


def get_recent_picks(days=30):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT date, match, bet, odds, score, result, sport, confidence
        FROM picks ORDER BY created_at DESC LIMIT 60
    """)
    rows = c.fetchall()
    conn.close()
    return rows


def get_stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM picks WHERE result IS NOT NULL AND result != '' AND result != 'NOPICK'")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM picks WHERE result='GAGNE'")
    wins = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM picks WHERE result='PERDU'")
    losses = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM picks WHERE result='NOPICK'")
    nopick = c.fetchone()[0]
    c.execute("SELECT SUM(odds - 1) FROM picks WHERE result='GAGNE'")
    total_gain = c.fetchone()[0] or 0

    winrate = round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else 0
    roi = round((total_gain - losses) / max(wins + losses, 1) * 100, 1)

    conn.close()
    return {"total": total, "wins": wins, "losses": losses, "nopick": nopick, "winrate": winrate, "roi": roi}


def get_premium_stats():
    """Statistiques détaillées pour les picks premium."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Stats globales premium
    c.execute("SELECT COUNT(*) FROM premium_picks WHERE result IS NOT NULL AND result != ''")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM premium_picks WHERE result='GAGNE'")
    wins = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM premium_picks WHERE result='PERDU'")
    losses = c.fetchone()[0]

    # Stats par sport
    c.execute("""
        SELECT sport, COUNT(*) as total,
               SUM(CASE WHEN result='GAGNE' THEN 1 ELSE 0 END) as wins,
               AVG(odds) as avg_odds
        FROM premium_picks
        WHERE result IS NOT NULL AND result != ''
        GROUP BY sport
    """)
    by_sport = [{"sport": r[0], "total": r[1], "wins": r[2],
                 "winrate": round(r[2]/r[1]*100, 1) if r[1] > 0 else 0,
                 "avg_odds": round(r[3] or 0, 2)} for r in c.fetchall()]

    # Stats par type de pari
    c.execute("""
        SELECT bet, COUNT(*) as total,
               SUM(CASE WHEN result='GAGNE' THEN 1 ELSE 0 END) as wins
        FROM premium_picks
        WHERE result IS NOT NULL AND result != ''
        GROUP BY bet ORDER BY total DESC LIMIT 10
    """)
    by_bet = [{"bet": r[0], "total": r[1], "wins": r[2],
               "winrate": round(r[2]/r[1]*100, 1) if r[1] > 0 else 0} for r in c.fetchall()]

    conn.close()
    winrate = round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else 0
    return {"total": total, "wins": wins, "losses": losses,
            "winrate": winrate, "by_sport": by_sport, "by_bet": by_bet}


def get_agent_accuracy():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Global accuracy
    c.execute("""
        SELECT agent_name, COUNT(*) as total, SUM(was_correct) as correct, sport
        FROM agent_performance
        WHERE was_correct IS NOT NULL
        GROUP BY agent_name
    """)
    rows = c.fetchall()
    conn.close()
    result = {}
    for row in rows:
        name, total, correct, sport = row
        if name not in result:
            result[name] = {"total": 0, "correct": 0, "accuracy": 0}
        result[name]["total"] += total
        result[name]["correct"] += correct or 0
    for name in result:
        t = result[name]["total"]
        result[name]["accuracy"] = round(result[name]["correct"] / t * 100, 1) if t > 0 else 0
    return result


def get_full_analytics():
    """Rapport complet pour Claude : performance par sport, IA, type de pari."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Meilleur sport (free + premium)
    c.execute("""
        SELECT sport, COUNT(*) as total,
               SUM(CASE WHEN result='GAGNE' THEN 1 ELSE 0 END) as wins,
               AVG(odds) as avg_odds
        FROM picks WHERE result NOT IN ('', 'NOPICK') AND result IS NOT NULL
        GROUP BY sport ORDER BY wins DESC
    """)
    sport_stats = c.fetchall()

    # Meilleur type de pari
    c.execute("""
        SELECT bet, COUNT(*) as total,
               SUM(CASE WHEN result='GAGNE' THEN 1 ELSE 0 END) as wins
        FROM picks WHERE result NOT IN ('', 'NOPICK') AND result IS NOT NULL
        GROUP BY bet ORDER BY wins DESC LIMIT 8
    """)
    bet_stats = c.fetchall()

    # Performance par IA agent
    c.execute("""
        SELECT agent_name, sport,
               COUNT(*) as total,
               SUM(CASE WHEN was_correct=1 THEN 1 ELSE 0 END) as correct
        FROM agent_performance
        WHERE was_correct IS NOT NULL
        GROUP BY agent_name, sport
        ORDER BY agent_name
    """)
    agent_sport_stats = c.fetchall()

    conn.close()

    lines = ["=== ANALYTICS COMPLETS ===\n"]
    lines.append("PAR SPORT:")
    for r in sport_stats:
        wr = round(r[2]/r[1]*100, 1) if r[1] > 0 else 0
        lines.append(f"  {r[0]}: {r[2]}/{r[1]} ({wr}%) cote moy {round(r[3] or 0, 2)}")

    lines.append("\nPAR TYPE DE PARI:")
    for r in bet_stats:
        wr = round(r[2]/r[1]*100, 1) if r[1] > 0 else 0
        lines.append(f"  {r[0]}: {r[2]}/{r[1]} ({wr}%)")

    lines.append("\nPAR AGENT IA:")
    for r in agent_sport_stats:
        acc = round(r[3]/r[2]*100, 1) if r[2] > 0 else 0
        lines.append(f"  {r[0]} ({r[1]}): {r[3]}/{r[2]} ({acc}%)")

    return "\n".join(lines)


def save_agent_vote(agent_name, date, recommendation, was_correct=None, sport=None, confidence=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO agent_performance (agent_name, date, recommendation, was_correct, sport, confidence)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (agent_name, date, recommendation, was_correct, sport, confidence))
    conn.commit()
    conn.close()

import sqlite3
import json
import os
from datetime import datetime, timedelta

DB_PATH = os.environ.get("DB_PATH", "/app/data/history.db")


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
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
            agents_votes TEXT,
            claude_reasoning TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS agent_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_name TEXT NOT NULL,
            date TEXT NOT NULL,
            recommendation TEXT,
            was_correct INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def save_pick(date, match, bet, odds, sport, confidence, agents_votes, claude_reasoning):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO picks (date, match, bet, odds, sport, confidence, agents_votes, claude_reasoning)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (date, match, bet, odds, sport, confidence,
          json.dumps(agents_votes), claude_reasoning))
    conn.commit()
    conn.close()


def update_pick_result(date, score, result):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        UPDATE picks SET score=?, result=? WHERE date=?
    """, (score, result, date))
    conn.commit()
    conn.close()


def get_recent_picks(days=30):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    since = (datetime.now() - timedelta(days=days)).strftime("%d/%m/%Y")
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
    c.execute("SELECT COUNT(*) FROM picks WHERE result IS NOT NULL AND result != ''")
    total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM picks WHERE result='GAGNE'")
    wins = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM picks WHERE result='PERDU'")
    losses = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM picks WHERE result='NOPICK'")
    nopick = c.fetchone()[0]
    c.execute("SELECT SUM(odds - 1) FROM picks WHERE result='GAGNE'")
    total_gain = c.fetchone()[0] or 0
    c.execute("SELECT COUNT(*) FROM picks WHERE result='PERDU'")
    total_loss_count = c.fetchone()[0]
    conn.close()
    winrate = round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else 0
    roi = round((total_gain - total_loss_count) / max(wins + losses, 1) * 100, 1)
    return {
        "total": total,
        "wins": wins,
        "losses": losses,
        "nopick": nopick,
        "winrate": winrate,
        "roi": roi,
    }


def get_agent_accuracy():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        SELECT agent_name,
               COUNT(*) as total,
               SUM(was_correct) as correct
        FROM agent_performance
        GROUP BY agent_name
    """)
    rows = c.fetchall()
    conn.close()
    result = {}
    for row in rows:
        name, total, correct = row
        result[name] = {
            "total": total,
            "correct": correct or 0,
            "accuracy": round((correct or 0) / total * 100, 1) if total > 0 else 0
        }
    return result


def save_agent_vote(agent_name, date, recommendation, was_correct=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO agent_performance (agent_name, date, recommendation, was_correct)
        VALUES (?, ?, ?, ?)
    """, (agent_name, date, recommendation, was_correct))
    conn.commit()
    conn.close()

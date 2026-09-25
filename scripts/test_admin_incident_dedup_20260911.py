#!/usr/bin/env python3
"""Isolated persistence test. Never calls Telegram or the network."""
import importlib.util
import sqlite3
import tempfile
from pathlib import Path

module_path = Path(__file__).with_name("tlm_hourly_director.py")
spec = importlib.util.spec_from_file_location("director_test", module_path)
director = importlib.util.module_from_spec(spec)
spec.loader.exec_module(director)

with tempfile.TemporaryDirectory() as folder:
    database = Path(folder) / "state.db"
    director.INCIDENT_DB = database
    first = director.sync_incidents(["API: indisponible"])
    assert [row[1] for row in first] == ["opened"]
    director.mark_incident_notified(first[0][0])
    assert director.sync_incidents(["API: indisponible"]) == []

    with sqlite3.connect(database) as connection:
        connection.execute("UPDATE admin_incident_notifications SET last_notified_ms=last_notified_ms-21600001")
    reminder = director.sync_incidents(["API: indisponible"])
    assert [row[1] for row in reminder] == ["reminder"]
    director.mark_incident_notified(reminder[0][0])
    assert director.sync_incidents(["API: indisponible"]) == []

    resolution = director.sync_incidents([])
    assert [row[1] for row in resolution] == ["resolved"]
    assert director.sync_incidents([]) == []

print("OK: ouverture unique, persistance redémarrage, rappel 6 h et résolution unique, zéro Telegram")

"""
Scheduler Hermes - déclenche le conseil à 11h59 chaque jour.
"""
import schedule
import time
import logging
import os
import sys

sys.path.insert(0, "/app/council")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SCHEDULER] %(message)s",
)
log = logging.getLogger("scheduler")


def job():
    log.info("Déclenchement du Conseil Hermes...")
    try:
        from hermes import run_council
        run_council()
    except Exception as e:
        log.error(f"Erreur lors de l'exécution du conseil: {e}", exc_info=True)


# Run at 11:59 every day (Paris time - TZ is set in docker-compose)
schedule.every().day.at("11:59").do(job)

log.info("Scheduler Hermes démarré. Prochain run à 11h59.")

# Optional: run immediately on first startup (for testing)
if os.environ.get("RUN_ON_START", "false").lower() == "true":
    log.info("RUN_ON_START=true → exécution immédiate pour test...")
    job()

while True:
    schedule.run_pending()
    time.sleep(30)

import unittest
from tlm_hourly_director import detect_log_alerts

class LogAlerts(unittest.TestCase):
    def test_stderr_failures(self):
        alerts=detect_log_alerts('', '[concile] aucun vote exploitable; Key limit exceeded; Invalid API Key')
        self.assertIn('Concile : votes indisponibles', alerts)
        self.assertIn('plafond fournisseur atteint', alerts)
        self.assertIn('clé IA invalide', alerts)
    def test_clean_logs(self):
        self.assertEqual(detect_log_alerts('listening on 3001', ''), [])
    def test_quota_and_budget(self):
        alerts=detect_log_alerts('Budget quotidien 0.8 atteint', 'Too many requests; HTTP 429')
        self.assertIn('alerte budget IA', alerts)
        self.assertIn('limite de requêtes atteinte', alerts)
    def test_no_raw_credentials_in_report(self):
        self.assertNotIn('secret-example', str(detect_log_alerts('', 'Invalid API Key secret-example')))

if __name__=='__main__': unittest.main()

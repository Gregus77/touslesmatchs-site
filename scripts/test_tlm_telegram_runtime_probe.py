import sqlite3, unittest
from tlm_telegram_runtime_probe import send_test, targets
class ProbeTest(unittest.TestCase):
    def test_delivered_is_never_sent_twice(self):
        db=sqlite3.connect(':memory:');calls=[]
        def transport(token,method,payload):
            calls.append(payload);return {'http':200,'body':{'ok':True,'result':{'message_id':123,'chat':{'id':-101}}}}
        first=send_test(db,'gratuit','private',-101,transport)
        second=send_test(db,'gratuit','private',-101,transport)
        self.assertEqual(first['message_id'],123);self.assertTrue(second['reused']);self.assertEqual(len(calls),1)
        self.assertTrue(calls[0]['text'].startswith('TEST'));self.assertIn('Aucun signal sportif',calls[0]['text'])
    def test_uncertain_is_never_retried_blindly(self):
        db=sqlite3.connect(':memory:');calls=[]
        def transport(*args):calls.append(1);return {'http':None,'body':{}}
        self.assertEqual(send_test(db,'premium','private',-102,transport)['state'],'uncertain')
        self.assertTrue(send_test(db,'premium','private',-102,transport)['reused']);self.assertEqual(len(calls),1)
    def test_wrong_chat_is_not_delivery_proof(self):
        db=sqlite3.connect(':memory:')
        def transport(*args):return {'http':200,'body':{'ok':True,'result':{'message_id':1,'chat':{'id':-999}}}}
        self.assertEqual(send_test(db,'hermes','private',-103,transport)['state'],'uncertain')
    def test_targets_match_current_client_fallback(self):
        env={'HERMES_ADMIN_TLM_BOT':'admin','TELEGRAM_ADMIN_CHAT_ID':'-1','TELEGRAM_BOT_TOKEN':'client','TELEGRAM_FREE_CHANNEL_ID':'-2','TELEGRAM_PREMIUM_CHANNEL_ID':'-3'}
        self.assertEqual(targets(env),[('hermes','admin','-1'),('gratuit','client','-2'),('premium','client','-3')])
if __name__=='__main__':unittest.main()

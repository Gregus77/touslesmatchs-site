import unittest,tempfile,pathlib
from tlm_owner_remote import authorized,handle
class Security(unittest.TestCase):
 def test_restricted(self):
  env={'TELEGRAM_ADMIN_USER_ID':'11','TELEGRAM_ADMIN_CHAT_ID':'22'};good={'from':{'id':11},'chat':{'id':22},'text':'/disk','message_id':3};state={'disk_percent':81}
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)
   self.assertIn('81',handle(good,env,state,p));self.assertIsNone(handle({**good,'from':{'id':12}},env,state,p));self.assertIsNone(handle({**good,'chat':{'id':23}},env,state,p))
   self.assertFalse(authorized(good,{'TELEGRAM_ADMIN_CHAT_ID':'22'}));self.assertFalse(authorized({**good,'sender_chat':{'id':22}},env))
   self.assertIn('refusée',handle({**good,'text':'/exec rm -rf /'},env,state,p));self.assertEqual(list(p.iterdir()),[])
   self.assertIn('enregistrée',handle({**good,'text':'/mission audit sans modification'},env,state,p));self.assertEqual(len(list(p.iterdir())),1)
   handle({**good,'text':'/mission autre'},env,state,p);self.assertEqual(len(list(p.iterdir())),1)
if __name__=='__main__':unittest.main()

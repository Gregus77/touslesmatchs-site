import os
import sys
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
if "openai" not in sys.modules:
    openai_stub = types.ModuleType("openai")
    openai_stub.OpenAI = object
    sys.modules["openai"] = openai_stub
from agents import gpt5_agent


class Gpt5RoutingTests(unittest.TestCase):
    def test_model_is_provider_qualified(self):
        self.assertIn("/", gpt5_agent.MODEL)
        self.assertTrue(gpt5_agent.MODEL.startswith("openai/"))

    def test_existing_openrouter_bridge_is_used(self):
        expected = {"recommendation": "NOPICK", "confidence": 0, "reasoning": "simulated"}
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "simulated"}, clear=False), \
             patch.object(gpt5_agent, "analyze_via_openrouter", return_value=expected) as bridge:
            result = gpt5_agent.analyze("14/09/2026", "matches", "history", {})
        self.assertEqual(result, expected)
        self.assertEqual(bridge.call_args.args[0], "GPT-5")
        self.assertEqual(bridge.call_args.args[1], gpt5_agent.MODEL)

    def test_missing_openrouter_key_is_explicit_and_does_not_call_provider(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": ""}, clear=False), \
             patch.object(gpt5_agent, "analyze_via_openrouter") as bridge:
            result = gpt5_agent.analyze("14/09/2026", "matches", "history", {})
        self.assertEqual(result["reasoning"], "Fournisseur non configure")
        bridge.assert_not_called()


if __name__ == "__main__":
    unittest.main()

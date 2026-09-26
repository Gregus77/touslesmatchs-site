#!/usr/bin/env python3
"""Ensure the public Premium CTA reaches the API before the static fallback."""
import pathlib
import re

ROOT=pathlib.Path(__file__).resolve().parents[1]
caddy=(ROOT/'Caddyfile').read_text()
route=re.search(r'handle /premium-checkout\s*\{\s*reverse_proxy api:3001\s*\}',caddy)
assert route,'Missing /premium-checkout reverse proxy'
fallback=caddy.index('# Frontend statique')
assert route.start()<fallback,'Premium checkout route must precede the static fallback'
print('PASS Premium checkout route precedes static fallback')

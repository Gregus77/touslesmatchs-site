#!/usr/bin/env python3
"""Regression test for the Guardian's protected O/U 2.5 display audit."""
import importlib.util
import pathlib

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('tlm_guardian',ROOT/'scripts/tlm_guardian.py')
guardian=importlib.util.module_from_spec(spec)
spec.loader.exec_module(guardian)

for relative_path,markers in guardian.PROTECTED_OU25_MARKERS.items():
 text=(ROOT/relative_path).read_text()
 assert guardian.protected_ou25_display_ok(relative_path,text),relative_path
 for marker in markers:
  without_marker=text.replace(marker,'')
  assert not guardian.protected_ou25_display_ok(relative_path,without_marker),(relative_path,marker)

assert not guardian.protected_ou25_display_ok('public/unknown.html','locked')
assert 'marketText' not in {
 marker
 for markers in guardian.PROTECTED_OU25_MARKERS.values()
 for marker in markers
}

print('PASS guardian protected O/U 2.5 display markers')

#!/bin/bash
# GARDIEN TousLesMatchs
STABLE_SHA="251078d803a4de6a9f1a"
CURRENT_SHA=$(sha256sum /opt/touslesmatchs/site/index.html 2>/dev/null | cut -c1-20)
if [ "$CURRENT_SHA" != "$STABLE_SHA" ]; then
  echo "🚨 ALERTE: site MODIFIE ! SHA=$CURRENT_SHA (stable=$STABLE_SHA)"
  echo "Restaure: git checkout v4-stable-20260719-2232 -- site/index.html"
  exit 1
fi
echo "✅ Site OK"

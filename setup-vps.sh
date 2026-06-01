#!/bin/bash
# Premier setup du VPS Hostinger - a executer UNE SEULE FOIS
set -e

echo "=== Installation Docker ==="
apt update
apt install -y docker.io docker-compose-plugin git curl

systemctl enable docker
systemctl start docker

echo "=== Clonage du repo ==="
mkdir -p /opt/touslesmatchs
cd /opt/touslesmatchs
git clone https://github.com/Gregus77/touslesmatchs-site.git .
git checkout main

echo "=== Lancement du site ==="
docker compose up --build -d

echo "=== Done! Site disponible sur http://72.61.167.175 ==="
echo "Apres config DNS OVH, il sera sur https://www.touslesmatchs.com"

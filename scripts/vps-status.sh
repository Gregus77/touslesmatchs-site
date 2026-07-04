#!/bin/bash
# VPS Status Collector — runs on the HOST via cron every minute
# Writes /opt/touslesmatchs/shared/vps-status.json (read by API container)

OUT_DIR="/opt/touslesmatchs/shared"
OUT_FILE="$OUT_DIR/vps-status.json"
mkdir -p "$OUT_DIR"

# CPU usage (average since boot from /proc/stat)
read -r _ user nice system idle iowait irq softirq steal _ < /proc/stat
total=$((user + nice + system + idle + iowait + irq + softirq + steal))
busy=$((total - idle - iowait))
cpu_pct=$((busy * 100 / (total > 0 ? total : 1)))

# RAM
mem_total=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
mem_avail=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
mem_used=$((mem_total - mem_avail))
mem_total_mb=$((mem_total / 1024))
mem_used_mb=$((mem_used / 1024))
mem_pct=$((mem_used * 100 / (mem_total > 0 ? mem_total : 1)))

# Disk
disk_json=$(df -B1 / | awk 'NR==2 {printf "{\"totalGB\":%d,\"usedGB\":%d,\"pct\":%d}", $2/1073741824, $3/1073741824, $5}')

# Load average
read -r load1 load5 load15 _ _ < /proc/loadavg

# Uptime
uptime_sec=$(awk '{printf "%d", $1}' /proc/uptime)

# Docker containers
docker_json="[]"
if command -v docker &>/dev/null; then
  docker_json=$(docker ps -a --format '{"name":"{{.Names}}","image":"{{.Image}}","state":"{{.State}}","status":"{{.Status}}"}' 2>/dev/null | \
    awk 'BEGIN{printf "["} NR>1{printf ","} {print} END{printf "]"}')
  [ -z "$docker_json" ] && docker_json="[]"
fi

# Backups
backup_dir="/data/backups"
backups_json="[]"
if [ -d "$backup_dir" ]; then
  backups_json=$(find "$backup_dir" -maxdepth 1 -type f ! -name '.*' -printf '{"name":"%f","sizeMB":%s,"date":"%TY-%Tm-%TdT%TH:%TM:%TS"}\n' 2>/dev/null | \
    awk '{gsub(/\"sizeMB\":[0-9]+/, "\"sizeMB\":" int(substr($0, index($0,"\"sizeMB\":")+9) / 1048576))} 1' | \
    sort -t'"' -k8 -r | head -10 | \
    awk 'BEGIN{printf "["} NR>1{printf ","} {print} END{printf "]"}')
  [ -z "$backups_json" ] && backups_json="[]"
fi

# Write JSON
cat > "$OUT_FILE" <<ENDJSON
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "cpu": $cpu_pct,
  "ram": {"totalMB":$mem_total_mb,"usedMB":$mem_used_mb,"pct":$mem_pct},
  "disk": $disk_json,
  "load": {"m1":"$load1","m5":"$load5","m15":"$load15"},
  "uptime": $uptime_sec,
  "docker": $docker_json,
  "backups": $backups_json
}
ENDJSON

#!/bin/bash
set -euo pipefail

DISPLAY_NUMBER="${DISPLAY#:}"
VNC_PORT=5900
NOVNC_PORT=6080

rm -f "/tmp/.X${DISPLAY_NUMBER}-lock"
mkdir -p /tmp/.X11-unix /run/dbus /home/pi/.cache /home/pi/.config/chromium
chown -R pi:pi /home/pi/.cache /home/pi/.config

cleanup() {
    jobs -pr | xargs -r kill
}
trap cleanup EXIT INT TERM

Xvfb "${DISPLAY}" \
    -screen 0 "${KIOSK_WIDTH}x${KIOSK_HEIGHT}x24" \
    -ac \
    -nolisten tcp &

for _ in $(seq 1 50); do
    if DISPLAY="${DISPLAY}" xdpyinfo >/dev/null 2>&1; then
        break
    fi
    sleep 0.1
done

if ! DISPLAY="${DISPLAY}" xdpyinfo >/dev/null 2>&1; then
    echo "kiosk-simulator: Xvfb kon niet worden gestart" >&2
    exit 1
fi

runuser -u pi -- env DISPLAY="${DISPLAY}" dbus-run-session -- openbox-session &

x11vnc \
    -display "${DISPLAY}" \
    -forever \
    -shared \
    -noshm \
    -nopw \
    -localhost \
    -rfbport "${VNC_PORT}" &

websockify \
    --web=/usr/share/novnc \
    "0.0.0.0:${NOVNC_PORT}" \
    "127.0.0.1:${VNC_PORT}" &

echo "Cartouche Kiosk-simulator: http://localhost:${NOVNC_PORT}/vnc.html?autoconnect=1&resize=scale"
wait -n

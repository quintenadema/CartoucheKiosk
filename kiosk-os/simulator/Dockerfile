FROM debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:0 \
    KIOSK_WIDTH=1920 \
    KIOSK_HEIGHT=1080

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        chromium \
        dbus-x11 \
        feh \
        fonts-noto-color-emoji \
        novnc \
        openbox \
        php-cli \
        procps \
        python3-xdg \
        unclutter \
        websockify \
        x11-utils \
        x11-xserver-utils \
        x11vnc \
        xdotool \
        xvfb \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 --shell /bin/bash pi

COPY kiosk_skeleton/usr/bin/get-ini /usr/bin/get-ini
COPY kiosk_skeleton/usr/bin/cache-clear-timer /usr/bin/cache-clear-timer
COPY kiosk_skeleton/home/pi/.config/openbox/autostart /home/pi/.config/openbox/autostart
COPY kiosk_skeleton/boot/firmware/kioskbrowser.ini /boot/firmware/kioskbrowser.ini
COPY kiosk_skeleton/boot/firmware/splash.png /boot/firmware/splash.png
COPY simulator/chromium-docker /usr/local/bin/chromium
COPY simulator/entrypoint.sh /usr/local/bin/kiosk-simulator

RUN chmod +x \
        /usr/bin/get-ini \
        /usr/bin/cache-clear-timer \
        /home/pi/.config/openbox/autostart \
        /usr/local/bin/chromium \
        /usr/local/bin/kiosk-simulator \
    && chown -R pi:pi /home/pi

EXPOSE 6080

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
    CMD php -r 'exit(@file_get_contents("http://127.0.0.1:6080/vnc.html") === false ? 1 : 0);'

ENTRYPOINT ["/usr/local/bin/kiosk-simulator"]

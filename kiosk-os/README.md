# Cartouche Kiosk OS

Deze map bevat het Raspberry Pi-besturingssysteem voor de informatieschermen van HC Cartouche. Het is een fork/kopie van [Manawyrm/AnotterKiosk](https://github.com/Manawyrm/AnotterKiosk), aangepast voor de Cartouche-opstelling.

De belangrijkste Cartouche-wijzigingen zijn:

- meerdere fysieke schermen vanuit één Raspberry Pi;
- een losse Chromium-instantie per scherm, elk met een eigen URL;
- positionering, resolutie en rotatie per HDMI-output;
- optioneel remote beheer via Tailscale;
- behoud van het read-only rootbestandssysteem voor een lange levensduur van de opslag;
- Cartouche-specifieke installatie- en overdrachtsdocumentatie.

De oorspronkelijke AnotterKiosk-code en licentie blijven herkenbaar aanwezig. Bij het overnemen van upstream-wijzigingen moeten de multi-screen- en Tailscale-aanpassingen opnieuw worden getest.

## Beoogde Cartouche-opstelling

Eén Raspberry Pi stuurt twee schermen aan. De concrete pagina per scherm wordt in `kioskbrowser.ini` ingesteld. Mogelijke routes zijn:

- `https://cartouche-dome.vercel.app/indoor`
- `https://cartouche-dome.vercel.app/outdoor`
- `https://cartouche-dome.vercel.app/sponsors`

Voorbeeld met twee horizontale Full HD-schermen:

```ini
[general]
hostname="cartouche-kiosk-01"
timezone="Europe/Amsterdam"
keyboard_layout="us"

[screen1]
output="HDMI-1"
position="0x0"
mode="1920x1080"
rotate="normal"
primary=1

[screen2]
output="HDMI-2"
position="1920x0"
mode="1920x1080"
rotate="normal"

[browser1]
url="https://cartouche-dome.vercel.app/indoor"
output="HDMI-1"

[browser2]
url="https://cartouche-dome.vercel.app/sponsors"
output="HDMI-2"
```

Outputnamen kunnen per Raspberry Pi OS/Chromium-versie verschillen. Controleer ze na installatie via SSH met `DISPLAY=:0 xrandr --query`.

## Tailscale remote beheer

Tailscale is in het image geïnstalleerd maar standaard uitgeschakeld. De Pi blijft daardoor lokaal functioneren als Tailscale nog niet is ingericht.

### Eerste registratie

1. Maak in de Tailscale Admin Console een **eenmalige, pre-authorized auth key**. Gebruik bij voorkeur een tag met minimale ACL-rechten, bijvoorbeeld alleen SSH vanaf beheerdersapparaten.
2. Plaats de key als enige regel in `tailscale-auth.key` op de FAT-bootpartitie van de geflashte opslag.
3. Zet in `kioskbrowser.ini`:

   ```ini
   [tailscale]
   enabled=1
   auth_key_file="/boot/firmware/tailscale-auth.key"
   accept_dns=0
   tailscale_ssh=0
   ```

4. Start de Pi. Na succesvolle registratie wordt de eenmalige key uit het bestand gewist.
5. Controleer in de Tailscale Admin Console of de node de ingestelde Cartouche-hostname heeft.

De blijvende Tailscale-node-identiteit staat in `/boot/firmware/tailscale/tailscaled.state`. Alleen de kleine FAT-configuratiepartitie is hiervoor beschrijfbaar; de Linux-rootpartitie blijft read-only. Bewaar nooit een herbruikbare Tailscale-key op de bootpartitie.

OpenSSH is al aanwezig. Als de tailnet-ACL verkeer toestaat, kan een beheerder verbinden met:

```bash
ssh pi@cartouche-kiosk-01
```

`tailscale_ssh=1` zet daarnaast Tailscale SSH aan. Gebruik dit uitsluitend wanneer de Tailscale ACL hiervoor bewust is ingericht.

### Diagnose

```bash
systemctl status kiosk-tailscale tailscaled
tailscale status
tailscale netcheck
journalctl -u kiosk-tailscale -u tailscaled --no-pager
```

Als de node na vervanging van hardware opnieuw moet worden geregistreerd, verwijder dan de oude node uit de Tailscale Admin Console, verwijder `tailscale/tailscaled.state` van de bootpartitie en herhaal de registratie met een nieuwe eenmalige key.

## Image bouwen

De scripts bouwen een image door een Raspberry Pi OS-image te downloaden, te vergroten, de skeletonbestanden te kopiëren en packages in een chroot te installeren. Dit vereist een Linux-buildhost met rootrechten, loop devices, `rsync`, `xz`, `zerofree` en voldoende vrije schijfruimte.

Gebruik voor JavaScript-gerelateerde hulpmiddelen in dit repository Bun; de imagebuild zelf bestaat uit shellscripts en apt.

De hoofdentrypoint is:

```bash
sudo ./build_raspberry_pi.sh <RASPIOS_URL> <SHA256> arm64-raspberrypi
```

De exacte Raspberry Pi OS-URL en SHA256 veranderen in de tijd. Leg bij een release vast welke upstream image, commit en architectuur zijn gebruikt. Test een nieuw image altijd fysiek met twee schermen voordat het op locatie wordt vervangen.

## Wijzigingen ten opzichte van upstream bewaken

Let bij updates vooral op:

- `kiosk_skeleton/boot/firmware/kioskbrowser.ini` — configuratieformaat;
- Openbox/X11-startscripts — multi-screenindeling en browservensters;
- `kiosk_skeleton/build.sh` — Tailscale-repository en packages;
- `kiosk-tailscale` en de systemd-overrides — blijvende state op de bootpartitie;
- `raspberry_pi_skeleton/etc/fstab` — read-only root en schrijfbare configuratiepartitie.

---

# Oorspronkelijke AnotterKiosk-documentatie

Onderstaande documentatie komt uit het upstreamproject en beschrijft de algemene werking en mogelijkheden waarop deze fork is gebaseerd.

<img src="https://screenshot.tbspace.de/zachejgwlkq.jpg" width="45%"> <img src="https://screenshot.tbspace.de/kuhmlynagbw.jpg" width="45%">
<img src="https://screenshot.tbspace.de/tdouafprbqk.jpg" width="45%"> <img src="https://screenshot.tbspace.de/rmhezfgucdj.jpg" width="45%">

## Overview
Another kiosk browser OS? Yes, this one is a little bit opinionated :grin:  

This project is a Debian Linux-based OS for computers, either PCs or Raspberry Pi's and has only one job:  
| :computer:  Display a web page in full screen very reliably and securely   |
|----------------------------------------------|

The author of this project ran several similar setups in production for years and has seen a lot of problems and strange failure modes.  
This project aims to solve a lot of those (at least for the author), it might also be useful for others :)  

Other similar projects:
- will run the computer in 32bit mode (making them very slow/laggy)
- write to the storage device (killing it in the long run, causing bad reliability)
- have insecure configurations (like open ports, network access or unsafe UI features)
- are not built via CI (instead have people manually building images)
- are missing watchdog functionality (can hang on browser error pages forever)

## Key features
- [Images built via CI](https://github.com/Manawyrm/AnotterKiosk/blob/main/.github/workflows/main.yml)
- WiFi & Ethernet connection support
- Raspberry Pi & PC (64-bit) compatibility
- [USB flash drive, USB SSD, etc. compatible](#how-to--installation-guide)
- aarch64 images for Raspberry Pis (_significant_ performance improvements over armv7/32bit ARM)
- Read-only filesystem (no more broken SD cards)
- Browser cache can be cleared at configurable intervals
- [HTTP watchdog (website needs to send heartbeat messages via XHR/AJAX to localhost)](#http-watchdog-functionality)
- Force specific resolution (1080p on 4k screens, broken EDID, etc.)
- Configurable audio output (HDMI, 3.5mm, USB audio, etc.)
- Hard NTP handling (will wait for NTP at boot)
- SSH support
- VNC support
- SSH tunneling support (for remote-access without port-forwarding, on DS-Lite/cellular connections, etc.)
- Graphical splash screen while booting
- Support for multi-touch touch-screens and gestures
- Dark mode support
- Configurable timezone and keyboard layout
- Optional screen blanking (DPMS) interval for interactive systems
- [Local webserver with PHP support](#local-webserver) (can host simple HTML, landing pages, slideshows, iFrame mechanisms, etc.)

## Supported platforms
- Raspberry Pi 3, 4, 5, Zero 2 (W): use `arm64-raspberrypi.img.xz`
- PCs with UEFI (Intel, AMD or Nvidia GPUs): use `x86.img.xz`

**not recommended, but working**
- Raspberry Pi 1, 2, Zero (W) (very slow, 32bit only, try to avoid): use `armhf-raspberrypi.img.xz`

## Application examples
- Digital signage
- Video streams (Cameras, Livestreams, etc.)
- Grafana dashboard
- Public transport timetable
- Digital picture frame/slideshow
- Victron Solar dashboard
- Interactive maps
- Digital concierge
- Magic mirrors

> [!TIP]
> Combining AnotterKiosk with an existing web CMS (like Typo3) is an excellent way to build a very flexible digital signage solution:  
> By configuring a hidden/special sub-page with a full-screen layout, employees can easily modify the digital signage solution themselves.
> Often teams are already trained on the existing content management systems, reducing training times.  
> It will also work without any monthly fees (unlike other hosted/SaaS/cloud-based digital signage solutions).

## Planned features:
- Raspberry Pi PXE/network boot support
- Network connectivity watchdog (configurable ping, etc. timeout)
- Automatic reboot at specified time

## Security considerations:
- Autossh does not check SSH host keys. This is okay-ish as long as the target server only allows tunneling, nothing else.
- nginx/PHP are allowed to use sudo/NOPASSWD (because it needs to query the VideoCore, manage service, etc.), more priviledge seperation would be nice
- due to the skeleton mechanism, the system has some ... creative permissions. some cleanup required.
- AnotterKiosk is not built in a reproducible/repeatible way. This is basically unfixable due to the nature of the build process.

## How-To / Installation guide

> [!IMPORTANT]  
> AnotterKiosk does not have an installer for x86 PCs. On PCs, you'll need to write the image to the storage somehow.
> Either write the storage media (like NVMe or SATA storage) externally using another PC or boot a Linux Live-ISO and use dd to flash the image.

> [!WARNING]  
> Don't use the `armhf` images on Raspberry Pi 3 or newer (or the Zero 2 (W)). It will work, but performance will be impacted severely.

Just like any other Raspberry Pi image:   
Download the current .img.xz file from the [Releases](https://github.com/Manawyrm/AnotterKiosk/releases) page and flash it to a storage device of your choice.  
SD cards, USB flash drives, USB SSDs, SATA SSDs, NVMe SSDs are all good options.  
You can use a tool like the [Raspberry Pi Imager](https://www.raspberrypi.com/software/), [BalenaEtcher](https://etcher.balena.io/), [Win32DiskImager](https://sourceforge.net/projects/win32diskimager/) or plain "dd" on \*nix-like systems.   
When using the latter two, make sure to extract the .gz compression first (using a tool like 7zip).  

After flashing, re-plug the storage device and open the FAT32 partition.  
Open the [`kioskbrowser.ini`](https://github.com/Manawyrm/AnotterKiosk/blob/main/kiosk_skeleton/boot/firmware/kioskbrowser.ini) file in a text editor and change everything to your needs.  
More complex WiFi setups (like WPA2-Enterprise) can be configured by creating a wpa_supplicant.conf.  
Adding your own SSH keys can be done by creating a authorized_keys file.  
If you want to use the autossh tunneling features, copy an SSH private key as either "id_rsa" or "id_ed25519".  
The splash screen can be customized by replacing (or entirely removing) `splash.png`.

## Multi-screen & multi-browser setup
You can configure multiple outputs (including rotated displays) and start multiple Chromium instances
with per-instance URLs and window positions. This is configured in `kioskbrowser.ini` using
`[screen1]`, `[screen2]`, ... and `[browser1]`, `[browser2]`, ... sections.

Example (two screens, second one rotated):
```ini
[screen1]
output = "HDMI-1"
position = "0x0"
mode = "1920x1080"
rotate = "normal"
primary = 1

[screen2]
output = "DP-1"
position = "1920x0"
mode = "1080x1920"
rotate = "right"

[browser1]
url="https://example.com/"
output="HDMI-1"

[browser2]
url="https://example.org/"
output="HDMI-2"
```

Notes:
- If any `[screenN]` sections exist, the legacy single-screen settings in `[screen]` (like `rotate_screen`)
  are ignored, except for `blanking_interval`.
- If `output` is omitted in `[screenN]`, connected outputs are assigned in order.
- To discover output names (`HDMI-1`, `DP-1`, etc.), run `xrandr` via SSH.
- If any `[browserN]` sections exist, the single `[browser]` url is ignored, but the other browser settings
  (`darkmode`, etc.) still apply to all instances. `cache_clear_interval` can be set per `[browserN]`.
- For `[browserN]`, `output` can be used instead of pixel math. `window_position`/`window_size` remain optional overrides.

## HTTP watchdog functionality
Browsers are complex, networks are unstable and software can be buggy.   
In order to get the highest reliability possible, self-hosted websites can be modified to include a heartbeat/watchdog functionality.
This works by requesting a certain http-endpoint from the website at some interval.   
If your page is being reloaded often (like with a <meta refresh=-header), you can just load the heartbeat-URL as an image:
```html
<img src="http://localhost/heartbeat.php" style="display: none;">
```

If your page stays on one page for a long time (or is just a single-page application), you might want to use AJAX requests to send a heartbeat:
```html
<script>
const req = new XMLHttpRequest();
setInterval(function() {
	req.open("GET", "http://localhost/heartbeat.php");
	req.send();
}, 2000);
</script>
```

Whenever the heartbeat stops (for whatever reason), the device will first restart the X11 environment (browser, window manager, etc.) and later (if it hasn't recovered) the whole system by rebooting.

## Local webserver
AnotterKiosk ships with an nginx webserver and a PHP runtime by default (which is used internally for the heartbeat mechanism).  
Users can create a folder called `www-public` on the FAT32 partition and put custom HTML or PHP scripts there.  
Any files placed in the `/boot/firmware/www-public` folder will be available via `http://localhost/www-public/`.  
Files called `index.php` will be served as the directory index.  

This allows for a number of different mechanisms to be self-hosted, even without any network connectivity at all!
- Local user interfaces (interaction with GPIOs, sensors, cameras, local storage, etc.)
- Offline slideshow (folder full of JPEGs)
- [Small iFrame application to switch between different pages on display](https://gist.github.com/Manawyrm/86f3d4a762fd5138a4ffa7ba4d180d24)
- Custom digital signage code to download/render online info

## Inspiration / Other Kiosk-OSes:
- https://github.com/jareware/chilipie-kiosk/
- https://github.com/guysoft/FullPageOS

#!/bin/bash
set -euo pipefail
script=$(cd "$(dirname "$0")/.." && pwd)/kiosk_skeleton/usr/bin/kiosk-tv
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
export TV_TEST_LOG="$test_dir/log"
cat > "$test_dir/get-ini" <<'STUB'
#!/bin/bash
case "$3" in
 enabled) echo "${TV_TEST_ENABLED:-1}";;
 device) echo /dev/cec0;;
 timezone) echo Europe/Amsterdam;;
esac
STUB
cat > "$test_dir/date" <<'STUB'
#!/bin/bash
[[ "$TZ" == Europe/Amsterdam ]] || exit 1
echo "$TV_TEST_HOUR"
STUB
cat > "$test_dir/cec-ctl" <<'STUB'
#!/bin/bash
case "$*" in
 *--logical-address*) echo 4;;
 *--physical-address*) echo "${TV_TEST_ADDRESS:-2.0.0.0}";;
 *) echo "$*" >> "$TV_TEST_LOG";;
esac
STUB
cat > "$test_dir/sleep" <<'STUB'
#!/bin/bash
exit 0
STUB
chmod +x "$test_dir/"{get-ini,date,cec-ctl,sleep}
export PATH="$test_dir:$PATH"
for hour in 00 08 09 23; do
    export TV_TEST_HOUR=$hour
    : > "$TV_TEST_LOG"
    bash "$script" >/dev/null
    if (( 10#$hour < 9 )); then
        grep -q -- --standby "$TV_TEST_LOG"
        ! grep -Eq -- 'image-view-on|active-source' "$TV_TEST_LOG"
    else
        grep -q -- --image-view-on "$TV_TEST_LOG"
        grep -q -- 'phys-addr=2.0.0.0' "$TV_TEST_LOG"
        ! grep -q -- --standby "$TV_TEST_LOG"
    fi
done
: > "$TV_TEST_LOG"
TV_TEST_ENABLED=0 bash "$script"
[[ ! -s "$TV_TEST_LOG" ]]
: > "$TV_TEST_LOG"
if TV_TEST_ADDRESS=f.f.f.f bash "$script" >/dev/null 2>&1; then
    echo 'Invalid HDMI address should fail' >&2
    exit 1
fi
! grep -q -- --active-source "$TV_TEST_LOG"
echo 'Passed TV schedule boundaries, disabled setting, dynamic HDMI address and missing address checks.'

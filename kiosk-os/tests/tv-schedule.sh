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
echo "$TV_TEST_TIME"
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
for day in 1 2 3 4 5 6 7; do
    if (( day <= 5 )); then
        cases="00:00:off 15:59:off 16:00:on 23:29:on 23:30:off 23:59:off"
    else
        cases="00:00:off 07:59:off 08:00:on 22:29:on 22:30:off 23:59:off"
    fi
    for item in $cases; do
        IFS=: read -r hour minute expected <<< "$item"
        export TV_TEST_TIME="$day $hour $minute"
        : > "$TV_TEST_LOG"
        bash "$script" >/dev/null
        if [[ "$expected" == off ]]; then
            grep -q -- --standby "$TV_TEST_LOG"
            ! grep -Eq -- 'image-view-on|active-source' "$TV_TEST_LOG"
        else
            grep -q -- --image-view-on "$TV_TEST_LOG"
            grep -q -- 'phys-addr=2.0.0.0' "$TV_TEST_LOG"
            ! grep -q -- --standby "$TV_TEST_LOG"
        fi
    done
done
export TV_TEST_TIME="6 08 00"
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

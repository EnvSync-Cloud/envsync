#!/usr/bin/env bash
# Runs on the production host as root. Caller exports the R2 and release variables.
set -euo pipefail

require() {
	local name="$1"
	if [ -z "${!name:-}" ]; then
		echo "Missing required environment variable: ${name}" >&2
		exit 1
	fi
}

require AWS_ACCESS_KEY_ID
require AWS_SECRET_ACCESS_KEY
require R2_ACCOUNT_ID
require R2_BUCKET
require R2_PREFIX
require RELEASE_TAG

export AWS_DEFAULT_REGION=auto
export AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED
export AWS_RESPONSE_CHECKSUM_VALIDATION=WHEN_REQUIRED

log=/tmp/envsync-release-backup.log
rm -f "$log"
if ! envsync-deploy-enterprise backup >"$log" 2>&1; then
	python3 - "$log" <<'PY'
import pathlib, sys
lines = pathlib.Path(sys.argv[1]).read_text(errors="replace").splitlines()
for line in lines[-60:]:
    if "AGE-SECRET-KEY" in line:
        continue
    print(line[:400])
PY
	exit 1
fi

output_dir=$(python3 - <<'PY'
import pathlib, re
text = pathlib.Path("/etc/envsync/deploy.yaml").read_text()
match = re.search(r"(?ms)^backup:\n((?:  .+\n)*)", text)
block = match.group(1) if match else ""
found = re.search(r"(?m)^  output_dir:\s*[\"']?([^\"'\n]+)[\"']?\s*$", block)
print(found.group(1).strip() if found else "/opt/envsync/backups")
PY
)

python3 - "$output_dir" "$R2_BUCKET" "$R2_PREFIX" "$RELEASE_TAG" <<'PY'
import os
import pathlib
import subprocess
import sys

output_dir, bucket, prefix, tag = sys.argv[1:5]
root = pathlib.Path(output_dir)
archives = sorted(root.glob("envsync-backup-*.tar.gz.age"), key=lambda path: path.stat().st_mtime)
if not archives:
    raise SystemExit(f"No encrypted backup archive in {output_dir}")
archive = archives[-1]
stem = archive.name[: -len(".tar.gz.age")]
identity = root / f"{stem}.identity"
manifest = root / f"{stem}.manifest.json"
for path in (archive, identity, manifest):
    if not path.is_file():
        raise SystemExit(f"Backup is missing {path.name}")

def ensure_aws() -> str:
    if subprocess.call(["bash", "-lc", "command -v aws >/dev/null"]) == 0:
        return "aws"
    subprocess.check_call([
        "bash", "-lc",
        "command -v curl >/dev/null && command -v unzip >/dev/null || (apt-get update && apt-get install -y curl unzip)",
    ])
    tmp = pathlib.Path("/tmp/awscliv2-install")
    subprocess.check_call(["rm", "-rf", str(tmp)])
    tmp.mkdir()
    arch = os.uname().machine
    aws_arch = {"x86_64": "x86_64", "aarch64": "aarch64"}.get(arch)
    if not aws_arch:
        raise SystemExit(f"Unsupported architecture {arch}")
    zip_path = tmp / "awscliv2.zip"
    subprocess.check_call([
        "curl", "-fsSL",
        f"https://awscli.amazonaws.com/awscli-exe-linux-{aws_arch}.zip",
        "-o", str(zip_path),
    ])
    subprocess.check_call(["unzip", "-q", str(zip_path), "-d", str(tmp)])
    subprocess.check_call([str(tmp / "aws" / "install"), "-i", "/tmp/aws-cli", "-b", "/tmp/aws-bin"])
    return "/tmp/aws-bin/aws"

aws = ensure_aws()
endpoint = f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
for path in (archive, identity, manifest):
    key = f"{prefix}/{tag}/{path.name}"
    subprocess.check_call([
        aws, "s3", "cp", str(path), f"s3://{bucket}/{key}",
        "--endpoint-url", endpoint,
        "--only-show-errors",
    ])
    print(f"uploaded s3://{bucket}/{key}")
PY

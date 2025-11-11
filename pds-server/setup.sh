#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail

# Secure generator commands
GENERATE_SECURE_SECRET_CMD="openssl rand --hex 16"
GENERATE_K256_PRIVATE_KEY_CMD="openssl ecparam --name secp256k1 --genkey --noout --outform DER | tail --bytes=+8 | head --bytes=32 | xxd --plain --cols 32"

# Default PDS configuration
PDS_DATADIR="./pds-data"
PDS_HOSTNAME="${1:-}"
PDS_ADMIN_EMAIL="${2:-}"
PDS_DID_PLC_URL="https://plc.directory"
PDS_BSKY_APP_VIEW_URL="https://api.bsky.app"
PDS_BSKY_APP_VIEW_DID="did:web:api.bsky.app"
PDS_REPORT_SERVICE_URL="https://mod.bsky.app"
PDS_REPORT_SERVICE_DID="did:plc:ar7c4by46qjdydhdevvrndac"
PDS_CRAWLERS="https://bsky.network"

function usage {
  cat <<USAGE >&2
Usage: bash $0 [HOSTNAME] [ADMIN_EMAIL]

Generate a PDS environment configuration file.

Arguments:
  HOSTNAME      Your public DNS address (e.g. example.com)
  ADMIN_EMAIL   Admin email address (e.g. you@example.com)

Example:
  bash $0 example.com you@example.com

USAGE
  exit 1
}

function main {
  # Prompt for hostname if not provided
  if [[ -z "${PDS_HOSTNAME}" ]]; then
    read -p "Enter your public DNS address (e.g. example.com): " PDS_HOSTNAME
  fi

  if [[ -z "${PDS_HOSTNAME}" ]]; then
    echo "ERROR: No public DNS address specified"
    usage
  fi

  if [[ "${PDS_HOSTNAME}" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "ERROR: Invalid public DNS address (must not be an IP address)"
    usage
  fi

  # Prompt for admin email if not provided
  if [[ -z "${PDS_ADMIN_EMAIL}" ]]; then
    read -p "Enter an admin email address (e.g. you@example.com): " PDS_ADMIN_EMAIL
  fi

  if [[ -z "${PDS_ADMIN_EMAIL}" ]]; then
    echo "ERROR: No admin email specified"
    usage
  fi

  # Create data directory if it doesn't exist
  if ! [[ -d "${PDS_DATADIR}" ]]; then
    echo "* Creating data directory ${PDS_DATADIR}"
    mkdir -p "${PDS_DATADIR}"
  fi

  # Create blocks subdirectory
  if ! [[ -d "${PDS_DATADIR}/blocks" ]]; then
    echo "* Creating blocks directory ${PDS_DATADIR}/blocks"
    mkdir -p "${PDS_DATADIR}/blocks"
  fi

  #
  # Create the PDS env config
  #
  echo "* Generating secure secrets..."
  PDS_ADMIN_PASSWORD=$(eval "${GENERATE_SECURE_SECRET_CMD}")

  echo "* Creating PDS environment file: .env"
  cat <<PDS_CONFIG >".env"
PDS_HOSTNAME=${PDS_HOSTNAME}
PDS_JWT_SECRET=$(eval "${GENERATE_SECURE_SECRET_CMD}")
PDS_ADMIN_PASSWORD=${PDS_ADMIN_PASSWORD}
PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX=$(eval "${GENERATE_K256_PRIVATE_KEY_CMD}")
PDS_DATA_DIRECTORY=${PDS_DATADIR}
PDS_BLOBSTORE_DISK_LOCATION=${PDS_DATADIR}/blocks
PDS_BLOB_UPLOAD_LIMIT=104857600
PDS_DID_PLC_URL=${PDS_DID_PLC_URL}
PDS_BSKY_APP_VIEW_URL=${PDS_BSKY_APP_VIEW_URL}
PDS_BSKY_APP_VIEW_DID=${PDS_BSKY_APP_VIEW_DID}
PDS_REPORT_SERVICE_URL=${PDS_REPORT_SERVICE_URL}
PDS_REPORT_SERVICE_DID=${PDS_REPORT_SERVICE_DID}
PDS_CRAWLERS=${PDS_CRAWLERS}
LOG_ENABLED=true
BIND_HOST=0.0.0.0
PDS_PORT=3000
PDS_INVITE_REQUIRED=false
PDS_CONFIG

  cat <<SUCCESS_MESSAGE
========================================================================
PDS environment configuration created successfully!
------------------------------------------------------------------------

Configuration file: .env
Data directory: ${PDS_DATADIR}
Admin password: ${PDS_ADMIN_PASSWORD}

Next steps:
1. Start the PDS server with: pnpm run pds-server
   (or: ./test-server.sh)
2. Test the server: curl http://localhost:3000/xrpc/_health
3. Check server info: curl http://localhost:3000/xrpc/com.atproto.server.describeServer

Server Configuration:
------------------------------------------------------------------------
Hostname: ${PDS_HOSTNAME}
Port: 3000
Invite codes: DISABLED (open registration)
Data directory: ${PDS_DATADIR}

IMPORTANT: Save your admin password in a secure location!
========================================================================
SUCCESS_MESSAGE

}

# Run main function.
main

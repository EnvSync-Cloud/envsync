#!/bin/bash

# Remove Old files
rm -rf .env
docker compose down --volumes --remove-orphans

# Initialize the environment
bun cli init

# Start Services
bun cli services up

# Run API init
bun cli:init

# The above cmd does not auto exit, so auto exit the script after 10 seconds
sleep 25

echo "Now you can start EnvSync Local: bun run dev"
exit 0
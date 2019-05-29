#!/usr/bin/env bash
set -e
env=${NODE_ENV:-production}
if [[ "$env" = "production" ]]; then
    npm run server
else
    npm run server-dev
fi
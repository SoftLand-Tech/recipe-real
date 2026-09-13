#!/usr/bin/env bash
# RecipeReal backend — run ON the VPS (as root) from /var/www/recipe-real.
# Pulls latest main, reinstalls prod deps, migrates, builds frontend assets,
# re-caches, restarts the queue worker, and health-checks.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
DOMAIN="recipe-real.softland.tech"

# Repo is www-data-owned (so php-fpm/supervisor can write); tell git it's trusted
# when this runs as root.
git config --global --add safe.directory "$ROOT" 2>/dev/null || true

echo "==> git pull origin main"
git pull --ff-only origin main

echo "==> composer install (prod)"
( cd backend && composer install --no-dev --optimize-autoloader --no-interaction )

echo "==> publish Filament panel assets"
( cd backend && php artisan filament:assets )

echo "==> migrate --force"
( cd backend && php artisan migrate --force )

# Frontend first: the Vite manifest (panel theme, landing CSS/JS) must exist
# BEFORE the caches are warmed, otherwise cached views reference assets
# that are not in the manifest yet.
echo "==> frontend build (vite)"
( cd backend && npm ci --no-audit --no-fund && npm run build )

echo "==> warm caches"
( cd backend && php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan event:cache && php artisan filament:cache-components )

echo "==> permissions"
chown -R www-data:www-data "$ROOT"
chmod -R ug+rw backend/storage backend/bootstrap/cache backend/database

echo "==> restart queue worker"
supervisorctl restart recipe-real-queue:* || supervisorctl restart recipe-real-queue

echo "==> health check"
sleep 2
echo -n "landing:    "; curl -s -o /dev/null -w "%{http_code}\n" "https://$DOMAIN/"
echo -n "api/recipes: "; curl -s -o /dev/null -w "%{http_code}\n" -H 'Accept: application/json' "https://$DOMAIN/api/recipes"

echo "==> deploy complete"

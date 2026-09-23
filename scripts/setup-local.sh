#!/usr/bin/env bash
# One-shot local setup for Linux/macOS: checks prerequisites, starts
# PostgreSQL + Redis in Docker, writes .env, installs deps, migrates + seeds.
# Safe to re-run. Usage: ./scripts/setup-local.sh [--with-stripe-mock]
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

with_stripe_mock=0
[[ "${1:-}" == "--with-stripe-mock" ]] && with_stripe_mock=1

say "Checking prerequisites"
command -v node >/dev/null || die "Node.js 20+ is required (https://nodejs.org or nvm)."
node_major=$(node -p 'process.versions.node.split(".")[0]')
(( node_major >= 20 )) || die "Node.js 20+ is required (found $(node -v))."
command -v npm >/dev/null || die "npm is required."
command -v docker >/dev/null || die "Docker is required for PostgreSQL + Redis (or install them yourself; see README)."
docker info >/dev/null 2>&1 || die "Docker is installed but not usable by $(whoami). Start the daemon, or add yourself to the docker group: sudo usermod -aG docker \$USER (then log out and back in)."
if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null; then
  compose=(docker-compose)
else
  die "Docker Compose is required (install the docker-compose-plugin package)."
fi
echo "node $(node -v), $("${compose[@]}" version --short 2>/dev/null || echo compose)"

say "Starting PostgreSQL + Redis"
"${compose[@]}" up -d
printf 'Waiting for PostgreSQL'
for _ in $(seq 1 60); do
  if docker exec findable-pg pg_isready -U postgres >/dev/null 2>&1; then
    echo " ready"; break
  fi
  printf '.'; sleep 1
done
docker exec findable-pg pg_isready -U postgres >/dev/null 2>&1 || die "PostgreSQL did not become ready. Check: ${compose[*]} logs postgres"

say "Writing .env"
if [[ -f .env ]]; then
  echo ".env already exists — leaving it untouched."
else
  cp .env.example .env
  secret=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')
  sed -i.bak "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$secret\"|" .env && rm -f .env.bak
  echo "Created .env with a fresh AUTH_SECRET."
fi

say "Installing dependencies"
npm install

say "Applying migrations and seeding demo data"
npm run setup

if (( with_stripe_mock )); then
  say "Building stripe-mock into .bin/"
  command -v go >/dev/null || die "Go is required to build stripe-mock (or re-run without --with-stripe-mock)."
  GOBIN="$PWD/.bin" go install github.com/stripe/stripe-mock@latest
fi

say "Done"
cat <<'EOF'
Start the app:      npm run dev            → http://localhost:3000
Sign in:            magic links print in the dev-server console
Checkout (optional): .bin/stripe-mock -port 12111   (build with --with-stripe-mock)
Stop databases:     docker compose down
EOF

# Self-hosting openGym

The repository is the deployment bundle. Docker Compose runs the Hono API, the
static web gateway, and the one-time exercise-media download. Node and pnpm are
not required on the server.

## Local smoke test

Install [Docker](https://docs.docker.com/get-docker/) with the Compose plugin,
then run:

```bash
git clone https://github.com/DuarteSantos8/openGym.git opengym
cd opengym
cp .env.example .env
docker compose up -d --build
```

Open <http://localhost:8080>. The first start downloads the exercise media (about
140 MB) into `./media`. Check the containers with:

```bash
docker compose ps
curl http://localhost:8080/api/health
docker compose logs -f
```

The default bind address is `127.0.0.1`, so the local port is not exposed to the
LAN. Set `WEB_BIND_ADDRESS=0.0.0.0` only when you intentionally need that.

## VPS deployment with HTTPS

On a fresh VPS, clone the repository into a stable deployment directory:

```bash
git clone https://github.com/DuarteSantos8/openGym.git /opt/opengym
cd /opt/opengym
cp .env.example .env
```

Use a domain that points to the VPS. Choose it before anyone registers a
passkey: WebAuthn credentials are bound to the exact hostname.

Edit `.env`:

```dotenv
DOMAIN=gym.example.com
RP_ID=gym.example.com
ORIGIN=https://gym.example.com
RP_NAME=openGym
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=8080
```

Then start the production overlay:

```bash
docker compose -f docker-compose.yml -f compose.production.yml up -d --build
```

The overlay runs Caddy on ports 80 and 443. Caddy forwards HTTPS traffic to the
internal `web` service, which serves the frontend and proxies `/api` to Hono.
Create DNS records for `gym.example.com` pointing at the VPS and allow ports 80
and 443 through the firewall.

Once release images are published, the faster update path is:

```bash
docker compose -f docker-compose.yml -f compose.production.yml pull
docker compose -f docker-compose.yml -f compose.production.yml up -d
```

Set `OPENGYM_IMAGE_NAMESPACE` and `OPENGYM_IMAGE_TAG` in `.env` to use a
different registry or a pinned release. If an image is unavailable, keep using
`--build` to build from the checked-out source.

The repository workflow publishes both images for `linux/amd64` and
`linux/arm64` whenever a `v*.*.*` tag is pushed. Make the package visible in
GHCR before asking self-hosters to use the pull-based path.

For invite-only instances, set `INVITE_ONLY=1`. After creating the first
profile, add its id to `ADMIN_UIDS` if you want the admin dashboard.

Passkeys require HTTPS, except for `http://localhost`. Keep `RP_ID` equal to the
hostname in the browser address bar and `ORIGIN` equal to the complete HTTPS URL.
Changing `RP_ID` later invalidates existing passkeys. Each profile has isolated
data; `INVITE_ONLY=1` is the simplest way to keep a public instance closed while
you configure it.

Push notifications and Wake Lock also require HTTPS (or localhost). No server
keys are needed: VAPID keys are generated on first run and saved in `./data`.

## Data and backups

Persistent application data is stored in `./data`; downloaded exercise media is
stored in `./media`. Back up `data` regularly and store the archive somewhere
other than the VPS:

```bash
tar -C /opt/opengym -czf /var/backups/opengym-$(date +%F).tar.gz data
```

The data directory contains sessions, passkeys, and workout history. Protect it
like credentials. Back up `media` too if you want to avoid downloading the
exercise dataset again after a restore.

## Updating

```bash
git pull --ff-only
tar -C /opt/opengym -czf /var/backups/opengym-before-update-$(date +%F).tar.gz data
docker compose -f docker-compose.yml -f compose.production.yml pull
docker compose -f docker-compose.yml -f compose.production.yml up -d
```

For source deployments, replace `pull` with `up -d --build`.

## Troubleshooting

- No passkey prompt usually means the browser is using HTTP, an IP address, or a
  hostname that does not exactly match `RP_ID` and `ORIGIN`.
- `docker compose logs media` shows exercise-media download failures.
- `docker compose logs caddy` shows certificate and DNS errors.
- `docker compose config` validates the merged Compose files before starting.

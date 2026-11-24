# DailyCatch

Private, single-user English study page. A morning job collects the Hacker News front page and the English RSS feeds listed in `.env`, then asks DeepSeek for one medium-short story, or a reported account on news days, plus up to three hot topics grounded in those items. A React page shows the article first. Hot topics sit in a submenu under the date.

There is no application login. Put the site behind nginx basic auth. It is meant to be opened as `http://SERVER_IP:PORT`.

## Layout

- `server/` — Go API and fetch command
- `dailycatch/` — `.env` configuration
- `dailycatch-ui/` — React single page
- `deploy/` — nginx, cron, and systemd examples
- `schema.sql` — applied automatically when the server or `dailycatch fetch` starts

Run Go commands from the `server` directory. The process looks upward from the working directory for `dailycatch/.env` and `schema.sql`.

## Local development (Windows)

Requirements: Go 1.25+, Node.js 18+, and MySQL 8.

### 1. MySQL

Create an empty database and a user that can create tables in it:

```sql
CREATE DATABASE dailycatch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'dailycatch'@'localhost' IDENTIFIED BY 'change-me';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER
  ON dailycatch.* TO 'dailycatch'@'localhost';
FLUSH PRIVILEGES;
```

Docker Desktop is enough when MySQL is not installed. Start Docker, then:

```powershell
docker run -d --name dailycatch-mysql --restart unless-stopped `
  -e MYSQL_ROOT_PASSWORD=change-me `
  -e MYSQL_DATABASE=dailycatch `
  -e MYSQL_USER=dailycatch `
  -e MYSQL_PASSWORD=change-me `
  -p 3306:3306 `
  -v dailycatch-mysql:/var/lib/mysql `
  mysql:8 `
  --character-set-server=utf8mb4 `
  --collation-server=utf8mb4_unicode_ci
```

### 2. Configuration

```powershell
cd dailycatch
Copy-Item .env.example .env
```

Fill in `.env`. Never commit it.

| Variable | Purpose |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek key. Leave empty to store rows without AI fields. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `RSS_FEEDS` | Comma-separated `Name\|url` entries |

The default feeds are BBC World and The Guardian Tech. The fetch keeps 10 Hacker News stories that have a URL, and up to 5 entries per feed from the last 48 hours.

### 3. Fetch

```powershell
cd ..\server
go run ./cmd/dailycatch fetch --no-ai
go run ./cmd/dailycatch fetch
```

`--date YYYY-MM-DD` selects a digest date. The default is today in Asia/Shanghai. `--no-ai` skips DeepSeek and works with no API key.

The run deletes that date's news rows first, then inserts each item in its own transaction. DeepSeek then writes the medium-short piece and hot topics. If the piece is under its word minimum, the same request is sent once more. The article type rotates across IELTS 6.5-7.5, everyday English, technology, and a news brief, and the same date keeps its type when the job is run again. A failed model call keeps the previous lesson. The process prints `stored hackernews=N rss=N lesson=ok|failed|skipped hot_topics=N`. Exit code 0 means at least one news row was stored. Exit code 1 means nothing was stored.

Running the same date again replaces those rows. It does not create duplicates.

### 4. API

```powershell
go run ./cmd/dailycatch
```

The process listens on `127.0.0.1:8000`.

- `GET /api/health` → `{"status":"ok"}`
- `GET /api/dates` → issues newest first, each with `date`, `title`, `article_type`, `difficulty`, and `topic`
- `GET /api/digests/YYYYMMDD` → `date`, `lesson`, `hot_topics`, and `items`, or 404 when that date has none of them. The path has no dashes. The `date` field in the JSON stays `YYYY-MM-DD`.

There is no CORS and no application auth. The API is read-only.

### 5. Web UI

```powershell
cd ..\dailycatch-ui
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The dev server proxies `/api` to `127.0.0.1:8000`. The latest date opens on that piece. Hot topics are listed under that date. Show Translation and Show Vocabulary reveal the Chinese gloss for the article.

## Deploy on a server

These steps assume a Linux host with Go 1.25+, Node.js 18+, MySQL 8, and nginx. The clock should be Asia/Shanghai so the 07:00 schedule matches the digest date.

### 1. Packages and database

```bash
sudo apt update
sudo apt install -y nginx apache2-utils
sudo timedatectl set-timezone Asia/Shanghai
```

Create the database and user with the SQL in the local-development section. Use a real password. Install Go 1.25 or newer before building the server.

### 2. Application

```bash
sudo mkdir -p /opt/dailycatch /var/log/dailycatch
sudo rsync -a --exclude node_modules --exclude dist ./ /opt/dailycatch/
cd /opt/dailycatch/dailycatch
cp .env.example .env
# edit .env: database password and DEEPSEEK_API_KEY
cd /opt/dailycatch/server
go build -o dailycatch ./cmd/dailycatch
/opt/dailycatch/server/dailycatch fetch --no-ai
/opt/dailycatch/server/dailycatch fetch
```

### 3. API service

```bash
sudo cp /opt/dailycatch/deploy/dailycatch-api.service /etc/systemd/system/dailycatch-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now dailycatch-api
curl -s http://127.0.0.1:8000/api/health
```

The unit runs `/opt/dailycatch/server/dailycatch` and listens on `127.0.0.1:8000` only. The app reads `/opt/dailycatch/dailycatch/.env` itself.

### 4. Frontend build

```bash
cd /opt/dailycatch/dailycatch-ui
npm install
npm run build
```

nginx serves `dailycatch-ui/dist`.

### 5. Basic auth and nginx

```bash
sudo htpasswd -c /etc/nginx/.htpasswd-dailycatch reader
sudo cp /opt/dailycatch/deploy/nginx.conf /etc/nginx/sites-available/dailycatch
sudo ln -s /etc/nginx/sites-available/dailycatch /etc/nginx/sites-enabled/dailycatch
sudo nginx -t
sudo systemctl reload nginx
```

`deploy/nginx.conf` listens on port 8080, serves the built page, proxies `/api/` to `127.0.0.1:8000`, and requires the htpasswd user. Change the `listen` port, `root`, or htpasswd path if this host uses different ones. Remove any default site that also binds the public port you chose.

Open `http://SERVER_IP:8080` and sign in with the htpasswd user. Check:

```bash
curl -s -u reader http://127.0.0.1:8080/api/health
curl -s -u reader http://127.0.0.1:8080/api/dates
```

### 6. Morning job

The API process schedules the fetch. At 07:00 Asia/Shanghai it runs the same collection as `dailycatch fetch` and writes MySQL directly. It does not call the HTTP API. If the process starts after 07:00 and today has no lesson yet, it runs once immediately. A later restart the same day does not regenerate an existing lesson. Keep `dailycatch-api` running; the job stops when that process stops.

## Check for non-English source text

From the repository root, excluding dependencies:

```bash
grep -rP "[\x{4e00}-\x{9fff}]" . \
  --exclude-dir=node_modules \
  --exclude-dir=dist
```

The command should print nothing.

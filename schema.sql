CREATE TABLE IF NOT EXISTS articles (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  digest_date    DATE          NOT NULL,
  source_type    VARCHAR(16)   NOT NULL,   -- 'hackernews' | 'rss'
  source_name    VARCHAR(64)   NOT NULL,   -- 'Hacker News', 'BBC World', ...
  title          VARCHAR(512)  NOT NULL,
  url            VARCHAR(1024) NOT NULL,
  url_hash       CHAR(64)      NOT NULL,   -- SHA-256 hex of url
  author         VARCHAR(128)  NULL,
  points         INT           NULL,       -- HN only
  comment_count  INT           NULL,
  published_at   DATETIME      NULL,
  summary        TEXT          NULL,       -- 3-5 simple English sentences
  vocabulary     JSON          NULL,       -- [{"word": "...", "meaning": "..."}]
  comments_digest JSON         NULL,       -- [{"author": "...", "point": "..."}]
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq (digest_date, url_hash),
  KEY idx_date (digest_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lessons (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  digest_date   DATE          NOT NULL,
  article_type  VARCHAR(16)   NOT NULL,
  difficulty    VARCHAR(64)   NOT NULL,
  topic         VARCHAR(64)   NOT NULL,
  title         VARCHAR(256)  NOT NULL,
  body          JSON          NOT NULL,
  translation   JSON          NULL,
  vocabulary    JSON          NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lesson (digest_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hot_topics (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  digest_date   DATE          NOT NULL,
  sort_order    INT           NOT NULL,
  title         VARCHAR(256)  NOT NULL,
  overview      TEXT          NOT NULL,
  quotes        JSON          NULL,
  background    TEXT          NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_hot_date (digest_date, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

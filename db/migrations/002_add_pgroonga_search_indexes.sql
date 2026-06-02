CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_judgments_court_pgroonga
ON judgments USING pgroonga (court);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_judgments_region_pgroonga
ON judgments USING pgroonga (region);

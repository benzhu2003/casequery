CREATE EXTENSION IF NOT EXISTS pgroonga;

CREATE TABLE IF NOT EXISTS judgments (
    id BIGSERIAL PRIMARY KEY,
    source_url TEXT,
    case_no TEXT,
    case_name TEXT,
    court TEXT,
    region TEXT,
    case_type TEXT,
    case_type_code INTEGER,
    source TEXT,
    trial_procedure TEXT,
    judgment_date DATE,
    publish_date DATE,
    parties TEXT,
    cause TEXT,
    legal_basis TEXT,
    full_text TEXT,
    content_hash TEXT UNIQUE,
    import_file TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_runs (
    id BIGSERIAL PRIMARY KEY,
    file_path TEXT NOT NULL,
    inner_file TEXT,
    status TEXT NOT NULL,
    rows_seen BIGINT NOT NULL DEFAULT 0,
    rows_inserted BIGINT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_judgments_case_no ON judgments (case_no);
CREATE INDEX IF NOT EXISTS idx_judgments_court ON judgments (court);
CREATE INDEX IF NOT EXISTS idx_judgments_region ON judgments (region);
CREATE INDEX IF NOT EXISTS idx_judgments_case_type ON judgments (case_type);
CREATE INDEX IF NOT EXISTS idx_judgments_trial_procedure ON judgments (trial_procedure);
CREATE INDEX IF NOT EXISTS idx_judgments_cause ON judgments (cause);
CREATE INDEX IF NOT EXISTS idx_judgments_judgment_date ON judgments (judgment_date);
CREATE INDEX IF NOT EXISTS idx_judgments_publish_date ON judgments (publish_date);

CREATE INDEX IF NOT EXISTS idx_judgments_case_no_pgroonga ON judgments USING pgroonga (case_no);
CREATE INDEX IF NOT EXISTS idx_judgments_case_name_pgroonga ON judgments USING pgroonga (case_name);
CREATE INDEX IF NOT EXISTS idx_judgments_court_pgroonga ON judgments USING pgroonga (court);
CREATE INDEX IF NOT EXISTS idx_judgments_region_pgroonga ON judgments USING pgroonga (region);
CREATE INDEX IF NOT EXISTS idx_judgments_parties_pgroonga ON judgments USING pgroonga (parties);
CREATE INDEX IF NOT EXISTS idx_judgments_cause_pgroonga ON judgments USING pgroonga (cause);
CREATE INDEX IF NOT EXISTS idx_judgments_legal_basis_pgroonga ON judgments USING pgroonga (legal_basis);
CREATE INDEX IF NOT EXISTS idx_judgments_full_text_pgroonga ON judgments USING pgroonga (full_text);

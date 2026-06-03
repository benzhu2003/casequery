import argparse
import csv
import hashlib
import sys
import zipfile
from datetime import date
from io import TextIOWrapper
from pathlib import Path
from typing import Any, Iterable

import psycopg
from psycopg.rows import dict_row

from app.config import get_settings


def set_csv_field_size_limit() -> None:
    limit = sys.maxsize
    while True:
        try:
            csv.field_size_limit(limit)
            return
        except OverflowError:
            limit //= 10


FIELD_MAP = {
    "原始链接": "source_url",
    "案号": "case_no",
    "案件名称": "case_name",
    "法院": "court",
    "所属地区": "region",
    "案件类型": "case_type",
    "案件类型编码": "case_type_code",
    "来源": "source",
    "审理程序": "trial_procedure",
    "裁判日期": "judgment_date",
    "公开日期": "publish_date",
    "当事人": "parties",
    "案由": "cause",
    "法律依据": "legal_basis",
    "全文": "full_text",
}

INSERT_COLUMNS = [
    "source_url",
    "case_no",
    "case_name",
    "court",
    "region",
    "case_type",
    "case_type_code",
    "source",
    "trial_procedure",
    "judgment_date",
    "publish_date",
    "parties",
    "cause",
    "legal_basis",
    "full_text",
    "content_hash",
    "import_file",
]


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def parse_int(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def normalize_row(row: dict[str, str], import_file: str) -> dict[str, Any]:
    normalized = {target: row.get(source) for source, target in FIELD_MAP.items()}
    normalized["case_type_code"] = parse_int(normalized["case_type_code"])
    normalized["judgment_date"] = parse_date(normalized["judgment_date"])
    normalized["publish_date"] = parse_date(normalized["publish_date"])
    normalized["content_hash"] = make_hash(row)
    normalized["import_file"] = import_file
    return normalized


def make_hash(row: dict[str, str]) -> str:
    raw = "|".join(
        [
            row.get("原始链接", ""),
            row.get("案号", ""),
            row.get("案件名称", ""),
            row.get("全文", ""),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()


def insert_batch(conn: psycopg.Connection, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    placeholders = ", ".join(["%s"] * len(INSERT_COLUMNS))
    sql = f"""
        INSERT INTO judgments ({", ".join(INSERT_COLUMNS)})
        VALUES ({placeholders})
        ON CONFLICT (content_hash) DO NOTHING
    """
    values = [[row.get(column) for column in INSERT_COLUMNS] for row in rows]
    with conn.cursor() as cur:
        cur.executemany(sql, values)
        return cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0


def csv_sources(path: Path) -> Iterable[tuple[str, TextIOWrapper]]:
    if path.suffix.lower() == ".zip":
        archive = zipfile.ZipFile(path)
        for name in archive.namelist():
            if name.lower().endswith(".csv"):
                yield name, TextIOWrapper(archive.open(name), encoding="utf-8-sig", errors="replace", newline="")
        archive.close()
    elif path.suffix.lower() == ".csv":
        handle = path.open("rb")
        yield path.name, TextIOWrapper(handle, encoding="utf-8-sig", errors="replace", newline="")


def start_run(conn: psycopg.Connection, file_path: Path, inner_file: str) -> int:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO import_runs (file_path, inner_file, status)
            VALUES (%s, %s, 'running')
            RETURNING id
            """,
            (str(file_path), inner_file),
        )
        return int(cur.fetchone()["id"])


def already_finished(conn: psycopg.Connection, file_path: Path, inner_file: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM import_runs
            WHERE file_path = %s
              AND inner_file = %s
              AND status = 'finished'
            LIMIT 1
            """,
            (str(file_path), inner_file),
        )
        return cur.fetchone() is not None


def finish_run(
    conn: psycopg.Connection,
    run_id: int,
    status: str,
    rows_seen: int,
    rows_inserted: int,
    error_message: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE import_runs
            SET status = %s,
                rows_seen = %s,
                rows_inserted = %s,
                error_message = %s,
                finished_at = now()
            WHERE id = %s
            """,
            (status, rows_seen, rows_inserted, error_message, run_id),
        )


def import_file(conn: psycopg.Connection, path: Path, batch_size: int) -> None:
    for inner_name, text_file in csv_sources(path):
        rows_seen = 0
        rows_inserted = 0
        batch: list[dict[str, Any]] = []
        import_label = f"{path.name}:{inner_name}" if path.suffix.lower() == ".zip" else path.name
        if already_finished(conn, path, inner_name):
            print(f"Skipped {import_label}: already imported")
            text_file.close()
            continue

        run_id = start_run(conn, path, inner_name)
        conn.commit()
        try:
            reader = csv.DictReader(text_file)
            for row in reader:
                rows_seen += 1
                batch.append(normalize_row(row, import_label))
                if len(batch) >= batch_size:
                    rows_inserted += insert_batch(conn, batch)
                    conn.commit()
                    batch.clear()
            if batch:
                rows_inserted += insert_batch(conn, batch)
                conn.commit()
            finish_run(conn, run_id, "finished", rows_seen, rows_inserted)
            conn.commit()
            print(f"Imported {import_label}: seen={rows_seen} inserted={rows_inserted}")
        except Exception as exc:
            conn.rollback()
            finish_run(conn, run_id, "failed", rows_seen, rows_inserted, str(exc))
            conn.commit()
            raise
        finally:
            text_file.close()


def main() -> None:
    set_csv_field_size_limit()
    parser = argparse.ArgumentParser(description="Import judgment CSV files or ZIP archives.")
    parser.add_argument("paths", nargs="+", help="CSV/ZIP files or directories containing them.")
    parser.add_argument("--batch-size", type=int, default=3000)
    args = parser.parse_args()

    files: list[Path] = []
    for item in args.paths:
        path = Path(item)
        if path.is_dir():
            files.extend(sorted(path.glob("*.csv")))
            files.extend(sorted(path.glob("*.zip")))
        else:
            files.append(path)

    with psycopg.connect(get_settings().database_url) as conn:
        for file_path in files:
            import_file(conn, file_path, args.batch_size)


if __name__ == "__main__":
    main()

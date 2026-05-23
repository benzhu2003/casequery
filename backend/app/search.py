from datetime import date
from typing import Any


TEXT_COLUMNS = {
    "all": ["case_name", "case_no", "court", "region", "parties", "cause", "legal_basis", "full_text"],
    "case_name": ["case_name"],
    "case_no": ["case_no"],
    "court": ["court"],
    "region": ["region"],
    "parties": ["parties"],
    "cause": ["cause"],
    "legal_basis": ["legal_basis"],
    "full_text": ["full_text"],
}


def build_search_sql(
    *,
    q: str | None,
    field: str,
    court: str | None,
    region: str | None,
    case_type: str | None,
    trial_procedure: str | None,
    cause: str | None,
    judgment_from: date | None,
    judgment_to: date | None,
    publish_from: date | None,
    publish_to: date | None,
    page: int,
    page_size: int,
) -> tuple[str, list[Any]]:
    where: list[str] = []
    params: list[Any] = []

    if q:
        columns = TEXT_COLUMNS.get(field, TEXT_COLUMNS["all"])
        text_parts = []
        for column in columns:
            params.append(q)
            text_parts.append(f"{column} &@~ %s")
        where.append("(" + " OR ".join(text_parts) + ")")

    filters = [
        ("court = %s", court),
        ("region = %s", region),
        ("case_type = %s", case_type),
        ("trial_procedure = %s", trial_procedure),
        ("cause = %s", cause),
        ("judgment_date >= %s", judgment_from),
        ("judgment_date <= %s", judgment_to),
        ("publish_date >= %s", publish_from),
        ("publish_date <= %s", publish_to),
    ]
    for clause, value in filters:
        if value is not None:
            where.append(clause)
            params.append(value)

    where_sql = " AND ".join(where) if where else "TRUE"
    offset = (page - 1) * page_size

    snippet_sql = "LEFT(full_text, 220)"
    if q:
        params_for_snippet = [q]
        snippet_sql = "array_to_string(pgroonga_snippet_html(COALESCE(full_text, ''), pgroonga_query_extract_keywords(%s), 220), ' ... ')"
    else:
        params_for_snippet = []

    if q:
        sql = f"""
            SELECT
                NULL::bigint AS total,
                id,
                source_url,
                case_no,
                case_name,
                court,
                region,
                case_type,
                trial_procedure,
                judgment_date,
                publish_date,
                parties,
                cause,
                {snippet_sql} AS snippet
            FROM judgments
            WHERE {where_sql}
            LIMIT %s OFFSET %s
        """
        return sql, params_for_snippet + params + [page_size + 1, offset]

    sql = f"""
        WITH matched AS (
            SELECT *
            FROM judgments
            WHERE {where_sql}
        ),
        counted AS (
            SELECT COUNT(*) AS total FROM matched
        )
        SELECT
            counted.total,
            matched.id,
            matched.source_url,
            matched.case_no,
            matched.case_name,
            matched.court,
            matched.region,
            matched.case_type,
            matched.trial_procedure,
            matched.judgment_date,
            matched.publish_date,
            matched.parties,
            matched.cause,
            {snippet_sql} AS snippet
        FROM matched
        CROSS JOIN counted
        ORDER BY matched.judgment_date DESC NULLS LAST, matched.id DESC
        LIMIT %s OFFSET %s
    """
    return sql, params + params_for_snippet + [page_size, offset]

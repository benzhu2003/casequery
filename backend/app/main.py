from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import close_pool, get_conn, open_pool
from app.schemas import JudgmentDetail, SearchResponse
from app.search import TEXT_COLUMNS, build_search_sql


@asynccontextmanager
async def lifespan(_: FastAPI):
    await open_pool()
    yield
    await close_pool()


app = FastAPI(title="CaseQuery", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/search", response_model=SearchResponse)
async def search(
    q: str | None = Query(default=None, max_length=200),
    field: str = Query(default="all"),
    court: str | None = None,
    region: str | None = None,
    case_type: str | None = None,
    trial_procedure: str | None = None,
    cause: str | None = None,
    judgment_from: date | None = None,
    judgment_to: date | None = None,
    publish_from: date | None = None,
    publish_to: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    conn=Depends(get_conn),
) -> SearchResponse:
    if field not in TEXT_COLUMNS:
        raise HTTPException(status_code=400, detail="Unsupported search field")

    q_text = q.strip() if q else None
    has_conditions = any(
        [
            q_text,
            court,
            region,
            case_type,
            trial_procedure,
            cause,
            judgment_from,
            judgment_to,
            publish_from,
            publish_to,
        ]
    )
    if not has_conditions:
        return SearchResponse(total=0, page=page, page_size=page_size, results=[])

    sql, params = build_search_sql(
        q=q_text,
        field=field,
        court=court,
        region=region,
        case_type=case_type,
        trial_procedure=trial_procedure,
        cause=cause,
        judgment_from=judgment_from,
        judgment_to=judgment_to,
        publish_from=publish_from,
        publish_to=publish_to,
        page=page,
        page_size=page_size,
    )
    async with conn.cursor() as cur:
        await cur.execute(sql, params)
        rows = await cur.fetchall()

    is_keyword_search = bool(q_text)
    has_more = False
    total_exact = True
    if is_keyword_search:
        has_more = len(rows) > page_size
        rows = rows[:page_size]
        total = (page - 1) * page_size + len(rows) + (1 if has_more else 0)
        total_exact = False
    else:
        total = int(rows[0][0]) if rows else 0
    results = [
        {
            "id": row[1],
            "source_url": row[2],
            "case_no": row[3],
            "case_name": row[4],
            "court": row[5],
            "region": row[6],
            "case_type": row[7],
            "trial_procedure": row[8],
            "judgment_date": row[9],
            "publish_date": row[10],
            "parties": row[11],
            "cause": row[12],
            "snippet": row[13],
        }
        for row in rows
    ]
    return SearchResponse(total=total, page=page, page_size=page_size, total_exact=total_exact, has_more=has_more, results=results)


@app.get("/api/judgments/{judgment_id}", response_model=JudgmentDetail)
async def judgment_detail(judgment_id: int, conn=Depends(get_conn)) -> JudgmentDetail:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT
                id, source_url, case_no, case_name, court, region, case_type,
                trial_procedure, judgment_date, publish_date, parties, cause,
                LEFT(full_text, 220) AS snippet, case_type_code, source,
                legal_basis, full_text, import_file
            FROM judgments
            WHERE id = %s
            """,
            (judgment_id,),
        )
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Judgment not found")
    return JudgmentDetail(
        id=row[0],
        source_url=row[1],
        case_no=row[2],
        case_name=row[3],
        court=row[4],
        region=row[5],
        case_type=row[6],
        trial_procedure=row[7],
        judgment_date=row[8],
        publish_date=row[9],
        parties=row[10],
        cause=row[11],
        snippet=row[12],
        case_type_code=row[13],
        source=row[14],
        legal_basis=row[15],
        full_text=row[16],
        import_file=row[17],
    )

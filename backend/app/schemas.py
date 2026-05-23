from datetime import date

from pydantic import BaseModel


class SearchResult(BaseModel):
    id: int
    source_url: str | None = None
    case_no: str | None = None
    case_name: str | None = None
    court: str | None = None
    region: str | None = None
    case_type: str | None = None
    trial_procedure: str | None = None
    judgment_date: date | None = None
    publish_date: date | None = None
    parties: str | None = None
    cause: str | None = None
    snippet: str | None = None


class SearchResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_exact: bool = True
    has_more: bool = False
    results: list[SearchResult]


class JudgmentDetail(SearchResult):
    case_type_code: int | None = None
    source: str | None = None
    legal_basis: str | None = None
    full_text: str | None = None
    import_file: str | None = None

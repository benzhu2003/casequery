import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSearch,
  Loader2,
  Search,
  X
} from "lucide-react";
import "./styles.css";

type SearchResult = {
  id: number;
  source_url?: string | null;
  case_no?: string | null;
  case_name?: string | null;
  court?: string | null;
  region?: string | null;
  case_type?: string | null;
  trial_procedure?: string | null;
  judgment_date?: string | null;
  publish_date?: string | null;
  parties?: string | null;
  cause?: string | null;
  snippet?: string | null;
};

type JudgmentDetail = SearchResult & {
  case_type_code?: number | null;
  source?: string | null;
  legal_basis?: string | null;
  full_text?: string | null;
  import_file?: string | null;
};

type SearchResponse = {
  total: number;
  page: number;
  page_size: number;
  total_exact?: boolean;
  has_more?: boolean;
  results: SearchResult[];
};

const fields = [
  ["all", "全部字段"],
  ["case_name", "案件名称"],
  ["case_no", "案号"],
  ["court", "法院"],
  ["region", "所属地区"],
  ["parties", "当事人"],
  ["cause", "案由"],
  ["legal_basis", "法律依据"],
  ["full_text", "全文"]
];

const pageSize = 20;

function cleanParams(params: Record<string, string>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value.trim()) search.set(key, value.trim());
  });
  return search;
}

function fmtDate(value?: string | null) {
  return value || "-";
}

function App() {
  const [query, setQuery] = useState("");
  const [field, setField] = useState("all");
  const [filters, setFilters] = useState({
    court: "",
    region: "",
    case_type: "",
    trial_procedure: "",
    cause: "",
    judgment_from: "",
    judgment_to: "",
    publish_from: "",
    publish_to: ""
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<SearchResponse>({ total: 0, page: 1, page_size: pageSize, results: [] });
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<JudgmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const totalExact = response.total_exact !== false;
  const totalPages = totalExact
    ? Math.max(1, Math.ceil(response.total / pageSize))
    : page + (response.has_more ? 1 : 0);
  const totalLabel = totalExact
    ? `${response.total.toLocaleString()} 条结果`
    : response.has_more
      ? `已显示到第 ${page} 页，仍有更多结果`
      : `约 ${response.total.toLocaleString()} 条结果`;

  async function runSearch(nextPage = 1) {
    const hasConditions = Boolean(
      query.trim() ||
        filters.court.trim() ||
        filters.region.trim() ||
        filters.case_type.trim() ||
        filters.trial_procedure.trim() ||
        filters.cause.trim() ||
        filters.judgment_from ||
        filters.judgment_to ||
        filters.publish_from ||
        filters.publish_to
    );
    if (!hasConditions) {
      setHasSearched(false);
      setResponse({ total: 0, page: 1, page_size: pageSize, results: [] });
      setSelected(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    setPage(nextPage);
    const nextParams = cleanParams({
      q: query,
      field,
      page: String(nextPage),
      page_size: String(pageSize),
      ...filters
    });
    try {
      const res = await fetch(`/api/search?${nextParams.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      setResponse(await res.json());
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: number) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/judgments/${id}`);
      if (!res.ok) throw new Error(await res.text());
      setSelected(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  }

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function resetFilters() {
    setQuery("");
    setField("all");
    setFilters({
      court: "",
      region: "",
      case_type: "",
      trial_procedure: "",
      cause: "",
      judgment_from: "",
      judgment_to: "",
      publish_from: "",
      publish_to: ""
    });
    setPage(1);
    setHasSearched(false);
    setResponse({ total: 0, page: 1, page_size: pageSize, results: [] });
    setSelected(null);
  }

  return (
    <main className="app-shell">
      <section className="search-pane">
        <header className="topbar">
          <div className="brand">
            <FileSearch size={26} aria-hidden="true" />
            <div>
              <h1>CaseQuery</h1>
              <span>裁判文书检索</span>
            </div>
          </div>
          <button className="icon-button" onClick={resetFilters} title="清空条件" aria-label="清空条件">
            <X size={18} />
          </button>
        </header>

        <form
          className="query-row"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch(1);
          }}
        >
          <select value={field} onChange={(event) => setField(event.target.value)} aria-label="搜索字段">
            {fields.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="关键词、案号、当事人、案由" />
          </div>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
            <span>搜索</span>
          </button>
        </form>

        <div className="filters">
          <input value={filters.court} onChange={(event) => updateFilter("court", event.target.value)} placeholder="法院" />
          <input value={filters.region} onChange={(event) => updateFilter("region", event.target.value)} placeholder="所属地区" />
          <input value={filters.case_type} onChange={(event) => updateFilter("case_type", event.target.value)} placeholder="案件类型" />
          <input
            value={filters.trial_procedure}
            onChange={(event) => updateFilter("trial_procedure", event.target.value)}
            placeholder="审理程序"
          />
          <input value={filters.cause} onChange={(event) => updateFilter("cause", event.target.value)} placeholder="案由" />
          <label className="date-filter">
            <CalendarDays size={16} />
            <span>裁判起</span>
            <input
              type="date"
              value={filters.judgment_from}
              onChange={(event) => updateFilter("judgment_from", event.target.value)}
              aria-label="裁判日期起"
            />
          </label>
          <label className="date-filter">
            <CalendarDays size={16} />
            <span>裁判止</span>
            <input
              type="date"
              value={filters.judgment_to}
              onChange={(event) => updateFilter("judgment_to", event.target.value)}
              aria-label="裁判日期止"
            />
          </label>
          <label className="date-filter">
            <CalendarDays size={16} />
            <span>公开起</span>
            <input
              type="date"
              value={filters.publish_from}
              onChange={(event) => updateFilter("publish_from", event.target.value)}
              aria-label="公开日期起"
            />
          </label>
          <label className="date-filter">
            <CalendarDays size={16} />
            <span>公开止</span>
            <input
              type="date"
              value={filters.publish_to}
              onChange={(event) => updateFilter("publish_to", event.target.value)}
              aria-label="公开日期止"
            />
          </label>
        </div>

        {error && <div className="error-line">{error}</div>}

        <div className="result-meta">
          <span>{totalLabel}</span>
          <div className="inline-pager">
            <span>
              第 {page} / {totalPages} 页
            </span>
            <button className="icon-button pager-button" disabled={page <= 1 || loading} onClick={() => runSearch(page - 1)} title="上一页" aria-label="上一页">
              <ChevronLeft size={16} />
            </button>
            <button
              className="icon-button pager-button"
              disabled={page >= totalPages || loading}
              onClick={() => runSearch(page + 1)}
              title="下一页"
              aria-label="下一页"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <section className="results">
          {loading && response.results.length === 0 ? (
            <div className="empty-state">加载中</div>
          ) : response.results.length === 0 ? (
            <div className="empty-state">{hasSearched ? "暂无结果" : "请输入关键词或筛选条件"}</div>
          ) : (
            response.results.map((item) => (
              <article
                className={`result-item ${selected?.id === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => openDetail(item.id)}
              >
                <div className="result-title">{item.case_name || item.case_no || `文书 ${item.id}`}</div>
                <div className="result-tags">
                  <span>{item.case_no || "-"}</span>
                  <span>{item.court || "-"}</span>
                  <span>{item.case_type || "-"}</span>
                  <span>{fmtDate(item.judgment_date)}</span>
                </div>
                <Snippet html={Boolean(query.trim())} value={item.snippet || ""} />
              </article>
            ))
          )}
        </section>

      </section>

      <aside className="detail-pane">
        {detailLoading ? (
          <div className="empty-state">加载中</div>
        ) : selected ? (
          <JudgmentView judgment={selected} />
        ) : (
          <div className="detail-placeholder">
            <FileSearch size={38} />
            <span>选择一条文书</span>
          </div>
        )}
      </aside>
    </main>
  );
}

function JudgmentView({ judgment }: { judgment: JudgmentDetail }) {
  const meta = [
    ["案号", judgment.case_no],
    ["法院", judgment.court],
    ["所属地区", judgment.region],
    ["案件类型", judgment.case_type],
    ["审理程序", judgment.trial_procedure],
    ["裁判日期", judgment.judgment_date],
    ["公开日期", judgment.publish_date],
    ["当事人", judgment.parties],
    ["案由", judgment.cause],
    ["来源", judgment.source],
    ["导入文件", judgment.import_file]
  ];

  return (
    <div className="judgment-view">
      <div className="detail-head">
        <h2>{judgment.case_name || judgment.case_no || `文书 ${judgment.id}`}</h2>
        {judgment.source_url && (
          <a className="icon-button" href={judgment.source_url} target="_blank" rel="noreferrer" title="打开原始链接" aria-label="打开原始链接">
            <ExternalLink size={18} />
          </a>
        )}
      </div>
      <dl className="meta-grid">
        {meta.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value || "-"}</dd>
          </React.Fragment>
        ))}
      </dl>
      <section className="text-section">
        <h3>法律依据</h3>
        <p>{judgment.legal_basis || "-"}</p>
      </section>
      <section className="text-section fulltext">
        <h3>全文</h3>
        <p>{judgment.full_text || "-"}</p>
      </section>
    </div>
  );
}

function Snippet({ html, value }: { html: boolean; value: string }) {
  if (html) {
    return <p className="snippet" dangerouslySetInnerHTML={{ __html: value }} />;
  }
  return <p className="snippet">{value}</p>;
}

createRoot(document.getElementById("root")!).render(<App />);

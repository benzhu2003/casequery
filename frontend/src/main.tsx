import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSearch,
  Info,
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
  results: SearchResult[];
};

type DocumentLine = {
  text: string;
  kind: "court" | "docType" | "caseNo" | "section" | "party" | "signature" | "body";
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
  const [selected, setSelected] = useState<JudgmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(response.total / pageSize));

  async function runSearch(nextPage = 1) {
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

  useEffect(() => {
    runSearch(1);
  }, []);

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
          <label>
            <CalendarDays size={16} />
            <input
              type="date"
              value={filters.judgment_from}
              onChange={(event) => updateFilter("judgment_from", event.target.value)}
              aria-label="裁判日期起"
            />
          </label>
          <label>
            <CalendarDays size={16} />
            <input
              type="date"
              value={filters.judgment_to}
              onChange={(event) => updateFilter("judgment_to", event.target.value)}
              aria-label="裁判日期止"
            />
          </label>
        </div>

        {error && <div className="error-line">{error}</div>}

        <div className="result-meta">
          <span>{response.total.toLocaleString()} 条结果</span>
          <span>
            第 {page} / {totalPages} 页
          </span>
        </div>

        <section className="results">
          {loading && response.results.length === 0 ? (
            <div className="empty-state">加载中</div>
          ) : response.results.length === 0 ? (
            <div className="empty-state">暂无结果</div>
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

        <footer className="pager">
          <button className="icon-button" disabled={page <= 1 || loading} onClick={() => runSearch(page - 1)} title="上一页" aria-label="上一页">
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            disabled={page >= totalPages || loading}
            onClick={() => runSearch(page + 1)}
            title="下一页"
            aria-label="下一页"
          >
            <ChevronRight size={18} />
          </button>
        </footer>
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
  const lines = formatJudgmentText(judgment.full_text || "", judgment);

  return (
    <div className="judgment-view">
      <div className="document-toolbar">
        <div className="document-heading">
          <BookOpen size={22} aria-hidden="true" />
          <div>
            <h2>{judgment.case_name || judgment.case_no || `文书 ${judgment.id}`}</h2>
            <div className="document-chips">
              <span>{judgment.case_no || "无案号"}</span>
              <span>{judgment.court || "未知法院"}</span>
              <span>{judgment.cause || "未知案由"}</span>
              <span>{fmtDate(judgment.judgment_date)}</span>
            </div>
          </div>
        </div>
        {judgment.source_url && (
          <a className="icon-button" href={judgment.source_url} target="_blank" rel="noreferrer" title="打开原始链接" aria-label="打开原始链接">
            <ExternalLink size={18} />
          </a>
        )}
      </div>

      <article className="document-paper" key={judgment.id}>
        {lines.map((line, index) => (
          <p className={`doc-line ${line.kind}`} key={`${line.kind}-${index}`}>
            {line.text}
          </p>
        ))}

        <details className="document-extra">
          <summary>
            <Info size={16} />
            <span>文书信息</span>
          </summary>
          <dl className="meta-grid compact">
            {meta.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value || "-"}</dd>
              </React.Fragment>
            ))}
          </dl>
        </details>

        {judgment.legal_basis && (
          <details className="document-extra">
            <summary>
              <Info size={16} />
              <span>法律依据</span>
            </summary>
            <p className="legal-basis">{judgment.legal_basis}</p>
          </details>
        )}
      </article>
    </div>
  );
}

function formatJudgmentText(text: string, judgment: JudgmentDetail): DocumentLine[] {
  const normalized = normalizeDocumentText(text);
  if (!normalized) {
    return [{ text: "暂无全文", kind: "body" }];
  }
  const rawLines = splitDocumentLines(normalized);
  const lines = rawLines.map((line) => ({ text: line, kind: classifyLine(line) }));

  if (judgment.court && !lines.some((line) => line.kind === "court")) {
    lines.unshift({ text: judgment.court, kind: "court" });
  }
  if (judgment.case_no && !lines.some((line) => line.kind === "caseNo")) {
    const insertAt = lines[0]?.kind === "court" ? 1 : 0;
    lines.splice(insertAt, 0, { text: judgment.case_no, kind: "caseNo" });
  }
  return lines;
}

function normalizeDocumentText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\u3000{2,}/g, "\u3000")
    .trim();
}

function splitDocumentLines(text: string) {
  let formatted = text;
  formatted = formatted.replace(/([\u4e00-\u9fa5]{2,50}人民法院)(民\s*事\s*判\s*决\s*书|民\s*事\s*裁\s*定\s*书|刑\s*事\s*判\s*决\s*书|刑\s*事\s*裁\s*定\s*书|行\s*政\s*判\s*决\s*书|行\s*政\s*裁\s*定\s*书|执\s*行\s*裁\s*定\s*书|民\s*事\s*调\s*解\s*书)/g, "$1\n$2");
  formatted = formatted.replace(/(判\s*决\s*书|裁\s*定\s*书|调\s*解\s*书|决\s*定\s*书)(（[^）]{4,90}号)/g, "$1\n$2");
  formatted = formatted.replace(/(本院认为|经审理查明|本院查明|经查明|经查|另查明|综上|依照|判决如下|裁定如下|调解如下|决定如下)/g, "\n$1");
  formatted = formatted.replace(/(原告|被告|上诉人|被上诉人|申请人|被申请人|第三人|委托代理人|法定代表人)([^，。；\n]{0,50}[，。：])/g, "\n$1$2");
  formatted = formatted.replace(/(审判长|审判员|代理审判员|人民陪审员|书记员|二[〇零一二三四五六七八九十]{2,}年|[0-9]{4}年)/g, "\n$1");

  return formatted
    .split(/\n+/)
    .flatMap((line) => splitLongLine(line.trim()))
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitLongLine(line: string) {
  if (line.length <= 150 || isHeadingLike(line)) {
    return [line];
  }
  const parts = line.split(/(?<=。)/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return [line];
  }
  const chunks: string[] = [];
  let current = "";
  parts.forEach((part) => {
    if ((current + part).length > 150 && current) {
      chunks.push(current);
      current = part;
    } else {
      current += part;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

function classifyLine(line: string): DocumentLine["kind"] {
  const compact = line.replace(/\s/g, "");
  if (/人民法院$/.test(compact) && compact.length <= 50) return "court";
  if (/(判决书|裁定书|调解书|决定书)$/.test(compact) && compact.length <= 24) return "docType";
  if (/^（[^）]{4,90}号$/.test(compact) || /^\([^)]{4,90}号$/.test(compact)) return "caseNo";
  if (/^(本院认为|经审理查明|本院查明|经查明|经查|另查明|综上|依照|判决如下|裁定如下|调解如下|决定如下)/.test(line)) return "section";
  if (/^(原告|被告|上诉人|被上诉人|申请人|被申请人|第三人|委托代理人|法定代表人)/.test(line)) return "party";
  if (/^(审判长|审判员|代理审判员|人民陪审员|书记员|二[〇零一二三四五六七八九十]{2,}年|[0-9]{4}年)/.test(line)) return "signature";
  return "body";
}

function isHeadingLike(line: string) {
  return classifyLine(line) !== "body";
}

function Snippet({ html, value }: { html: boolean; value: string }) {
  if (html) {
    return <p className="snippet" dangerouslySetInnerHTML={{ __html: value }} />;
  }
  return <p className="snippet">{value}</p>;
}

createRoot(document.getElementById("root")!).render(<App />);

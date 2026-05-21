# CaseQuery

本项目用于把大批量裁判文书 CSV/ZIP 数据导入 PostgreSQL，并通过网页按字段和全文检索。

## 技术栈

- PostgreSQL 16 + PGroonga：结构化字段存储和中文全文搜索
- FastAPI：搜索 API、详情 API、导入脚本运行环境
- React + Vite：检索页面和详情阅读
- Nginx：统一入口和反向代理
- Docker Compose：本地和 VPS 部署

## 快速启动

复制环境变量：

```bash
cp .env.example .env
```

编辑 `.env`，至少修改 `POSTGRES_PASSWORD`。

启动服务：

```bash
docker compose up -d --build
```

访问：

```text
http://localhost:8080
```

健康检查：

```bash
curl http://localhost:8080/api/health
```

## 导入数据

把 `.zip` 或 `.csv` 文件放进：

```text
data/zips/
```

执行导入：

```bash
docker compose run --rm backend python -m app.importer /data/zips
```

也可以导入单个文件：

```bash
docker compose run --rm backend python -m app.importer /data/zips/2012年01月裁判文书数据.zip
```

导入完成后建议执行统计信息更新：

```bash
docker compose exec db psql -U casequery -d casequery -c "VACUUM ANALYZE judgments;"
```

## CSV 字段

当前导入脚本按以下中文表头映射：

- `原始链接`
- `案号`
- `案件名称`
- `法院`
- `所属地区`
- `案件类型`
- `案件类型编码`
- `来源`
- `审理程序`
- `裁判日期`
- `公开日期`
- `当事人`
- `案由`
- `法律依据`
- `全文`

如果后续 CSV 表头有变化，只需要调整 [backend/app/importer.py](backend/app/importer.py) 里的 `FIELD_MAP`。

## 搜索接口

```text
GET /api/search
```

常用参数：

- `q`：关键词
- `field`：`all`、`case_name`、`case_no`、`court`、`region`、`parties`、`cause`、`legal_basis`、`full_text`
- `court`
- `region`
- `case_type`
- `trial_procedure`
- `cause`
- `judgment_from`
- `judgment_to`
- `publish_from`
- `publish_to`
- `page`
- `page_size`

详情接口：

```text
GET /api/judgments/{id}
```

## VPS 部署建议

推荐配置：

- 4 核以上 CPU
- 16GB 以上内存
- 500GB 到 1TB SSD
- Ubuntu 22.04/24.04 LTS

部署步骤：

1. 安装 Docker 和 Docker Compose
2. 上传项目代码
3. 上传原始 ZIP 到 `data/zips/`
4. 修改 `.env`
5. 执行 `docker compose up -d --build`
6. 执行导入命令
7. 域名解析到 VPS
8. 用 Nginx 或 Caddy 在宿主机层配置 HTTPS

生产环境建议不要把数据库端口暴露到公网。本项目默认 PostgreSQL 只在 Compose 内部网络使用。

## 备份

逻辑备份：

```bash
docker compose exec db pg_dump -U casequery -Fc casequery > backup.dump
```

恢复：

```bash
docker compose exec -T db pg_restore -U casequery -d casequery --clean --if-exists < backup.dump
```

数据很大时，更推荐配合 VPS 磁盘快照。

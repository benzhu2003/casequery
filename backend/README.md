# Backend

本服务提供搜索和详情接口，导入脚本也运行在同一个镜像内。

本地开发：

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

导入：

```bash
python -m app.importer /data/zips
```

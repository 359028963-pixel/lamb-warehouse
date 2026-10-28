# 羊肉仓库管理系统

本地 Web 应用：记录每天羊肉入库/出库公斤数，查看当前库存，以及日/周/月/年统计。

## 快速开始

```bash
cd /workspace/lamb-warehouse
npm install
npm run dev
```

- 前端：http://localhost:5173
- API：http://localhost:3847

## 默认账号

- 用户名：`admin`
- 密码：`admin123`

（首次运行会自动写入数据库，密码经 bcrypt 哈希存储）

## 功能

- 登录 / 退出
- 入库、出库登记（出库不可使库存为负）
- 当前库存 = 累计入库 − 累计出库（SQLite 持久化）
- 今日 / 近7天 / 本月 / 本年统计

## 生产启动

```bash
npm run build
npm start
```

生产模式下由 Express 在 3847 端口同时提供 API 与静态前端。

## 说明

- 数据库文件：`server/data/warehouse.db`（SQLite，重启不丢数据）
- 密码哈希：`bcryptjs`（与 bcrypt 兼容的纯 JS 实现）
- 若 `better-sqlite3` 原生模块未编译，在 `server/` 下执行：
  `npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3`

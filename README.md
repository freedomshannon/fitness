# 王德廷的减肥追踪网站

这是一个简单的个人减肥追踪网站，专为王德廷设计。使用HTML、CSS和JavaScript实现，具有手绘风格的UI设计，数据通过 Cloudflare KV 存储。

## 功能

- **数据记录**：记录每日体重、运动和饮食信息
- **数据可视化**：通过折线图展示体重变化趋势
- **数据分析**：自动计算并显示体重变化情况
- **历史记录**：按时间倒序显示所有历史记录
- **云存储**：数据保存在 Cloudflare KV 中，在不同设备间同步

## 技术栈

- HTML5
- CSS3 (手绘草图风格设计)
- JavaScript (原生)
- Chart.js (用于图表绘制)
- Cloudflare Workers 和 KV 存储 (数据存储)
- Cloudflare Pages (静态网站托管)
- localStorage (作为离线备份)

## 部署方法

这个项目使用两部分分离部署：
1. 静态网站文件部署在 Cloudflare Pages
2. 数据API部署在 Cloudflare Worker

### 1. 部署数据 API (Worker)

首先安装 Wrangler CLI:

```bash
npm install -g wrangler
wrangler login
```

创建 KV 命名空间:

```bash
wrangler kv:namespace create "WEIGHT_TRACKER"
```

将获取的 KV 命名空间 ID 更新到 wrangler.toml 文件中。

然后部署 Worker:

```bash
wrangler deploy
```

部署成功后，你会获得一个 Worker URL，如 `https://weight-tracker-api.your-username.workers.dev`。

### 2. 更新前端配置

在 `script.js` 文件中，找到并替换 API_URL:

```javascript
const API_URL = 'https://weight-tracker-api.your-username.workers.dev/api/weight-data';
```

将其更改为你实际部署的 Worker URL。

### 3. 部署静态网站 (Pages)

登录 Cloudflare 控制面板，选择 Pages，然后:

1. 点击"创建项目"
2. 选择"直接上传"
3. 拖拽以下文件到上传区域:
   - index.html
   - styles.css
   - script.js (确保已更新 API_URL)
4. 点击"部署站点"

部署成功后，你会获得一个 Pages URL，如 `https://weight-tracker.pages.dev`。

## 本地开发

如果要在本地开发:

1. 克隆仓库到本地
2. 修改 script.js 中的 API_URL 指向本地 Worker
3. 在本地运行 Worker: `wrangler dev`
4. 用本地服务器启动前端: `npx http-server .`

## 数据存储说明

- 所有数据存储在 Cloudflare KV 中，可以在不同设备间同步
- 同时在浏览器的 localStorage 中保存备份，以防网络不可用
- 如需手动备份数据，可以在 Cloudflare Dashboard 中导出 KV 数据

## 注意事项

- 首次使用需要有网络连接，后续在无网络情况下也可使用（数据会保存在本地）
- 如果使用多设备，建议在一个设备上完成数据修改后再换到其他设备，避免数据覆盖 
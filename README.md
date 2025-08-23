# TOTP Token Manager

🔐 一个现代化的 TOTP（时间基一次性密码）令牌管理器，支持多设备同步和备份功能。

## ✨ 主要特性

- 🛡️ **安全可靠**: 采用 JWT 认证和 PBKDF2 密码加密
- 📱 **响应式设计**: 完美适配桌面端和移动端
- ☁️ **云端同步**: 通过 GitHub Gist 实现数据同步和备份
- 📷 **二维码支持**: 支持导入/导出 TOTP 二维码
- 🚀 **简单部署**: 支持多种 Node.js 平台一键部署
- ⚡ **实时更新**: 30秒倒计时，自动令牌刷新
- 🔄 **批量导入**: 支持 Google Authenticator 迁移格式

## 🏗️ 项目架构

```
totptokenmanagerbypages/
├── api/                           # 后端 API (Node.js)
│   ├── index.js                   # Express 服务器
│   ├── package.json               # 依赖配置
│   ├── vercel.json                # Vercel 配置
│   ├── railway.json               # Railway 配置
│   └── Dockerfile                 # Docker 配置
├── totp-manager-frontend/         # 前端应用 (React)
│   ├── src/
│   │   ├── App.js                # 主应用组件
│   │   ├── config.js             # 配置文件
│   │   └── services/api.js       # API 服务
│   ├── _headers                   # Cloudflare Pages 头部配置
│   ├── _redirects                 # Cloudflare Pages 重定向配置
│   └── package.json
├── functions/                     # Cloudflare Pages Functions
│   └── api/[[route]].js           # 后端 API 入口
├── package.json                   # 根目录构建配置
└── deploy-nodejs.js               # 一键部署脚本
```

## 🚀 快速开始

## 🎆 一键部署 - Cloudflare Pages（推荐）

### 为什么选择 Cloudflare Pages？
- ☁️ **统一平台**：前后端都在同一域名下
- 🚀 **零配置**：自动检测并部署
- 🌍 **全球 CDN**：超快访问速度
- 💰 **完全免费**：无限带宽和请求
- 🔗 **GitHub 集成**：推送代码自动部署

```bash
# 克隆项目
git clone <repository-url>
cd totptokenmanagerbypages

# 运行部署脚本（自动使用 Cloudflare Pages）
node deploy-nodejs.js
```

### 📋 部署步骤（全栈统一）

#### 1. 推送代码到 GitHub
```bash
git clone <your-repo-url>
cd totptokenmanagerbypages
git push origin main
```

#### 2. 创建 Cloudflare Pages 项目
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择 "Pages" → "Create a project"
3. 连接您的 GitHub 仓库
4. 选择项目仓库

#### 3. 构建设置
```
Framework: Create React App
Build command: cd totp-manager-frontend && npm ci && npm run build
Build output: totp-manager-frontend/build
Root directory: (留空)
```

#### 4. 环境变量配置
在 "Settings" → "Environment variables" 中添加：
```
NODE_VERSION=18
JWT_SECRET=your-super-secret-jwt-key
# 以下可选（GitHub OAuth）
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

#### 5. 部署完成！
- 前端和后端 API 都在同一个域名下
- 自动 HTTPS 证书
- 全球 CDN 加速
- 无限免费使用

✨ **无需复杂的 wrangler 配置，一次部署，即可使用！**

### 备选部署平台

### 本地开发

**后端 API**
```bash
cd api
npm install
npm start
# 访问: http://localhost:8080
```

**前端应用**
```bash
cd totp-manager-frontend
npm install
npm start
# 访问: http://localhost:3000
```

### 生产部署

## 🌟 支持的部署平台

### 🎆 首选平台 - Cloudflare Pages
- ☁️ **统一平台**：前后端同域名部署
- 🚀 **零配置**：推送代码即部署
- 💰 **完全免费**：无限制带宽和请求
- 🌍 **全球 CDN**：超快访问速度

### 🔄 备选平台（前后端分离）
- ✅ **Vercel** - 零配置，全球 CDN
- ✅ **Railway** - 内置数据库，优秀体验
- ✅ **Netlify** - 函数 + 静态站点
- ✅ **Render** - 免费 PostgreSQL

### 🔧 其他平台
- 🐳 **Docker** - 容器化部署
- ☁️ **任意 VPS** - 完全控制

## 🎆 方案一：Cloudflare Pages 一键部署（推荐）

### 为什么选择 Cloudflare Pages？
- ☁️ **统一平台**：前后端都在同一域名下，无跨域问题
- 🚀 **零配置**：自动检测并部署，无需复杂设置
- 🌍 **全球 CDN**：超快访问速度，覆盖全球
- 💰 **完全免费**：无限制带宽和请求数
- 🔗 **GitHub 集成**：推送代码自动部署
- 🔍 **Functions 支持**：原生支持 Node.js 后端

### 部署步骤

#### 1. 推送代码到 GitHub
```bash
git clone <your-repo-url>
cd totptokenmanagerbypages
git push origin main
```

#### 2. 创建 Cloudflare Pages 项目
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择 "Pages" → "Create a project"
3. 连接您的 GitHub 仓库
4. 选择项目仓库

#### 3. 构建设置（使用默认值）
```
Framework: None
Build command: npm run build
Build output: totp-manager-frontend/build
Root directory: (留空)
```

#### 4. 环境变量配置
在 "Settings" → "Environment variables" 中添加：
```
NODE_VERSION=18
JWT_SECRET=your-super-secret-jwt-key-here
GITHUB_CLIENT_ID=your-github-client-id (可选)
GITHUB_CLIENT_SECRET=your-github-client-secret (可选)
GITHUB_REDIRECT_URI=https://your-pages-domain.pages.dev/api/github/callback
FRONTEND_URL=https://your-pages-domain.pages.dev
REACT_APP_API_BASE_URL=https://your-pages-domain.pages.dev
REACT_APP_GITHUB_AUTH_URL=https://your-pages-domain.pages.dev/api/github/auth
```

#### 5. 部署完成！
- 前端和后端都在同一个域名下
- 自动 HTTPS 证书
- 全球 CDN 加速
- 无限免费使用

## 🔄 方案二：Vercel + Cloudflare Pages（分离部署）

### 为什么选择 Vercel？
- ✨ **零配置**：自动检测 Node.js 项目
- 🚀 **全球 CDN**：自带边缘网络
- 💰 **免费额度**：每月 100GB 带宽
- 🔗 **GitHub 集成**：推送代码自动部署

### 部署步骤

#### 1. 准备代码
```bash
# 克隆项目
git clone <your-repo-url>
cd totptokenmanagerbypages

# 确保 Node.js 后端代码完整
cd api
npm install
```

#### 2. 部署后端到 Vercel

**方式一：网页部署（最简单）**
1. 访问 [vercel.com](https://vercel.com)
2. 用 GitHub 账户登录
3. 点击 "New Project"
4. 选择包含项目的仓库
5. 设置配置：
   ```
   Framework Preset: Other
   Root Directory: api
   Build Command: npm install
   Output Directory: (留空)
   Install Command: npm install
   ```
6. 环境变量设置：
   ```
   JWT_SECRET=your-super-secret-jwt-key-here
   GITHUB_CLIENT_ID=your-github-client-id (可选)
   GITHUB_CLIENT_SECRET=your-github-client-secret (可选)
   GITHUB_REDIRECT_URI=https://your-app.vercel.app/api/github/callback (可选)
   FRONTEND_URL=https://your-frontend.pages.dev
   ```
7. 点击 "Deploy"

**方式二：命令行部署**
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 在 api 目录下部署
cd api
vercel

# 设置环境变量
vercel env add JWT_SECRET
vercel env add GITHUB_CLIENT_ID
vercel env add GITHUB_CLIENT_SECRET
vercel env add GITHUB_REDIRECT_URI
vercel env add FRONTEND_URL

# 重新部署
vercel --prod
```

#### 3. 部署前端到 Cloudflare Pages

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择 "Pages" → "Create a project"
3. 连接 GitHub 仓库
4. 配置构建设置：
   ```
   Framework: Create React App
   Build command: cd totp-manager-frontend && npm run build
   Build output: totp-manager-frontend/build
   Root directory: (留空)
   ```
5. 环境变量：
   ```
   REACT_APP_API_BASE_URL=https://your-api.vercel.app
   REACT_APP_GITHUB_AUTH_URL=https://your-api.vercel.app/api/github/auth
   NODE_VERSION=18
   ```
6. 部署完成！

## 🚀 方案二：Railway 一键部署

### Railway 的优势
- 🎯 **专为开发者设计**：简单直观
- 🗄️ **内置数据库**：PostgreSQL 支持
- 🔄 **自动 CI/CD**：推送即部署
- 💰 **免费额度**：$5/月免费使用

### 部署步骤

#### 1. 部署后端
1. 访问 [railway.app](https://railway.app)
2. 用 GitHub 登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择您的仓库
5. 选择 `api` 目录
6. Railway 会自动检测并部署

#### 2. 配置环境变量
在 Railway 项目设置中添加：
```
JWT_SECRET=your-super-secret-jwt-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=https://your-app.up.railway.app/api/github/callback
FRONTEND_URL=https://your-frontend.pages.dev
PORT=8080
```

#### 3. 获取域名
Railway 会自动分配域名，格式：`https://your-app.up.railway.app`

## 🚀 方案三：Docker 容器化部署

### 适用场景
- 🏢 企业内部部署
- 🖥️ 自有服务器
- ☁️ 云服务器 (AWS, GCP, Azure)

### 部署步骤

#### 1. 构建镜像
```bash
cd api
docker build -t totp-manager-api .
```

#### 2. 运行容器
```bash
docker run -d \
  --name totp-manager-api \
  -p 8080:8080 \
  -e JWT_SECRET=your-secret \
  -e FRONTEND_URL=https://your-frontend.com \
  -v $(pwd)/data:/app/data \
  totp-manager-api
```

#### 3. 使用 docker-compose
```yaml
version: '3.8'
services:
  api:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      - JWT_SECRET=your-super-secret-key
      - FRONTEND_URL=https://your-frontend.com
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

## 📊 平台对比

| 平台 | 免费额度 | 数据库 | 自定义域名 | 难度 |
|------|----------|---------|-------------|------|
| **Vercel** | 100GB/月 | 需要外部 | ✅ | ⭐ |
| **Railway** | $5/月 | PostgreSQL | ✅ | ⭐⭐ |
| **Netlify** | 100GB/月 | 需要外部 | ✅ | ⭐⭐ |
| **Render** | 750小时/月 | PostgreSQL | ✅ | ⭐⭐⭐ |

## 🛠️ 技术栈

### 前端
- **React 18** - 现代化 React 框架
- **Ant Design** - 企业级 UI 组件库
- **Axios** - HTTP 客户端
- **QRCode.react** - 二维码生成
- **jsQR** - 二维码识别

### 后端
- **Express.js** - Web 框架
- **SQLite** - 轻量级数据库
- **bcryptjs** - 密码加密
- **otplib** - TOTP 算法实现
- **jsonwebtoken** - JWT 处理

## 🔒 安全特性

- **密码安全**: PBKDF2 + SHA-256，100,000 次迭代
- **会话管理**: JWT 令牌，1小时过期时间
- **数据隔离**: 基于用户的数据分离
- **CORS 保护**: 跨域请求安全控制
- **令牌黑名单**: 登出时令牌失效机制

## 🛠️ 快速部署脚本

使用一键部署脚本：
```bash
node deploy-nodejs.js
```

该脚本支持：
- ✅ **环境检查**: 自动检测必需工具
- ✅ **平台选择**: 交互式选择部署平台
- ✅ **自动部署**: Vercel 一键部署
- ✅ **Docker 构建**: 本地构建镜像
- ✅ **部署指南**: 显示详细部署说明

### 必需变量
```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

### GitHub 同步功能（可选）
```bash
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
GITHUB_REDIRECT_URI=https://your-api-domain.com/api/github/callback
```

### 其他配置
```bash
PORT=8080
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
```

## 🛠️ 故障排除

### 常见问题

1. **数据库错误**
   ```bash
   # 确保数据目录权限正确
   chmod 755 data/
   ```

2. **环境变量未生效**
   ```bash
   # 检查环境变量设置
   echo $JWT_SECRET
   ```

3. **CORS 错误**
   - 检查 `FRONTEND_URL` 环境变量
   - 确保前端域名正确

4. **GitHub OAuth 失败**
   - 验证 GitHub OAuth 应用配置
   - 检查回调 URL 设置

### 调试命令

```bash
# 本地运行后端
cd api
npm install
npm start

# 检查健康状态
curl http://localhost:8080/api/health
```

## 🎉 部署完成检查清单

- [ ] ✅ 后端 API 已部署并可访问
- [ ] ✅ 前端应用已部署到 Cloudflare Pages
- [ ] ✅ 环境变量正确配置
- [ ] ✅ API 端点在前端配置中正确设置
- [ ] ✅ 用户注册登录功能正常
- [ ] ✅ TOTP 添加和生成功能正常
- [ ] ✅ 二维码导入导出功能正常
- [ ] ✅ GitHub 同步功能正常（如已配置）

- **密码安全**: PBKDF2 + SHA-256，100,000 次迭代
- **会话管理**: JWT 令牌，1小时过期时间
- **数据隔离**: 基于用户的数据分离
- **CORS 保护**: 跨域请求安全控制
- **令牌黑名单**: 登出时令牌失效机制

## 📱 功能特性

### 用户管理
- 用户注册和登录
- 安全的密码存储
- 会话管理

### TOTP 管理
- 添加/删除 TOTP 令牌
- 实时生成 6 位验证码
- 30 秒倒计时显示
- 批量清除功能

### 导入/导出
- 二维码扫描导入
- 支持 Google Authenticator 迁移
- 导出为二维码
- 拖拽上传支持

### 云端同步
- GitHub OAuth 认证
- Gist 备份和恢复
- 版本历史管理
- 跨设备同步

## 🌐 在线演示

- **前端应用**: https://totp-manager.pages.dev
- **API 端点**: https://totp-manager-api.workers.dev

## 📖 使用指南

1. **注册账户**: 创建新用户账户
2. **添加 TOTP**: 输入服务名称和密钥
3. **生成令牌**: 点击生成获取 6 位验证码
4. **导入现有**: 上传二维码或迁移数据
5. **云端备份**: 启用 GitHub 同步功能

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🆘 支持

如需帮助，请查看：
- [Issue 页面](../../issues)
- [讨论区](../../discussions)
- [项目仓库](https://github.com/your-username/totptokenmanagerbypages)

## 📚 相关链接

- [Vercel 文档](https://vercel.com/docs)
- [Railway 文档](https://docs.railway.app/)
- [Netlify 函数文档](https://docs.netlify.com/functions/overview/)
- [Docker 文档](https://docs.docker.com/)

---

⭐ 如果这个项目对您有帮助，请给它一个星标！
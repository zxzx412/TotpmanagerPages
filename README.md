# TOTP Token Manager

🔐 现代化的 TOTP（时间基一次性密码）令牌管理器，基于 Cloudflare Pages + KV 存储构建，支持多设备同步和备份功能。

## ✨ 主要特性

- 🛡️ **安全可靠**: JWT 认证 + Web Crypto API 加密
- 📱 **响应式设计**: 完美适配桌面端和移动端
- ☁️ **云端同步**: GitHub Gist 实现数据同步和备份
- 📷 **二维码支持**: 完整的导入/导出功能
- 🚀 **现代部署**: Cloudflare Pages 全栈一体化
- ⚡ **实时更新**: 30秒倒计时，自动令牌刷新
- 🔄 **批量导入**: 支持 Google Authenticator 迁移格式
- 💾 **持久化存储**: Cloudflare KV 确保数据不丢失

## 🏗️ 项目架构

基于 **Cloudflare Pages + KV 存储** 的现代化全栈应用架构：

```
TotpmanagerPages/
├── functions/                     # Cloudflare Pages Functions
│   └── api/[[route]].js          # 后端 API 入口（KV 存储）
├── totp-manager-frontend/       # 前端应用 (React 18)
│   ├── src/
│   │   ├── App.js              # 主应用组件
│   │   ├── config.js           # 配置文件
│   │   └── services/api.js     # API 服务
│   ├── _headers               # Cloudflare Pages 头部配置
│   ├── _redirects             # Cloudflare Pages 重定向配置
│   └── package.json
├── wrangler.toml                # Cloudflare 配置文件
├── package.json                 # 根目录构建配置
└── deploy-nodejs.js             # 一键部署脚本
```

### 🌆 技术亮点

- **无状态架构**: Cloudflare Pages Functions 提供高性能后端
- **持久化存储**: KV 存储确保数据安全可靠
- **全球CDN**: 自带全球边缘网络加速
- **零配置部署**: 推送代码即自动部署

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/your-username/TotpmanagerPages.git
cd TotpmanagerPages
```

### 2. 创建 Cloudflare Pages 项目
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择 "Pages" → "Create a project"
3. 连接您的 GitHub 仓库
4. 选择项目仓库

### 3. 配置构建设置
```
Framework: Create React App
Build command: cd totp-manager-frontend && npm ci && npm run build
Build output: totp-manager-frontend/build
Root directory: (留空)
```

### 4. 配置 KV 存储
1. 在 Cloudflare Dashboard 中创建 KV 命名空间
2. 在 Pages 项目的 "Settings" → "Functions" → "KV namespace bindings" 中添加：
   - Variable name: `TOTP_KV`
   - KV namespace: 选择您创建的命名空间

详细配置请参考：[CLOUDFLARE_KV_SETUP.md](./CLOUDFLARE_KV_SETUP.md)

### 5. 环境变量配置
在 "Settings" → "Environment variables" 中添加：
```
NODE_VERSION=18
JWT_SECRET=your-super-secret-jwt-key-here
# GitHub OAuth（可选）
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 6. 部署完成！
- 前端和后端 API 都在同一个域名下
- 自动 HTTPS 证书
- 全球 CDN 加速
- 完全免费使用

## 💻 本地开发

### 安装依赖
```bash
# 安装前端依赖
cd totp-manager-frontend
npm install

# 返回根目录
cd ..
```

### 启动开发服务器
```bash
# 启动前端开发服务器
npm run start-frontend
# 访问: http://localhost:3000

# 预览完整应用（需要 wrangler）
npm run preview
```

## 🛠️ 技术栈

### 前端
- **React 18** - 现代化 React 框架
- **Ant Design** - 企业级 UI 组件库
- **Axios** - HTTP 客户端
- **QRCode.react** - 二维码生成
- **jsQR** - 二维码识别

### 后端
- **Cloudflare Pages Functions** - 无服务器后端
- **Cloudflare KV** - 持久化键值存储
- **Web Crypto API** - 现代加密算法
- **JWT** - 安全认证机制

### 部署
- **Cloudflare Pages** - 静态站点托管
- **GitHub Integration** - 自动 CI/CD
- **Global CDN** - 全球边缘网络

## 🔒 安全特性

- **密码安全**: Web Crypto API + SHA-256 哈希
- **会话管理**: JWT 令牌，1小时过期时间
- **数据隔离**: 基于用户的数据分离
- **CORS 保护**: 跨域请求安全控制
- **持久化存储**: KV 存储确保数据不丢失

## 📱 功能特性

### 用户管理
- 用户注册和登录
- 安全的密码存储
- JWT 会话管理

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

## 🛠️ 故障排除

### 常见问题

1. **KV 绑定错误**
   - 检查 KV 命名空间是否正确创建
   - 确认 Pages 项目中的 KV 绑定配置

2. **环境变量未生效**
   - 重新部署项目
   - 检查变量名和值是否正确

3. **GitHub OAuth 失败**
   - 验证 GitHub OAuth 应用配置
   - 检查回调 URL 设置

### 调试方法

查看 Cloudflare Pages 的 "Functions" 日志获取详细错误信息。

## 📚 相关文档

- [Cloudflare KV 配置说明](./CLOUDFLARE_KV_SETUP.md)
- [GitHub 同步恢复指南](./GITHUB_SYNC_RESTORATION.md)
- [Google Authenticator 迁移支持](./GOOGLE_AUTHENTICATOR_MIGRATION_SUPPORT.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🆘 支持

如需帮助，请查看：
- [Issue 页面](../../issues)
- [讨论区](../../discussions)

---

⭐ 如果这个项目对您有帮助，请给它一个星标！
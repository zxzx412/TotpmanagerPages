# 🔧 Cloudflare Pages 环境变量配置指南

## ⭐ 推荐方式：使用 Dashboard 面板配置

我们**强烈建议**使用 Cloudflare Pages Dashboard 进行所有配置，而不是 `wrangler.toml` 文件。

### 🎯 为什么使用 Dashboard？
- ✅ **避免配置冲突**：Dashboard 设置优先级更高
- ✅ **便于管理**：可视化界面，操作简单
- ✅ **安全性更好**：敏感信息不会提交到代码仓库
- ✅ **团队协作**：多人可以在 Dashboard 中管理配置
- ✅ **实时生效**：无需重新部署代码

## 🔗 KV 命名空间绑定

在 **Settings** → **Functions** → **KV namespace bindings** 中添加：

```
Variable name: TOTP_KV
KV namespace: TOTP_KV (ID: 70cf8c706e374c98b991c309767c756d)
```

## 🌟 可选环境变量（GitHub 同步功能）

如果您要使用 GitHub 同步功能，请添加以下变量：

### GitHub OAuth 配置
```
GITHUB_CLIENT_ID = your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET = your-github-oauth-app-client-secret
GITHUB_REDIRECT_URI = https://your-pages-domain.pages.dev/api/github/callback
FRONTEND_URL = https://your-pages-domain.pages.dev
```

### 前端配置变量
```
REACT_APP_API_BASE_URL = https://your-pages-domain.pages.dev
REACT_APP_GITHUB_AUTH_URL = https://your-pages-domain.pages.dev/api/github/auth
```

## 📝 配置步骤

### 1. 获取项目域名
您的当前部署域名是：`https://a0df2519.totp-manager-pages.pages.dev`

### 2. 设置基础环境变量
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** → **totp-manager-pages**
3. 点击 **Settings** → **Environment variables**
4. 点击 **Add variable** 添加上述必需变量

### 3. 配置 KV 绑定
1. 在同一个设置页面，点击 **Functions** 标签
2. 在 **KV namespace bindings** 部分点击 **Add binding**
3. 设置变量名为 `TOTP_KV`，选择对应的 KV 命名空间

### 4. 创建 GitHub OAuth App（可选）
如果需要 GitHub 同步功能：
1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 **New OAuth App**
3. 填写应用信息：
   - **Application name**: TOTP Token Manager
   - **Homepage URL**: `https://a0df2519.totp-manager-pages.pages.dev`
   - **Authorization callback URL**: `https://a0df2519.totp-manager-pages.pages.dev/api/github/callback`
4. 创建后获取 **Client ID** 和 **Client Secret**
5. 将这些值添加到环境变量中

## 🚀 完成配置后

1. 保存所有环境变量
2. 重新部署应用（或等待自动部署）
3. 访问您的应用：https://a0df2519.totp-manager-pages.pages.dev
4. 注册新用户并开始使用

## 🔍 故障排除

### 如果仍然出现错误：
1. 检查所有环境变量是否正确设置
2. 确认 KV 绑定是否正确配置
3. 确保 JWT_SECRET 是一个有效的字符串（不含特殊字符）
4. 检查浏览器控制台是否有具体错误信息

### 测试 API 连接：
访问：`https://a0df2519.totp-manager-pages.pages.dev/api/test`
如果配置正确，应该返回一个成功响应。
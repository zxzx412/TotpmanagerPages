# TOTP Token Manager

🔐 一个现代化的 TOTP（时间基一次性密码）令牌管理器，支持多设备同步和云端备份功能。

## ✨ 主要特性

- 🛡️ **安全可靠**: 采用 JWT 认证和 PBKDF2 密码加密
- 📱 **响应式设计**: 完美适配桌面端和移动端
- ☁️ **云端同步**: 通过 GitHub Gist 实现数据同步和备份
- 📷 **二维码支持**: 支持导入/导出 TOTP 二维码
- 🚀 **简单部署**: 支持 Cloudflare Pages 一键部署
- ⚡ **实时更新**: 30秒倒计时，自动令牌刷新
- 🔄 **批量导入**: 支持 Google Authenticator 迁移格式
- 💾 **持久化存储**: 使用 Cloudflare KV 确保数据持久性

## 🏗️ 项目架构

```
TotpmanagerPages/
├── functions/
│   └── api/[[route]].js         # Cloudflare Pages Functions API
├── totp-manager-frontend/        # React 前端应用
│   ├── src/
│   │   ├── App.js              # 主应用组件
│   │   ├── config.js           # 配置文件
│   │   └── services/api.js     # API 服务层
│   ├── public/                 # 静态资源
│   └── build/                  # 构建输出（部署时生成）
├── wrangler.toml               # Cloudflare Workers 配置
├── package.json                # 项目依赖配置
└── deploy-nodejs.js            # 一键部署脚本
```

## 🚀 快速开始

### 🎆 一键部署 - Cloudflare Pages（推荐）

#### 为什么选择 Cloudflare Pages？
- ☁️ **统一平台**：前后端都在同一域名下
- 🚀 **零配置**：自动检测并部署
- 🌍 **全球 CDN**：超快访问速度
- 💰 **完全免费**：无限带宽和请求
- 🔗 **GitHub 集成**：推送代码自动部署
- 💾 **KV 存储**：持久化数据存储

#### 快速部署命令
```bash
# 克隆项目
git clone https://github.com/your-username/TotpmanagerPages.git
cd TotpmanagerPages

# 推送到您的 GitHub 仓库
git remote set-url origin https://github.com/your-username/your-repo-name.git
git push origin main
```

### 📋 详细部署步骤

#### 1. 准备工作
1. **Fork 或克隆项目**到您的 GitHub 账户
2. 确保代码已推送到 GitHub 仓库

#### 2. 创建 Cloudflare Pages 项目
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择 **Pages** → **Create a project**
3. 连接您的 GitHub 仓库
4. 选择项目仓库

#### 3. 构建设置
```
Framework: Create React App
Build command: cd totp-manager-frontend && npm ci && npm run build
Build output: totp-manager-frontend/build
Root directory: (留空)
```

#### 4. 创建 KV 命名空间

**方法1：使用 wrangler CLI（推荐）**
```bash
# 确保您已登录到 Cloudflare
npx wrangler kv namespace create "TOTP_KV"
npx wrangler kv namespace create "TOTP_KV_PREVIEW"
```

**方法2：使用 Cloudflare Dashboard**
1. 在 Cloudflare Dashboard 中进入 **Workers & Pages**
2. 点击 **KV**
3. 创建新的 KV 命名空间，命名为：`totp-manager-kv`
4. 记录下 **Namespace ID**

#### 5. 配置 KV 绑定
1. 回到 Pages 项目
2. 进入 **Settings** → **Functions**
3. 在 **KV namespace bindings** 部分添加：
   - **Variable name**: `TOTP_KV`
   - **KV namespace**: 选择创建的 KV 命名空间

#### 6. 环境变量配置
在 **Settings** → **Environment variables** 中添加：

**必需变量：**
```env
NODE_VERSION=18
JWT_SECRET=your-super-secret-jwt-key-here
```

**可选变量（GitHub 同步功能）：**
```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
FRONTEND_URL=https://your-pages-domain.pages.dev
```

#### 7. GitHub OAuth 配置（可选）
如需使用 GitHub 同步功能：

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 创建新的 **OAuth App**
3. 配置参数：
   - **Application name**: TOTP Token Manager
   - **Homepage URL**: `https://your-pages-domain.pages.dev`
   - **Authorization callback URL**: `https://your-pages-domain.pages.dev/api/github/callback`
4. 复制 **Client ID** 和 **Client Secret** 到环境变量

#### 8. 部署完成！
- 访问您的 Pages 域名
- 注册新用户或登录
- 开始使用 TOTP 管理功能

## 💻 本地开发

### 环境要求
- Node.js 18+
- npm 或 yarn

### 启动开发环境

**前端开发：**
```bash
cd totp-manager-frontend
npm install
npm start
# 访问: http://localhost:3000
```

**本地 API 测试：**
```bash
# 安装 wrangler
npm install -g wrangler

# 在项目根目录运行
npx wrangler pages dev
```

### 本地开发注意事项
- 本地开发需要配置 KV 命名空间
- 建议创建 development 环境的 KV 命名空间
- 在 `wrangler.toml` 中配置 `preview_id`

## 📱 功能介绍

### 🔐 用户认证
- 安全的用户注册/登录系统
- JWT token 认证
- PBKDF2 密码加密（100,000 次迭代）
- 会话状态持久化

### 🎯 TOTP 管理
- **添加 TOTP**：手动输入或二维码扫描
- **生成令牌**：实时生成 6 位验证码
- **30秒倒计时**：自动刷新显示
- **导出二维码**：生成标准 TOTP 二维码
- **批量管理**：清除所有令牌功能

### 📷 二维码支持

#### 支持的格式
1. **标准 TOTP 格式**
   ```
   otpauth://totp/Example:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example
   ```

2. **Google Authenticator 迁移格式** ⭐
   ```
   otpauth-migration://offline?data=CjEKCkhleWFuZX...
   ```
   - 支持批量导入多个账户
   - 从 Google Authenticator "转移账户" 功能导出
   - Protocol Buffer 格式解析

#### 使用方法
1. **从 Google Authenticator 导出**：
   - 打开 Google Authenticator
   - 选择 "转移账户" → "导出账户"
   - 生成二维码并截图

2. **导入到系统**：
   - 在上传区域拖拽或选择二维码图片
   - 系统自动识别格式
   - 批量导入所有账户

### ☁️ GitHub 云端同步

#### 功能特性
- **OAuth 认证**：安全的 GitHub 授权
- **私有 Gist**：数据存储在私有 Gist 中
- **版本管理**：支持多个备份版本
- **跨设备同步**：在多个设备间同步数据

#### 使用流程
1. **开启同步**：点击同步开关，完成 GitHub 授权
2. **上传备份**：将 TOTP 数据备份到 GitHub Gist
3. **查看版本**：管理多个备份版本
4. **恢复数据**：从备份恢复 TOTP 数据
5. **删除备份**：清理不需要的备份版本

#### 备份数据格式
```json
{
  "totps": [
    {
      "id": "uuid",
      "user_id": "user_uuid",
      "user_info": "Service Name",
      "secret": "BASE32_SECRET",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "backup_time": "2025-01-01T00:00:00.000Z",
  "version": "1.0"
}
```

## 🔧 技术架构

### 前端技术栈
- **React 18**: 现代化的前端框架
- **Ant Design**: 企业级 UI 组件库
- **Axios**: HTTP 客户端
- **QRCode.react**: 二维码生成
- **jsQR**: 二维码识别
- **js-cookie**: Cookie 管理

### 后端技术栈
- **Cloudflare Pages Functions**: 无服务器后端
- **Web Crypto API**: 加密算法实现
- **Cloudflare KV**: 持久化数据存储
- **GitHub API**: 云端同步集成

### 数据存储

#### Cloudflare KV 存储结构
```
user:{username}           # 用户信息
totp:{totp_id}           # TOTP 配置
user_totps:{user_id}     # 用户的 TOTP ID 列表
github_token:{user_id}   # GitHub access token
github_state:{state}     # OAuth state (TTL: 10分钟)
```

#### 存储优势
- **持久化**：数据在函数重启后不丢失
- **全球分布**：KV 数据全球同步
- **高性能**：毫秒级读取响应
- **可扩展**：支持大量并发访问

### 安全特性
- **JWT 认证**：安全的无状态认证
- **密码加密**：PBKDF2 + SHA-256（100,000 次迭代）
- **CORS 保护**：跨域请求安全控制
- **TOTP 算法**：标准 HMAC-SHA1 实现
- **OAuth 安全**：GitHub OAuth 权限最小化

## 📊 API 文档

### 用户认证 API
```
POST /api/register      # 用户注册
POST /api/login         # 用户登录
POST /api/logout        # 用户登出
```

### TOTP 管理 API
```
GET    /api/totp                    # 获取 TOTP 列表
POST   /api/totp                    # 添加 TOTP
GET    /api/totp/{id}/generate      # 生成令牌
GET    /api/totp/{id}/export        # 导出二维码
DELETE /api/totp/{id}               # 删除 TOTP
POST   /api/totp/import             # 导入二维码
POST   /api/totp/clear-all          # 清除所有
```

### GitHub 同步 API
```
GET    /api/github/auth-status      # 认证状态
GET    /api/github/auth             # 开始认证
GET    /api/github/callback         # OAuth 回调
POST   /api/github/upload           # 上传备份
GET    /api/github/versions         # 备份版本
GET    /api/github/restore          # 恢复数据
DELETE /api/github/delete-backup    # 删除备份
GET    /api/github/verify-token     # 验证令牌
```

## 🚨 故障排除

### 常见问题

#### 1. KV 相关错误
**错误**: "TOTP_KV is not defined"
**解决方案**:
- 检查 KV 命名空间是否正确创建
- 确认 Pages 项目中的 KV 绑定设置
- 验证 Variable name 设置为 `TOTP_KV`

**错误**: "Invalid KV namespace ID. Not a valid hex string"
**解决方案**:
- 检查 `wrangler.toml` 中的 KV namespace ID 是否为占位符
- 使用 `npx wrangler kv namespace create "TOTP_KV"` 创建真实的 KV 命名空间
- 将生成的 ID 更新到 `wrangler.toml` 文件中

#### 2. GitHub 同步问题
**错误**: GitHub API 403 错误
**解决方案**:
- 检查 GitHub OAuth App 配置
- 确认回调 URL 设置正确
- 验证 Client ID 和 Secret 环境变量
- 确保 OAuth App 包含 `gist` 权限

#### 3. 部署问题
**错误**: 构建失败
**解决方案**:
- 检查 Node.js 版本设置（推荐 18）
- 确认构建命令和输出目录设置
- 查看 Functions 构建日志

#### 4. TOTP 生成问题
**错误**: 生成的令牌与其他应用不一致
**解决方案**:
- 确认密钥格式为标准 Base32
- 检查时间同步（30秒周期）
- 验证 HMAC-SHA1 算法实现

### 性能优化

#### KV 操作限制
- **读取**: 每秒最多 100,000 次
- **写入**: 每秒最多 1,000 次
- **单值大小**: 最大 25MB

#### 最佳实践
- 合理设计 KV 键值结构
- 避免频繁的写入操作
- 使用批量操作减少请求次数
- 实现适当的客户端缓存

## 📈 版本历史

### v2.0.0 - KV 存储迁移
- ✅ 迁移到 Cloudflare KV 存储
- ✅ 解决数据持久性问题
- ✅ 改进 GitHub 集成稳定性
- ✅ 增强错误处理和调试

### v1.5.0 - GitHub 功能恢复
- ✅ 完整的 GitHub OAuth 集成
- ✅ Gist 备份和恢复功能
- ✅ 多版本备份管理
- ✅ 跨设备数据同步

### v1.0.0 - 核心功能
- ✅ 基础 TOTP 管理功能
- ✅ Google Authenticator 迁移支持
- ✅ 响应式前端界面
- ✅ Cloudflare Pages 部署

## 🤝 贡献指南

我们欢迎任何形式的贡献！

### 开发流程
1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范
- 使用 ESLint 和 Prettier
- 编写清晰的注释
- 遵循现有的代码风格
- 添加适当的错误处理

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目：
- [React](https://reactjs.org/) - 用户界面框架
- [Ant Design](https://ant.design/) - 企业级 UI 组件
- [Cloudflare Pages](https://pages.cloudflare.com/) - 部署平台
- [GitHub API](https://docs.github.com/en/rest) - 云端同步服务

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star！
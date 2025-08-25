# Cloudflare KV 配置说明

## 概述

本项目已迁移到使用 Cloudflare KV 作为持久化存储，替代之前的内存存储。这解决了 Cloudflare Pages Functions 无状态环境中数据丢失的问题。

## 需要配置的 KV 命名空间

### 1. 创建 KV 命名空间

在 Cloudflare Dashboard 中：

1. 进入 **Workers & Pages** 
2. 点击 **KV** 
3. 创建一个新的 KV 命名空间，建议命名为：`totp-manager-kv`

### 2. 获取 KV 命名空间 ID

创建后，您会得到两个 ID：
- **Namespace ID**（生产环境使用）
- **Preview ID**（预览环境使用，可选）

### 3. 配置 wrangler.toml

更新 `wrangler.toml` 文件中的 KV 配置：

```toml
name = "totp-manager-pages"
compatibility_date = "2024-01-01"
pages_build_output_dir = "."

[[kv_namespaces]]
binding = "TOTP_KV"
preview_id = "your-preview-kv-namespace-id"
id = "your-production-kv-namespace-id"
```

将 `your-production-kv-namespace-id` 替换为您的实际 KV 命名空间 ID。

### 4. 在 Cloudflare Pages 中绑定 KV

如果您通过 Cloudflare Pages Dashboard 部署：

1. 进入您的 Pages 项目
2. 进入 **Settings** > **Functions**
3. 在 **KV namespace bindings** 部分添加：
   - **Variable name**: `TOTP_KV`
   - **KV namespace**: 选择您创建的 KV 命名空间

## KV 存储结构

项目使用以下 KV 存储键值结构：

### 用户数据
- `user:{username}` - 用户信息（ID、密码哈希等）

### TOTP 数据
- `totp:{totp_id}` - 单个 TOTP 配置
- `user_totps:{user_id}` - 用户的 TOTP ID 列表

### GitHub 集成
- `github_token:{user_id}` - 用户的 GitHub access token
- `github_state:{state}` - GitHub OAuth state（10分钟 TTL）

## 迁移后的改进

### 1. 持久化存储
- 数据在 Cloudflare Pages Functions 重启后不会丢失
- 用户登录状态和 GitHub 认证状态得以保持

### 2. 性能优化
- KV 操作是异步的，提供更好的性能
- 自动处理数据序列化和反序列化

### 3. 扩展性
- 支持更大的数据存储量
- 更好的并发处理能力

## 注意事项

### 1. KV 操作限制
- KV 读取：每秒最多 100,000 次读取操作
- KV 写入：每秒最多 1,000 次写入操作
- 单个值最大 25MB

### 2. 一致性
- KV 是最终一致性存储
- 写入后可能需要几秒钟才能在全球范围内生效

### 3. 成本
- KV 操作在 Cloudflare Pages 的免费套餐中有一定限额
- 超出限额后会产生费用

## 故障排除

### 1. KV 绑定错误
如果看到 "TOTP_KV is not defined" 错误：
- 检查 KV 命名空间是否正确创建
- 确认 wrangler.toml 中的配置正确
- 验证 Cloudflare Pages 项目中的 KV 绑定

### 2. 数据访问错误
如果遇到数据读写错误：
- 检查 KV 命名空间的权限设置
- 确认 KV 命名空间 ID 是否正确
- 查看 Cloudflare 控制台中的错误日志

### 3. 性能问题
如果 KV 操作较慢：
- 检查 KV 操作的频率是否超过限制
- 考虑在应用层面实现缓存
- 优化 KV 键值设计以减少查询次数

## 开发和测试

### 本地开发
```bash
# 使用 wrangler dev 进行本地开发
npx wrangler pages dev

# 或者直接部署测试
npx wrangler pages deploy
```

### 数据备份
KV 数据可以通过以下方式备份：
```bash
# 导出 KV 数据
npx wrangler kv:key list --namespace-id=your-namespace-id

# 备份特定键值
npx wrangler kv:key get "key-name" --namespace-id=your-namespace-id
```

## 总结

迁移到 Cloudflare KV 后，TOTP 令牌管理器现在具备了：
- 持久化的数据存储
- 更好的用户体验（登录状态保持）
- 稳定的 GitHub 集成功能
- 可扩展的架构基础

请按照上述步骤配置 KV 命名空间，完成迁移过程。
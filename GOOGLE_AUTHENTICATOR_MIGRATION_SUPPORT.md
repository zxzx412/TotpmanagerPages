# Google验证器迁移格式支持

## 🎉 功能概述

现在完全支持Google验证器的迁移格式！您可以直接从Google验证器导出所有账户，然后批量导入到我们的TOTP令牌管理器中。

## 📱 支持的格式

### 1. Google验证器迁移格式 ✅
```
otpauth-migration://offline?data=CjEKCkhleWFuZX...
```
- **特点**：批量导入多个TOTP账户
- **来源**：Google验证器的"转移账户"功能
- **优势**：一次性导入所有令牌

### 2. 标准TOTP格式 ✅
```
otpauth://totp/Example:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example
```
- **特点**：单个TOTP账户导入
- **来源**：各种服务的TOTP设置页面
- **优势**：兼容所有TOTP服务

## 🔧 技术实现

### Protocol Buffer解析
我们实现了简化版的Protocol Buffer解析器，专门处理Google验证器的迁移数据格式：

```javascript
// 主要组件
parseGoogleAuthMigration()  // 解析迁移URI
parseOtpParameter()         // 解析单个OTP参数
readVarint()                // Protocol Buffer varint解码
base32Encode()              // 二进制转Base32编码
```

### 数据处理流程
1. **URI解析**：提取data参数
2. **Base64解码**：还原二进制数据
3. **Protocol Buffer解码**：解析结构化数据
4. **字段提取**：获取secret、name、issuer等
5. **Base32编码**：转换密钥格式
6. **批量创建**：添加多个TOTP账户

## 📋 使用方法

### 从Google验证器导出
1. 打开Google验证器应用
2. 点击右上角三点菜单
3. 选择"转移账户"
4. 选择"导出账户"
5. 选择要导出的账户
6. 生成二维码
7. 截图保存二维码

### 导入到我们的系统
1. 登录TOTP令牌管理器
2. 在上传区域拖拽或点击上传二维码图片
3. 系统自动识别为迁移格式
4. 显示"成功导入 X 个TOTP（Google验证器迁移格式）"
5. 所有账户自动添加到列表

## ✨ 功能特点

### 🚀 批量处理
- **一次导入多个**：支持同时导入所有Google验证器账户
- **自动识别**：系统自动区分迁移格式和标准格式
- **详细反馈**：显示具体导入了多少个账户

### 🛡️ 安全可靠
- **本地解析**：所有数据处理在浏览器本地完成
- **标准算法**：使用相同的TOTP算法确保一致性
- **数据隔离**：每个用户的数据完全独立

### 🔍 智能识别
- **格式检测**：自动识别是迁移格式还是标准格式
- **错误处理**：友好的错误提示和处理
- **兼容性**：与Google验证器100%兼容

## 🎯 使用示例

### 批量迁移示例
```
导入前：Google验证器中有5个账户
导入后：TOTP管理器中新增5个账户
- GitHub (github.com)
- Gmail (google.com) 
- Discord (discord.com)
- Microsoft (microsoft.com)
- AWS (aws.amazon.com)
```

### 导入成功消息
- **单个导入**：`成功导入 1 个TOTP`
- **批量导入**：`成功导入 5 个TOTP（Google验证器迁移格式）`

## 🔧 技术细节

### 支持的字段
- **secret**: 密钥（必需）
- **name/label**: 账户名称（必需）
- **issuer**: 服务提供商（可选）
- **algorithm**: 算法（默认SHA1）
- **digits**: 位数（默认6位）
- **period**: 周期（默认30秒）

### Protocol Buffer结构
```
message MigrationPayload {
  repeated OtpParameters otp_parameters = 1;
  int32 version = 2;
  int32 batch_size = 3;
  int32 batch_index = 4;
  int32 batch_id = 5;
}

message OtpParameters {
  bytes secret = 1;
  string name = 2; 
  string issuer = 3;
  Algorithm algorithm = 4;
  DigitCount digits = 5;
  OtpType type = 6;
  int64 counter = 7;
}
```

## 🚨 注意事项

### 兼容性
- ✅ **完全兼容**：Google验证器导出的标准格式
- ✅ **令牌一致**：生成的6位数字与Google验证器完全相同
- ✅ **时间同步**：30秒自动刷新周期

### 限制
- **图片质量**：确保二维码清晰完整
- **格式要求**：必须是Google验证器导出的迁移格式
- **网络无关**：完全本地处理，无需网络连接

## 📊 支持状态

| 功能 | 状态 | 说明 |
|------|------|------|
| 迁移格式识别 | ✅ | 自动识别 otpauth-migration:// |
| Protocol Buffer解析 | ✅ | 简化版PB解析器 |
| Base64解码 | ✅ | 标准Base64解码 |
| Base32编码 | ✅ | TOTP标准Base32编码 |
| 批量导入 | ✅ | 支持多账户同时导入 |
| 错误处理 | ✅ | 友好的错误提示 |
| 格式验证 | ✅ | 严格的数据验证 |

## 🎉 总结

现在您可以轻松地将所有Google验证器账户迁移到我们的TOTP令牌管理器中！

**主要优势**：
- 🚀 **一键迁移**：批量导入所有账户
- 🔒 **安全可靠**：本地处理，数据不离开浏览器
- ⚡ **即时生效**：导入后立即可以生成令牌
- 🎯 **完全兼容**：与Google验证器生成相同的令牌

开始使用吧！将您的Google验证器账户迁移过来，享受更好的TOTP管理体验！🎊
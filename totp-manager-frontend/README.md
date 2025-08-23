# TOTP Token Manager - 前端应用

一个基于 React 的 TOTP (时间基一次性密码) 令牌管理器前端应用。

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
npm install
# 或使用 pnpm
pnpm install

# 启动开发服务器
npm start
# 或
pnpm start
```

### 构建生产版本

```bash
# 构建应用
npm run build
# 或
pnpm run build
```

## 📦 部署到 Cloudflare Pages

本项目已配置支持 Cloudflare Pages 部署。详细部署指南请参考根目录的 `CLOUDFLARE_PAGES_DEPLOYMENT.md` 文件。

### 快速部署步骤：

1. **推送代码到 GitHub**
2. **在 Cloudflare Dashboard 中创建 Pages 项目**
3. **配置构建设置：**
   - Framework: Create React App
   - Build command: `cd totp-manager-frontend && npm run build`
   - Build output: `totp-manager-frontend/build`
4. **设置环境变量：**
   - `REACT_APP_API_BASE_URL`
   - `REACT_APP_GITHUB_AUTH_URL`
5. **部署完成！**

## 🛠️ 技术栈

- **React 18** - 用户界面框架
- **Ant Design** - UI 组件库
- **Axios** - HTTP 客户端
- **QRCode.react** - 二维码生成
- **jsQR** - 二维码识别
- **js-cookie** - Cookie 管理
- **react-responsive** - 响应式设计

## 📁 项目结构

```
totp-manager-frontend/
├── public/
│   └── index.html
├── src/
│   ├── services/
│   │   └── api.js          # API 服务
│   ├── App.js              # 主应用组件
│   ├── config.js           # 配置文件
│   ├── index.js            # 应用入口
│   └── ...
├── _headers                # Cloudflare Pages 头部配置
├── _redirects              # Cloudflare Pages 重定向配置
├── .env.development        # 开发环境变量
├── .env.production         # 生产环境变量
└── package.json
```



### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

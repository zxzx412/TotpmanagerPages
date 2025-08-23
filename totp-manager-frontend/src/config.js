const config = {
    // 前后端分离部署 - 前端在Cloudflare Pages，后端在其他平台
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://your-api-backend.vercel.app' : 'http://localhost:8080'),
    GITHUB_AUTH_URL: process.env.REACT_APP_GITHUB_AUTH_URL || (process.env.NODE_ENV === 'production' ? 'https://your-api-backend.vercel.app/api/github/auth' : 'http://localhost:8080/api/github/auth'),
    AUTH_API: process.env.REACT_APP_AUTH_API || '/api/auth', // 认证 API 端点
};

export default config;
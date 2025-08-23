const config = {
    // Cloudflare Pages 统一部署 - 前后端同域名
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080'),
    GITHUB_AUTH_URL: process.env.REACT_APP_GITHUB_AUTH_URL || (process.env.NODE_ENV === 'production' ? '/api/github/auth' : 'http://localhost:8080/api/github/auth'),
    AUTH_API: process.env.REACT_APP_AUTH_API || '/api/auth', // 认证 API 端点
};

export default config;
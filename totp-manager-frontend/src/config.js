const config = {
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://2fab.civilguard.es' : 'http://localhost:8080'),
    GITHUB_AUTH_URL: process.env.REACT_APP_GITHUB_AUTH_URL || (process.env.NODE_ENV === 'production' ? 'https://2fab.civilguard.es/api/github/auth' : 'http://localhost:8080/api/github/auth'),
    AUTH_API: process.env.REACT_APP_AUTH_API || '/api/auth', // 新增的认证 API 端点
};

export default config;
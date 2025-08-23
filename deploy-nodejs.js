#!/usr/bin/env node

/**
 * TOTP Token Manager - Node.js 版本自动化部署脚本
 * 支持多个平台的一键部署
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

function checkCommand(command) {
    try {
        execSync(`which ${command}`, { stdio: 'ignore' });
        return true;
    } catch {
        try {
            execSync(`where ${command}`, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }
}

function runCommand(command, cwd = process.cwd(), silent = false) {
    try {
        if (!silent) log(`运行: ${command}`, 'cyan');
        execSync(command, { cwd, stdio: silent ? 'ignore' : 'inherit' });
        return true;
    } catch (error) {
        if (!silent) log(`错误: ${error.message}`, 'red');
        return false;
    }
}

async function selectPlatform() {
    log('\n🚀 TOTP Token Manager - Node.js 版本部署工具', 'bold');
    log('━'.repeat(50), 'cyan');
    
    log('\n📋 支持的部署平台:', 'yellow');
    log('1. ☁️ Cloudflare Pages (推荐 - 前后端统一平台)', 'green');
    log('2. 🌟 Vercel (零配置，全球 CDN)', 'green');
    log('3. 🚄 Railway (优秀开发体验，内置数据库)', 'green');
    log('4. 🌊 Netlify (函数 + 静态站点)', 'green');
    log('5. 🐳 Docker (本地构建镜像)', 'green');
    log('6. 📖 仅显示部署指南', 'blue');
    
    const answer = await ask('\n请选择部署方式 (1-6): ');
    return answer;
}

async function deployToCloudflarePages() {
    log('\n☁️ 部署到 Cloudflare Pages Functions...', 'yellow');
    
    // 检查 Wrangler CLI
    if (!checkCommand('wrangler')) {
        log('📥 安装 Wrangler CLI...', 'cyan');
        if (!runCommand('npm install -g wrangler')) {
            log('❌ Wrangler CLI 安装失败', 'red');
            return false;
        }
    }
    
    // 检查项目结构
    const apiDir = path.join(__dirname, 'api');
    if (!fs.existsSync(apiDir)) {
        log('❌ api 目录不存在', 'red');
        return false;
    }
    
    log('✅ Wrangler CLI 已准备就绪', 'green');
    
    // 创建 Functions 目录结构
    const functionsDir = path.join(__dirname, 'functions');
    if (!fs.existsSync(functionsDir)) {
        fs.mkdirSync(functionsDir, { recursive: true });
    }
    
    // 创建 API 函数入口文件
    const functionContent = `
// Cloudflare Pages Functions API 入口
export async function onRequest(context) {
    const { request, env } = context;
    
    // 动态导入 API 模块
    const apiModule = await import('./api/index.js');
    
    // 创建兼容的请求/响应处理
    return apiModule.handleRequest(request, env);
}
`;
    
    fs.writeFileSync(path.join(functionsDir, '[[route]].js'), functionContent);
    
    // 创建 wrangler.toml 配置
    const wranglerConfig = `
name = "totp-manager-api"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build"

[[env.production.vars]]
NODE_ENV = "production"

# 在 Cloudflare Dashboard 中设置的环境变量:
# JWT_SECRET = "your-secret-key"
# GITHUB_CLIENT_ID = "your-github-client-id" (可选)
# GITHUB_CLIENT_SECRET = "your-github-client-secret" (可选)
# GITHUB_REDIRECT_URI = "https://your-pages-domain.pages.dev/api/github/callback"
# FRONTEND_URL = "https://your-pages-domain.pages.dev"
`;
    
    fs.writeFileSync(path.join(__dirname, 'wrangler.toml'), wranglerConfig);
    
    // 更新 package.json 添加构建脚本
    const packageJsonPath = path.join(__dirname, 'package.json');
    let packageJson = {};
    if (fs.existsSync(packageJsonPath)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    }
    
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts.build = 'cp -r api functions/ && echo "Build complete"';
    packageJson.scripts.dev = 'wrangler pages dev .';
    packageJson.scripts.deploy = 'wrangler pages deploy .';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    log('\n✅ Cloudflare Pages Functions 配置完成！', 'green');
    log('\n📋 接下来的步骤:', 'yellow');
    log('1. 提交代码到 Git 仓库', 'cyan');
    log('2. 前往 Cloudflare Dashboard → Pages', 'cyan');
    log('3. 创建新项目，连接您的仓库', 'cyan');
    log('4. 设置构建配置：', 'cyan');
    log('   - Framework: None', 'white');
    log('   - Build command: npm run build', 'white');
    log('   - Build output: (留空)', 'white');
    log('5. 配置环境变量：', 'cyan');
    log('   - JWT_SECRET', 'white');
    log('   - GITHUB_CLIENT_ID (可选)', 'white');
    log('   - GITHUB_CLIENT_SECRET (可选)', 'white');
    log('   - GITHUB_REDIRECT_URI', 'white');
    log('   - FRONTEND_URL', 'white');
    log('6. 部署完成后，前后端将在同一域名下运行！', 'cyan');
    
    return true;
}

async function deployToVercel() {
    log('\n📦 部署到 Vercel...', 'yellow');
    
    // 检查 Vercel CLI
    if (!checkCommand('vercel')) {
        log('📥 安装 Vercel CLI...', 'cyan');
        if (!runCommand('npm install -g vercel')) {
            log('❌ Vercel CLI 安装失败', 'red');
            return false;
        }
    }
    
    // 检查项目结构
    const apiDir = path.join(__dirname, 'api');
    if (!fs.existsSync(apiDir)) {
        log('❌ api 目录不存在', 'red');
        return false;
    }
    
    log('✅ Vercel CLI 已准备就绪', 'green');
    
    // 安装依赖
    log('📦 安装后端依赖...', 'cyan');
    if (!runCommand('npm install', apiDir)) {
        log('❌ 依赖安装失败', 'red');
        return false;
    }
    
    // 部署后端
    log('🚀 部署后端到 Vercel...', 'cyan');
    log('💡 请按照 Vercel CLI 提示完成部署配置', 'yellow');
    
    if (!runCommand('vercel', apiDir)) {
        log('❌ 后端部署失败', 'red');
        return false;
    }
    
    log('\n✅ 后端部署完成！', 'green');
    log('📋 接下来的步骤:', 'yellow');
    log('1. 复制 Vercel 给出的域名', 'cyan');
    log('2. 前往 Cloudflare Pages 部署前端', 'cyan');
    log('3. 在前端环境变量中设置后端域名', 'cyan');
    
    return true;
}

async function deployToRailway() {
    log('\n📦 准备 Railway 部署...', 'yellow');
    
    log('📋 Railway 部署步骤:', 'cyan');
    log('1. 访问 https://railway.app', 'white');
    log('2. 使用 GitHub 账户登录', 'white');
    log('3. 点击 "New Project" → "Deploy from GitHub repo"', 'white');
    log('4. 选择您的仓库', 'white');
    log('5. 选择 api 目录', 'white');
    log('6. Railway 会自动检测并部署', 'white');
    
    log('\n🔧 环境变量配置:', 'cyan');
    log('JWT_SECRET=your-super-secret-jwt-key', 'white');
    log('GITHUB_CLIENT_ID=your-github-client-id', 'white');
    log('GITHUB_CLIENT_SECRET=your-github-client-secret', 'white');
    log('FRONTEND_URL=https://your-frontend.pages.dev', 'white');
    
    return true;
}

async function buildDocker() {
    log('\n🐳 构建 Docker 镜像...', 'yellow');
    
    if (!checkCommand('docker')) {
        log('❌ Docker 未安装，请先安装 Docker', 'red');
        return false;
    }
    
    const apiDir = path.join(__dirname, 'api');
    if (!fs.existsSync(apiDir)) {
        log('❌ api 目录不存在', 'red');
        return false;
    }
    
    log('🏗️ 构建镜像...', 'cyan');
    if (!runCommand('docker build -t totp-manager-api .', apiDir)) {
        log('❌ Docker 镜像构建失败', 'red');
        return false;
    }
    
    log('\n✅ Docker 镜像构建完成！', 'green');
    log('📋 运行容器:', 'yellow');
    log('docker run -d \\', 'cyan');
    log('  --name totp-manager-api \\', 'cyan');
    log('  -p 8080:8080 \\', 'cyan');
    log('  -e JWT_SECRET=your-secret \\', 'cyan');
    log('  -e FRONTEND_URL=https://your-frontend.com \\', 'cyan');
    log('  -v $(pwd)/data:/app/data \\', 'cyan');
    log('  totp-manager-api', 'cyan');
    
    return true;
}

async function showDeploymentGuide() {
    log('\n📖 部署指南', 'bold');
    log('━'.repeat(50), 'cyan');
    
    log('\n📁 项目结构:', 'yellow');
    log('api/              # Node.js 后端', 'white');
    log('├── index.js             # 主应用文件', 'white');
    log('├── package.json         # 依赖配置', 'white');
    log('├── vercel.json          # Vercel 配置', 'white');
    log('├── railway.json         # Railway 配置', 'white');
    log('└── Dockerfile           # Docker 配置', 'white');
    
    log('\n☁️ 推荐平台 - Cloudflare Pages:', 'yellow');
    log('1. 访问 https://dash.cloudflare.com/', 'white');
    log('2. 选择 Pages → Create a project', 'white');
    log('3. 连接 GitHub 仓库', 'white');
    log('4. 使用默认构建设置', 'white');
    log('5. 配置环境变量', 'white');
    log('6. 前后端统一部署完成！', 'white');
    
    log('\n🌟 备选平台 - Vercel:', 'yellow');
    log('1. 访问 https://vercel.com', 'white');
    log('2. 连接 GitHub 仓库', 'white');
    log('3. 选择 api 目录', 'white');
    log('4. 设置环境变量', 'white');
    log('5. 部署完成！', 'white');
    
    log('\n🚄 Railway 部署:', 'yellow');
    log('1. 访问 https://railway.app', 'white');
    log('2. 部署 GitHub 仓库', 'white');
    log('3. 选择 api 目录', 'white');
    log('4. 配置环境变量', 'white');

    log('\n📊 平台对比:', 'yellow');
    log('┌─────────────┬──────────┬─────────┬─────────┬─────────┐', 'cyan');
    log('│ 平台        │ 免费额度 │ 数据库  │ 难度    │ 优势    │', 'cyan');
    log('├─────────────┼──────────┼─────────┼─────────┼─────────┤', 'cyan');
    log('│ Cloudflare  │ 无限制   │ 需外部  │ ⭐      │ 统一域名│', 'white');
    log('│ Vercel      │ 100GB/月 │ 需外部  │ ⭐      │ 零配置  │', 'white');
    log('│ Railway     │ $5/月    │ 内置    │ ⭐⭐    │ 数据库  │', 'white');
    log('│ Netlify     │ 100GB/月 │ 需外部  │ ⭐⭐    │ CDN优秀 │', 'white');
    log('└─────────────┴──────────┴─────────┴─────────┴─────────┘', 'cyan');
    
    log('\n📚 详细指南:', 'yellow');
    log('查看 README.md 获取完整部署指南', 'cyan');
}

async function checkEnvironment() {
    log('\n🔍 环境检查...', 'yellow');
    
    const checks = [
        { name: 'Node.js', command: 'node', required: true },
        { name: 'npm', command: 'npm', required: true },
        { name: 'Git', command: 'git', required: true },
        { name: 'Wrangler CLI', command: 'wrangler', required: false },
        { name: 'Vercel CLI', command: 'vercel', required: false },
        { name: 'Docker', command: 'docker', required: false }
    ];
    
    for (const check of checks) {
        const available = checkCommand(check.command);
        const status = available ? '✅' : (check.required ? '❌' : '⚠️');
        const color = available ? 'green' : (check.required ? 'red' : 'yellow');
        log(`${status} ${check.name}`, color);
        
        if (!available && check.required) {
            log(`请安装 ${check.name}`, 'red');
            return false;
        }
    }
    
    return true;
}

async function main() {
    try {
        // 环境检查
        if (!await checkEnvironment()) {
            log('\n❌ 环境检查失败，请安装必需的工具', 'red');
            return;
        }
        
        const platform = await selectPlatform();
        
        switch (platform) {
            case '1':
                await deployToCloudflarePages();
                break;
            case '2':
                await deployToVercel();
                break;
            case '3':
                await deployToRailway();
                break;
            case '4':
                log('\n🌊 Netlify 部署说明:', 'yellow');
                log('请参考 README.md 中的 Netlify 部署章节', 'cyan');
                break;
            case '5':
                await buildDocker();
                break;
            case '6':
                await showDeploymentGuide();
                break;
            default:
                log('❌ 无效选择', 'red');
        }
        
        log('\n🎉 操作完成！', 'green');
        log('📖 完整文档：README.md', 'cyan');
        
    } catch (error) {
        log(`\n💥 发生错误: ${error.message}`, 'red');
    } finally {
        rl.close();
    }
}

// 检查是否直接运行
if (require.main === module) {
    main();
}

module.exports = { main };
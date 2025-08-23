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
    log('1. ☁️ Cloudflare Pages (推荐 - 前后端统一部署)', 'green');
    log('2. 🌟 Vercel (零配置，全球 CDN)', 'green');
    log('3. 🚄 Railway (优秀开发体验，内置数据库)', 'green');
    log('4. 🌊 Netlify (函数 + 静态站点)', 'green');
    log('5. 🐳 Docker (本地构建镜像)', 'green');
    log('6. 📖 仅显示部署指南', 'blue');
    
    const answer = await ask('\n请选择部署方式 (1-6): ');
    return answer;
}

async function deployToCloudflarePages() {
    log('\n☁️ Cloudflare Pages 全栈部署...', 'yellow');
    
    // 检查项目结构
    const frontendDir = path.join(__dirname, 'totp-manager-frontend');
    const functionsDir = path.join(__dirname, 'functions');
    
    if (!fs.existsSync(frontendDir)) {
        log('❌ 前端目录不存在', 'red');
        return false;
    }
    
    if (!fs.existsSync(functionsDir)) {
        log('❌ Functions 目录不存在', 'red');
        return false;
    }
    
    log('✅ 项目结构检查完成', 'green');
    
    log('\n📝 Cloudflare Pages 全栈部署指南:', 'cyan');
    log('1. 推送代码到 GitHub 仓库', 'white');
    log('2. 访问 https://dash.cloudflare.com/', 'white');
    log('3. 选择 "Pages" → "Create a project"', 'white');
    log('4. 连接您的 GitHub 仓库', 'white');
    log('5. 设置构建配置：', 'white');
    log('   Framework: Create React App', 'cyan');
    log('   Build command: cd totp-manager-frontend && npm ci && npm run build', 'cyan');
    log('   Build output: totp-manager-frontend/build', 'cyan');
    log('   Root directory: (留空)', 'cyan');
    log('6. 设置环境变量：', 'white');
    log('   NODE_VERSION=18', 'cyan');
    log('   JWT_SECRET=your-super-secret-jwt-key', 'cyan');
    log('   REACT_APP_API_BASE_URL=(留空，使用相对路径)', 'cyan');
    log('   REACT_APP_GITHUB_AUTH_URL=/api/github/auth', 'cyan');
    
    log('\n✨ 优势：', 'yellow');
    log('- 前后端同一域名，无跨域问题', 'green');
    log('- 自动 HTTPS 证书', 'green');
    log('- 全球 CDN 加速', 'green');
    log('- 无限免费使用', 'green');
    log('- 无需复杂的 wrangler 配置', 'green');
    
    log('\n✅ 全栈部署指南完成！', 'green');
    log('🚀 现在请按照上述步骤在 Cloudflare Pages 中部署您的项目', 'cyan');
    
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
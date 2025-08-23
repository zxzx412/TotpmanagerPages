/**
 * Cloudflare Pages Functions API 适配器
 * 将 Express.js 应用适配到 Cloudflare Pages Functions
 */

// 动态导入所需模块
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { nanoid } from 'nanoid';
import axios from 'axios';

// SQLite 模拟实现 (使用 Cloudflare D1 或 KV)
class MockSQLite {
    constructor(env) {
        this.env = env;
        this.kv = env.KV_STORE || null;
    }

    async get(sql, params = []) {
        // 简化的实现，实际应使用 D1 数据库
        if (sql.includes('SELECT * FROM users WHERE username')) {
            const username = params[0];
            const userData = await this.kv?.get(`user:${username}`);
            return userData ? JSON.parse(userData) : null;
        }
        return null;
    }

    async all(sql, params = []) {
        // 简化的实现，实际应使用 D1 数据库
        if (sql.includes('SELECT * FROM totps WHERE user_id')) {
            const userId = params[0];
            const totpsData = await this.kv?.get(`totps:${userId}`);
            return totpsData ? JSON.parse(totpsData) : [];
        }
        return [];
    }

    async run(sql, params = []) {
        // 简化的实现，实际应使用 D1 数据库
        if (sql.includes('INSERT INTO users')) {
            const [username, passwordHash] = params;
            const userData = {
                id: nanoid(),
                username,
                password_hash: passwordHash,
                created_at: new Date().toISOString()
            };
            await this.kv?.put(`user:${username}`, JSON.stringify(userData));
            return { lastID: userData.id };
        }
        return { lastID: nanoid() };
    }
}

// 创建 Express 应用
function createApp(env) {
    const app = express();
    
    // 中间件
    app.use(helmet({
        contentSecurityPolicy: false
    }));
    
    app.use(cors({
        origin: env.FRONTEND_URL || '*',
        credentials: true
    }));
    
    app.use(express.json({ limit: '10mb' }));

    // 模拟数据库
    const db = new MockSQLite(env);

    // JWT 中间件
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        jwt.verify(token, env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
            req.user = user;
            next();
        });
    };

    // 用户注册
    app.post('/api/register', async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            // 检查用户是否已存在
            const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
            if (existingUser) {
                return res.status(400).json({ error: 'Username already exists. Please choose a different one.' });
            }

            // 密码加密
            const passwordHash = await bcrypt.hash(password, 12);

            // 创建用户
            const result = await db.run(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                [username, passwordHash]
            );

            // 生成JWT令牌
            const token = jwt.sign(
                { userId: result.lastID, username },
                env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.status(201).json({
                message: 'User registered successfully',
                token,
                user: { id: result.lastID, username }
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    });

    // 用户登录
    app.post('/api/login', async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            // 查找用户
            const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
            if (!user) {
                return res.status(401).json({ error: 'Invalid username. User not found.' });
            }

            // 验证密码
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            // 生成JWT令牌
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({
                message: 'Login successful',
                token,
                user: { id: user.id, username: user.username }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    });

    // 获取 TOTP 列表
    app.get('/api/totp', authenticateToken, async (req, res) => {
        try {
            const totps = await db.all('SELECT * FROM totps WHERE user_id = ?', [req.user.userId]);
            res.json(totps);
        } catch (error) {
            console.error('Get TOTPs error:', error);
            res.status(500).json({ error: 'Failed to fetch TOTPs' });
        }
    });

    // 添加 TOTP
    app.post('/api/totp', authenticateToken, async (req, res) => {
        try {
            const { userInfo, secret } = req.body;

            if (!userInfo || !secret) {
                return res.status(400).json({ error: 'User info and secret are required' });
            }

            const id = nanoid();
            await db.run(
                'INSERT INTO totps (id, user_id, user_info, secret) VALUES (?, ?, ?, ?)',
                [id, req.user.userId, userInfo, secret]
            );

            res.status(201).json({
                message: 'TOTP added successfully',
                id,
                userInfo,
                secret
            });
        } catch (error) {
            console.error('Add TOTP error:', error);
            res.status(500).json({ error: 'Failed to add TOTP' });
        }
    });

    // 生成令牌
    app.get('/api/totp/:id/generate', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const totp = await db.get('SELECT * FROM totps WHERE id = ? AND user_id = ?', [id, req.user.userId]);

            if (!totp) {
                return res.status(404).json({ error: 'TOTP not found' });
            }

            const token = authenticator.generate(totp.secret);
            res.json({ token });
        } catch (error) {
            console.error('Generate token error:', error);
            res.status(500).json({ error: 'Failed to generate token' });
        }
    });

    return app;
}

// Cloudflare Pages Functions 处理器
export async function onRequest(context) {
    const { request, env } = context;
    
    try {
        // 创建 Express 应用
        const app = createApp(env);
        
        // 将 Cloudflare Request 转换为 Express 兼容的请求
        const url = new URL(request.url);
        const method = request.method;
        const headers = Object.fromEntries(request.headers);
        
        // 获取请求体
        let body = null;
        if (method !== 'GET' && method !== 'HEAD') {
            const contentType = headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                body = await request.json();
            }
        }

        // 模拟 Express 请求/响应对象
        const req = {
            method,
            url: url.pathname + url.search,
            headers,
            body,
            user: null
        };

        const res = {
            statusCode: 200,
            headers: {},
            body: null,
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                this.headers['content-type'] = 'application/json';
                this.body = JSON.stringify(data);
                return this;
            },
            send: function(data) {
                this.body = data;
                return this;
            }
        };

        // 路由处理 (简化版)
        if (req.url.startsWith('/api/register') && method === 'POST') {
            await handleRegister(req, res, env);
        } else if (req.url.startsWith('/api/login') && method === 'POST') {
            await handleLogin(req, res, env);
        } else if (req.url.startsWith('/api/totp') && method === 'GET') {
            await handleGetTotps(req, res, env);
        } else {
            res.status(404).json({ error: 'Not found' });
        }

        // 返回 Cloudflare Response
        return new Response(res.body, {
            status: res.statusCode,
            headers: res.headers
        });

    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
        });
    }
}

// 简化的处理函数
async function handleRegister(req, res, env) {
    // 实现注册逻辑
    res.json({ message: 'Registration endpoint' });
}

async function handleLogin(req, res, env) {
    // 实现登录逻辑
    res.json({ message: 'Login endpoint' });
}

async function handleGetTotps(req, res, env) {
    // 实现获取TOTP列表逻辑
    res.json([]);
}
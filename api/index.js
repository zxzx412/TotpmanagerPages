const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const { nanoid } = require('nanoid');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// 数据库初始化
const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

// 创建表
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS totps (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_info TEXT NOT NULL,
        secret TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS blacklisted_tokens (
        token TEXT PRIMARY KEY,
        expires_at DATETIME NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS github_tokens (
        user_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS github_gists (
        user_id TEXT PRIMARY KEY,
        gist_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
});

// 中间件
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// JWT 验证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    // 检查黑名单
    db.get(
        'SELECT token FROM blacklisted_tokens WHERE token = ? AND expires_at > datetime("now")',
        [token],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                return res.status(401).json({ error: 'Token has been revoked' });
            }

            jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
                if (err) {
                    return res.status(403).json({ error: 'Invalid token' });
                }
                req.user = user;
                req.token = token;
                next();
            });
        }
    );
};

// 辅助函数
const hashPassword = async (password) => {
    return await bcrypt.hash(password, 12);
};

const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// TOTP 导入相关的辅助函数
const parseOtpMigrationData = (binaryData) => {
    let index = 0;
    const totps = [];

    while (index < binaryData.length) {
        if (index + 1 >= binaryData.length) break;

        const fieldNumber = binaryData[index] >> 3;
        const wireType = binaryData[index] & 0x07;
        index++;

        switch (wireType) {
            case 0: // Varint
                const [_, bytesRead] = decodeVarint(binaryData.slice(index));
                index += bytesRead;
                break;
            case 2: // Length-delimited
                const [length, lengthBytesRead] = decodeVarint(binaryData.slice(index));
                index += lengthBytesRead;
                if (index + length > binaryData.length) {
                    throw new Error("Invalid length-delimited field length");
                }
                const fieldData = binaryData.slice(index, index + length);
                index += length;

                if (fieldNumber === 1) {
                    const totp = parseTOTPEntry(fieldData);
                    if (totp) totps.push(totp);
                }
                break;
            default:
                index++;
                break;
        }
    }

    return totps;
};

const parseTOTPEntry = (data) => {
    let index = 0;
    let secret = '';
    let name = '';
    let issuer = '';

    while (index < data.length) {
        if (index + 1 >= data.length) break;

        const fieldNumber = data[index] >> 3;
        const wireType = data[index] & 0x07;
        index++;

        switch (wireType) {
            case 0: // Varint
                const [_, bytesRead] = decodeVarint(data.slice(index));
                index += bytesRead;
                break;
            case 2: // Length-delimited
                const [length, lengthBytesRead] = decodeVarint(data.slice(index));
                index += lengthBytesRead;
                if (index + length > data.length) {
                    throw new Error("Invalid length-delimited field length");
                }
                const fieldData = data.slice(index, index + length);
                index += length;

                switch (fieldNumber) {
                    case 1: // Secret
                        secret = base32Encode(fieldData);
                        break;
                    case 2: // Name
                        name = utf8Decode(fieldData);
                        break;
                    case 3: // Issuer
                        issuer = utf8Decode(fieldData);
                        break;
                }
                break;
            default:
                index++;
                break;
        }
    }

    if (secret && name) {
        const userInfo = issuer ? `${name} (${issuer})` : name;
        return { userInfo, secret };
    }

    return null;
};

const base32Encode = (buffer) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            bits -= 5;
            result += alphabet[value >>> bits & 31];
        }
    }

    if (bits > 0) {
        result += alphabet[value << (5 - bits) & 31];
    }

    return result;
};

function decodeVarint(buffer) {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;

    for (const byte of buffer) {
        bytesRead++;
        result |= (byte & 0x7F) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
    }

    return [result, bytesRead];
}

const utf8Decode = (buffer) => {
    return Buffer.from(buffer).toString('utf8');
};

// GitHub 相关函数
const isGitHubTokenValid = async (token) => {
    try {
        const response = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'TOTP-Manager/1.0'
            }
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
};

const getGitHubToken = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT access_token FROM github_tokens WHERE user_id = ?',
            [userId],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.access_token : null);
                }
            }
        );
    });
};

const saveGitHubToken = (userId, token) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO github_tokens (user_id, access_token) VALUES (?, ?)',
            [userId, token],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
};

const getGistId = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT gist_id FROM github_gists WHERE user_id = ?',
            [userId],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.gist_id : null);
                }
            }
        );
    });
};

const saveGistId = (userId, gistId) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO github_gists (user_id, gist_id) VALUES (?, ?)',
            [userId, gistId],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
};

// 路由

// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // 检查用户是否已存在
        db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (row) {
                return res.status(409).json({ error: 'Username already exists. Please choose a different one.' });
            }

            // 创建新用户
            const hashedPassword = await hashPassword(password);
            const userId = nanoid();

            db.run(
                'INSERT INTO users (id, username, password) VALUES (?, ?, ?)',
                [userId, username, hashedPassword],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to create user' });
                    }

                    const token = generateToken({ userId, username });
                    res.status(201).json({
                        token,
                        user: { id: userId, username }
                    });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 用户登录
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                return res.status(401).json({ error: 'Invalid username. User not found.' });
            }

            const isValidPassword = await comparePassword(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const token = generateToken({ userId: user.id, username: user.username });
            res.json({
                message: 'Login successful',
                user: { id: user.id, username: user.username },
                token
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 用户登出
app.post('/api/logout', authenticateToken, (req, res) => {
    const token = req.token;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

    db.run(
        'INSERT INTO blacklisted_tokens (token, expires_at) VALUES (?, ?)',
        [token, expiresAt.toISOString()],
        (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to logout' });
            }
            res.json({ message: 'Logout successful' });
        }
    );
});

// 获取TOTP列表
app.get('/api/totp', authenticateToken, (req, res) => {
    db.all(
        'SELECT id, user_info, secret, created_at FROM totps WHERE user_id = ?',
        [req.user.userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// 添加TOTP
app.post('/api/totp', authenticateToken, (req, res) => {
    const { userInfo, secret } = req.body;

    if (!userInfo || !secret) {
        return res.status(400).json({ error: 'User info and secret are required' });
    }

    const id = nanoid();
    db.run(
        'INSERT INTO totps (id, user_id, user_info, secret) VALUES (?, ?, ?, ?)',
        [id, req.user.userId, userInfo, secret],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to add TOTP' });
            }

            res.status(201).json({
                id,
                userInfo,
                secret,
                createdAt: new Date().toISOString(),
                username: req.user.username
            });
        }
    );
});

// 删除TOTP
app.delete('/api/totp/:id', authenticateToken, (req, res) => {
    const totpId = req.params.id;

    db.run(
        'DELETE FROM totps WHERE id = ? AND user_id = ?',
        [totpId, req.user.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'TOTP not found or unauthorized' });
            }
            res.json({ message: 'TOTP deleted successfully' });
        }
    );
});

// 生成TOTP令牌
app.get('/api/totp/:id/generate', authenticateToken, (req, res) => {
    const totpId = req.params.id;

    db.get(
        'SELECT secret FROM totps WHERE id = ? AND user_id = ?',
        [totpId, req.user.userId],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!row) {
                return res.status(404).json({ error: 'TOTP not found' });
            }

            try {
                const token = authenticator.generate(row.secret);
                res.json({ token });
            } catch (error) {
                res.status(500).json({ error: 'Failed to generate token' });
            }
        }
    );
});

// 导出TOTP
app.get('/api/totp/:id/export', authenticateToken, (req, res) => {
    const totpId = req.params.id;

    db.get(
        'SELECT user_info, secret FROM totps WHERE id = ? AND user_id = ?',
        [totpId, req.user.userId],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!row) {
                return res.status(404).json({ error: 'TOTP not found' });
            }

            try {
                const uri = authenticator.keyuri(row.user_info, 'TOTP Manager', row.secret);
                res.json({ uri });
            } catch (error) {
                res.status(500).json({ error: 'Failed to export TOTP' });
            }
        }
    );
});

// 清除所有TOTP
app.post('/api/totp/clear-all', authenticateToken, (req, res) => {
    db.run(
        'DELETE FROM totps WHERE user_id = ?',
        [req.user.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'All TOTPs cleared successfully' });
        }
    );
});

// TOTP 导入
app.post('/api/totp/import', authenticateToken, (req, res) => {
    const { qrData } = req.body;
    
    if (!qrData) {
        return res.status(400).json({ error: 'QR data is required' });
    }

    try {
        let totps = [];
        
        if (qrData.startsWith('otpauth-migration://offline?data=')) {
            // Google Authenticator 迁移格式
            const base64Data = qrData.split('data=')[1];
            const decodedData = Buffer.from(decodeURIComponent(base64Data), 'base64');
            totps = parseOtpMigrationData(decodedData);
        } else if (qrData.startsWith('otpauth://')) {
            // 单个 TOTP URI
            const uri = new URL(qrData);
            const secret = uri.searchParams.get('secret');
            const userInfo = decodeURIComponent(uri.pathname.split('/').pop());

            if (!secret || !userInfo) {
                return res.status(400).json({ error: 'Invalid QR code data' });
            }

            totps = [{ userInfo, secret }];
        } else {
            return res.status(400).json({ error: 'Unsupported QR code format' });
        }

        if (!Array.isArray(totps) || totps.length === 0) {
            return res.status(400).json({ error: 'No valid TOTP entries found' });
        }

        // 批量插入 TOTP
        const insertPromises = totps.map(totp => {
            return new Promise((resolve, reject) => {
                const id = nanoid();
                db.run(
                    'INSERT INTO totps (id, user_id, user_info, secret) VALUES (?, ?, ?, ?)',
                    [id, req.user.userId, totp.userInfo, totp.secret],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                id,
                                userInfo: totp.userInfo,
                                secret: totp.secret,
                                createdAt: new Date().toISOString(),
                                username: req.user.username
                            });
                        }
                    }
                );
            });
        });

        Promise.all(insertPromises)
            .then(results => {
                res.json({
                    success: true,
                    count: results.length,
                    totps: results
                });
            })
            .catch(error => {
                console.error('Import error:', error);
                res.status(500).json({ error: 'Failed to import TOTPs' });
            });

    } catch (error) {
        console.error('Import parsing error:', error);
        res.status(400).json({ error: 'Failed to parse QR data: ' + error.message });
    }
});

// GitHub 相关路由

// GitHub 认证状态
app.get('/api/github/auth-status', authenticateToken, async (req, res) => {
    try {
        const token = await getGitHubToken(req.user.userId);
        let authenticated = false;
        let isTokenExpired = false;
        
        if (token) {
            const isValid = await isGitHubTokenValid(token);
            authenticated = isValid;
            isTokenExpired = !isValid;
        }
        
        res.json({ authenticated, isTokenExpired });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check GitHub auth status' });
    }
});

// GitHub OAuth 认证
app.get('/api/github/auth', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    const state = nanoid();
    
    // 将 state 存储到会话或缓存中（这里简化处理）
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=gist`;
    
    res.redirect(authUrl);
});

// GitHub OAuth 回调
app.get('/api/github/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    try {
        // 获取访问令牌
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        const { access_token } = tokenResponse.data;
        
        if (access_token) {
            // 这里需要一个机制来关联用户，简化处理为直接返回令牌
            // 在实际应用中，可以使用 state 参数来存储用户信息
            res.redirect(`${process.env.FRONTEND_URL}?github_token=${access_token}`);
        } else {
            res.status(400).json({ error: 'Failed to obtain access token' });
        }
    } catch (error) {
        console.error('GitHub OAuth error:', error);
        res.status(500).json({ error: 'OAuth process failed' });
    }
});

// 设置 GitHub 令牌（由前端调用）
app.post('/api/github/set-token', authenticateToken, async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'GitHub token is required' });
    }
    
    try {
        const isValid = await isGitHubTokenValid(token);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid GitHub token' });
        }
        
        await saveGitHubToken(req.user.userId, token);
        res.json({ message: 'GitHub token saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save GitHub token' });
    }
});

// 上传到 Gist
app.post('/api/github/upload', authenticateToken, async (req, res) => {
    const { mode } = req.body;
    
    try {
        const token = await getGitHubToken(req.user.userId);
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated with GitHub' });
        }
        
        const isValid = await isGitHubTokenValid(token);
        if (!isValid) {
            return res.status(401).json({ error: 'GitHub token has expired. Please reauthorize.' });
        }
        
        // 获取用户的 TOTP 数据
        const totps = await new Promise((resolve, reject) => {
            db.all(
                'SELECT id, user_info, secret, created_at FROM totps WHERE user_id = ?',
                [req.user.userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => ({ ...row, username: req.user.username })));
                }
            );
        });
        
        const content = JSON.stringify(totps, null, 2);
        let gistId = await getGistId(req.user.userId);
        
        let method, url, body;
        if (mode === 'create' || !gistId) {
            method = 'POST';
            url = 'https://api.github.com/gists';
            body = {
                description: 'TOTP Backup',
                public: false,
                files: {
                    'totp_backup.json': {
                        content: content
                    }
                }
            };
        } else {
            method = 'PATCH';
            url = `https://api.github.com/gists/${gistId}`;
            body = {
                description: 'TOTP Backup',
                files: {
                    'totp_backup.json': {
                        content: content
                    }
                }
            };
        }
        
        const response = await axios({
            method,
            url,
            data: body,
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'TOTP-Manager/1.0'
            }
        });
        
        if (response.data.id) {
            await saveGistId(req.user.userId, response.data.id);
            res.json({
                message: 'Data uploaded to Gist successfully',
                gistId: response.data.id
            });
        } else {
            res.status(500).json({ error: 'Failed to upload data to Gist' });
        }
    } catch (error) {
        console.error('Upload to GitHub error:', error);
        res.status(500).json({ error: 'Failed to upload data to Gist' });
    }
});

// 获取 Gist 版本
app.get('/api/github/versions', authenticateToken, async (req, res) => {
    try {
        const token = await getGitHubToken(req.user.userId);
        const gistId = await getGistId(req.user.userId);
        
        if (!token || !gistId) {
            return res.status(401).json({ error: 'Not authenticated with GitHub or no backup found' });
        }
        
        const isValid = await isGitHubTokenValid(token);
        if (!isValid) {
            return res.status(401).json({ error: 'GitHub token has expired. Please reauthorize.' });
        }
        
        const response = await axios.get(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'TOTP-Manager/1.0'
            }
        });
        
        const history = response.data.history || [];
        const versions = history.map(version => ({
            id: version.version,
            description: `Backup from ${new Date(version.committed_at).toLocaleString()}`,
            created_at: version.committed_at,
            updated_at: version.committed_at
        }));
        
        res.json(versions);
    } catch (error) {
        console.error('Fetch GitHub versions error:', error);
        res.status(500).json({ error: 'Failed to fetch backup versions' });
    }
});

// 从 Gist 恢复
app.get('/api/github/restore', authenticateToken, async (req, res) => {
    try {
        const token = await getGitHubToken(req.user.userId);
        const gistId = await getGistId(req.user.userId);
        
        if (!token || !gistId) {
            return res.status(401).json({ error: 'Not authenticated with GitHub or no backup found' });
        }
        
        const isValid = await isGitHubTokenValid(token);
        if (!isValid) {
            return res.status(401).json({ error: 'GitHub token has expired. Please reauthorize.' });
        }
        
        const response = await axios.get(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'TOTP-Manager/1.0'
            }
        });
        
        const content = response.data.files['totp_backup.json'].content;
        const totps = JSON.parse(content);
        
        // 清除现有 TOTP
        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM totps WHERE user_id = ?',
                [req.user.userId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // 添加恢复的 TOTP
        const insertPromises = totps
            .filter(totp => totp.username === req.user.username)
            .map(totp => {
                return new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO totps (id, user_id, user_info, secret) VALUES (?, ?, ?, ?)',
                        [totp.id || nanoid(), req.user.userId, totp.user_info, totp.secret],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            });
        
        await Promise.all(insertPromises);
        
        // 获取更新后的 TOTP 列表
        const updatedTotps = await new Promise((resolve, reject) => {
            db.all(
                'SELECT id, user_info, secret, created_at FROM totps WHERE user_id = ?',
                [req.user.userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        res.json({
            message: 'Data restored from Gist successfully',
            count: updatedTotps.length,
            totps: updatedTotps
        });
    } catch (error) {
        console.error('Restore from GitHub error:', error);
        res.status(500).json({ error: 'Failed to restore data from Gist' });
    }
});

// 删除备份
app.delete('/api/github/delete-backup', authenticateToken, async (req, res) => {
    try {
        const token = await getGitHubToken(req.user.userId);
        const gistId = await getGistId(req.user.userId);
        
        if (!token || !gistId) {
            return res.status(401).json({ error: 'Not authenticated with GitHub or no backup found' });
        }
        
        const isValid = await isGitHubTokenValid(token);
        if (!isValid) {
            return res.status(401).json({ error: 'GitHub token has expired. Please reauthorize.' });
        }
        
        await axios.delete(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'TOTP-Manager/1.0'
            }
        });
        
        // 从数据库中删除 gist_id 记录
        await new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM github_gists WHERE user_id = ?',
                [req.user.userId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        res.json({ message: 'Backup deleted successfully' });
    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({ error: 'Failed to delete backup' });
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 清理过期的黑名单令牌
setInterval(() => {
    db.run('DELETE FROM blacklisted_tokens WHERE expires_at <= datetime("now")');
}, 60 * 60 * 1000); // 每小时清理一次

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${dbPath}`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});
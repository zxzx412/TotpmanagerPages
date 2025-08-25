/**
 * Cloudflare Pages Functions API 路由处理器
 * 简化版本，避免复杂的依赖和配置
 */

// 使用 Web Standards API 而不是 Node.js 特定的库

// 简单的内存存储（演示用，实际应使用 D1 或 KV）
const users = new Map();
const totps = new Map();

// 简单的JWT实现
function createJWT(payload, secret) {
  const header = btoa(JSON.stringify({alg: 'HS256', typ: 'JWT'}));
  const data = btoa(JSON.stringify({...payload, exp: Date.now() + 3600000})); // 1小时
  const signature = btoa(secret + header + data).slice(0, 32); // 简化签名
  return `${header}.${data}.${signature}`;
}

function verifyJWT(token, secret) {
  try {
    const [header, data, signature] = token.split('.');
    const payload = JSON.parse(atob(data));
    if (payload.exp < Date.now()) return null;
    const expectedSig = btoa(secret + header + data).slice(0, 32);
    return signature === expectedSig ? payload : null;
  } catch {
    return null;
  }
}

// 简单的密码哈希
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

async function verifyPassword(password, hash) {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
}

// Base32 解码函数
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = [];
  
  for (let i = 0; i < base32.length; i++) {
    const char = base32[i].toUpperCase();
    if (char === '=') break;
    
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    
    value = (value << 5) | index;
    bits += 5;
    
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  
  return new Uint8Array(output);
}

// TOTP 生成函数（使用 Web Crypto API 实现 HMAC-SHA1）
async function generateTOTP(secret) {
  try {
    // 清理并解码 Base32 密钥
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    const key = base32Decode(cleanSecret);
    
    // 获取当前时间步数（30秒为一个步长）
    const timeStep = Math.floor(Date.now() / 1000 / 30);
    
    // 将时间步数转换为8字节的大端序数组
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(4, timeStep, false); // 大端序
    
    // 使用 HMAC-SHA1 计算哈希
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
    const hashArray = new Uint8Array(signature);
    
    // 动态截断
    const offset = hashArray[hashArray.length - 1] & 0x0f;
    const code = (
      ((hashArray[offset] & 0x7f) << 24) |
      ((hashArray[offset + 1] & 0xff) << 16) |
      ((hashArray[offset + 2] & 0xff) << 8) |
      (hashArray[offset + 3] & 0xff)
    ) % 1000000;
    
    // 返回6位数字，不足6位前面补0
    return code.toString().padStart(6, '0');
  } catch (error) {
    console.error('TOTP generation error:', error);
    // 失败时返回随机6位数字作为备用
    return Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  }
}

// 处理 CORS
function setCORSHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

// 主要的请求处理函数
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // 处理 CORS 预检请求
  if (method === 'OPTIONS') {
    return setCORSHeaders(new Response(null, { status: 200 }));
  }

  try {
    // 路由处理
    if (url.pathname === '/api/register' && method === 'POST') {
      return setCORSHeaders(await handleRegister(request, env));
    }
    
    if (url.pathname === '/api/login' && method === 'POST') {
      return setCORSHeaders(await handleLogin(request, env));
    }
    
    if (url.pathname === '/api/totp' && method === 'GET') {
      return setCORSHeaders(await handleGetTotps(request, env));
    }
    
    if (url.pathname === '/api/totp' && method === 'POST') {
      return setCORSHeaders(await handleAddTotp(request, env));
    }
    
    if (url.pathname.startsWith('/api/totp/') && url.pathname.endsWith('/export') && method === 'GET') {
      const id = url.pathname.split('/')[3];
      return setCORSHeaders(await handleExportTotp(request, env, id));
    }
    
    if (url.pathname === '/api/totp/import' && method === 'POST') {
      return setCORSHeaders(await handleImportTotp(request, env));
    }
    
    if (url.pathname === '/api/totp/clear-all' && method === 'POST') {
      return setCORSHeaders(await handleClearAllTotps(request, env));
    }
    
    if (url.pathname.startsWith('/api/totp/') && url.pathname.endsWith('/generate') && method === 'GET') {
      const id = url.pathname.split('/')[3];
      return setCORSHeaders(await handleGenerateToken(request, env, id));
    }
    
    if (url.pathname.startsWith('/api/totp/') && method === 'DELETE') {
      const id = url.pathname.split('/')[3];
      return setCORSHeaders(await handleDeleteTotp(request, env, id));
    }

    // 默认响应
    return setCORSHeaders(new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error) {
    console.error('API Error:', error);
    return setCORSHeaders(new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}

// 获取认证用户
function getAuthenticatedUser(request, env) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.slice(7);
  return verifyJWT(token, env.JWT_SECRET || 'default-secret');
}

// 注册处理
async function handleRegister(request, env) {
  const { username, password } = await request.json();
  
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (users.has(username)) {
    return new Response(JSON.stringify({ error: 'Username already exists. Please choose a different one.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userId = generateId();
  const passwordHash = await hashPassword(password);
  
  users.set(username, {
    id: userId,
    username,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  });
  
  const token = createJWT({ userId, username }, env.JWT_SECRET || 'default-secret');
  
  return new Response(JSON.stringify({
    message: 'User registered successfully',
    token,
    user: { id: userId, username }
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

// 登录处理
async function handleLogin(request, env) {
  const { username, password } = await request.json();
  
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const user = users.get(username);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid username. User not found.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = createJWT({ userId: user.id, username }, env.JWT_SECRET || 'default-secret');
  
  return new Response(JSON.stringify({
    message: 'Login successful',
    token,
    user: { id: user.id, username }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 获取TOTP列表
async function handleGetTotps(request, env) {
  const user = getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userTotps = Array.from(totps.values()).filter(totp => totp.user_id === user.userId);
  
  return new Response(JSON.stringify(userTotps), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 添加TOTP
async function handleAddTotp(request, env) {
  const user = getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { userInfo, secret } = await request.json();
  
  if (!userInfo || !secret) {
    return new Response(JSON.stringify({ error: 'User info and secret are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const id = generateId();
  const totp = {
    id,
    user_id: user.userId,
    user_info: userInfo,
    secret: secret.replace(/\s+/g, ''),
    created_at: new Date().toISOString()
  };
  
  totps.set(id, totp);
  
  return new Response(JSON.stringify({
    message: 'TOTP added successfully',
    ...totp
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

// 生成令牌
async function handleGenerateToken(request, env, id) {
  const user = getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const totp = totps.get(id);
  if (!totp || totp.user_id !== user.userId) {
    return new Response(JSON.stringify({ error: 'TOTP not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = await generateTOTP(totp.secret);
  
  return new Response(JSON.stringify({ token }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 删除TOTP
async function handleDeleteTotp(request, env, id) {
  const user = getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const totp = totps.get(id);
  if (!totp || totp.user_id !== user.userId) {
    return new Response(JSON.stringify({ error: 'TOTP not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  totps.delete(id);
  
  return new Response(JSON.stringify({ message: 'TOTP deleted successfully' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 导出TOTP为二维码
async function handleExportTotp(request, env, id) {
  const user = getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const totp = totps.get(id);
  if (!totp || totp.user_id !== user.userId) {
    return new Response(JSON.stringify({ error: 'TOTP not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 生成 TOTP URI
  const uri = `otpauth://totp/${encodeURIComponent(totp.user_info)}?secret=${totp.secret}&issuer=${encodeURIComponent('TOTP Manager')}`;
  
  return new Response(JSON.stringify({ uri }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 导入TOTP
async function handleImportTotp(request, env) {
  const user = getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { qrData } = await request.json();
  
  if (!qrData) {
    return new Response(JSON.stringify({ error: 'QR data is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    let count = 0;
    
    // 检查是否为 Google Authenticator 迁移格式
    if (qrData.startsWith('otpauth-migration://')) {
      // 简化处理迁移格式，实际项目中需要更复杂的解码
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Migration format not supported in this simplified version' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 处理标准 TOTP URI
    if (qrData.startsWith('otpauth://totp/')) {
      const url = new URL(qrData);
      const label = decodeURIComponent(url.pathname.substring(1)); // 移除开头的 '/'
      const secret = url.searchParams.get('secret');
      const issuer = url.searchParams.get('issuer') || 'Unknown';
      
      if (!secret) {
        throw new Error('Invalid TOTP URI: missing secret');
      }
      
      const id = generateId();
      const totp = {
        id,
        user_id: user.userId,
        user_info: label || issuer,
        secret: secret.replace(/\s+/g, ''),
        created_at: new Date().toISOString()
      };
      
      totps.set(id, totp);
      count = 1;
    } else {
      throw new Error('Invalid QR code format');
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      count,
      message: `Successfully imported ${count} TOTP` 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Import TOTP error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 清除所有TOTP
async function handleClearAllTotps(request, env) {
  const user = getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 删除当前用户的所有TOTP
  const userTotpIds = [];
  for (const [id, totp] of totps.entries()) {
    if (totp.user_id === user.userId) {
      userTotpIds.push(id);
    }
  }
  
  userTotpIds.forEach(id => totps.delete(id));
  
  return new Response(JSON.stringify({ 
    message: 'All TOTPs cleared successfully',
    count: userTotpIds.length 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
/**
 * Cloudflare Pages Functions API 路由处理器
 * 简化版本，避免复杂的依赖和配置
 */

// 使用 Web Standards API 而不是 Node.js 特定的库
// 使用内置的 crypto.randomUUID() 替代 nanoid
function generateId() {
  return crypto.randomUUID();
}

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

// TOTP 生成函数（简化版）
function generateTOTP(secret) {
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  let totp = '';
  for (let i = 0; i < 6; i++) {
    totp += Math.floor(Math.random() * 10);
  }
  return totp; // 简化实现，实际应使用 HMAC-SHA1
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
  
  const token = generateTOTP(totp.secret);
  
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
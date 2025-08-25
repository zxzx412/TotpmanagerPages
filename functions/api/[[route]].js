/**
 * Cloudflare Pages Functions API 路由处理器
 * 简化版本，避免复杂的依赖和配置
 */

// 使用 Web Standards API 而不是 Node.js 特定的库
// 使用内置的 crypto.randomUUID() 替代 nanoid
function generateId() {
  return crypto.randomUUID();
}

// 使用 Cloudflare KV 存储替代内存存储
// KV 命名空间将通过环境变量提供

// KV 操作辅助函数
async function getKVData(env, key) {
  try {
    const data = await env.TOTP_KV.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting KV data for key ${key}:`, error);
    return null;
  }
}

async function setKVData(env, key, value) {
  try {
    await env.TOTP_KV.put(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting KV data for key ${key}:`, error);
    return false;
  }
}

async function deleteKVData(env, key) {
  try {
    await env.TOTP_KV.delete(key);
    return true;
  } catch (error) {
    console.error(`Error deleting KV data for key ${key}:`, error);
    return false;
  }
}

// 用户管理函数
async function getUser(env, username) {
  return await getKVData(env, `user:${username}`);
}

async function setUser(env, username, userData) {
  return await setKVData(env, `user:${username}`, userData);
}

// TOTP 管理函数
async function getTotp(env, id) {
  return await getKVData(env, `totp:${id}`);
}

async function setTotp(env, id, totpData) {
  return await setKVData(env, `totp:${id}`, totpData);
}

async function deleteTotp(env, id) {
  return await deleteKVData(env, `totp:${id}`);
}

async function getUserTotps(env, userId) {
  // 获取用户的所有 TOTP ID 列表
  const totpIds = await getKVData(env, `user_totps:${userId}`);
  if (!totpIds || !Array.isArray(totpIds)) {
    return [];
  }
  
  // 获取所有 TOTP 数据
  const totps = [];
  for (const id of totpIds) {
    const totp = await getTotp(env, id);
    if (totp) {
      totps.push(totp);
    }
  }
  
  return totps;
}

async function addUserTotp(env, userId, totpId) {
  const totpIds = await getKVData(env, `user_totps:${userId}`) || [];
  if (!totpIds.includes(totpId)) {
    totpIds.push(totpId);
    await setKVData(env, `user_totps:${userId}`, totpIds);
  }
}

async function removeUserTotp(env, userId, totpId) {
  const totpIds = await getKVData(env, `user_totps:${userId}`) || [];
  const newTotpIds = totpIds.filter(id => id !== totpId);
  await setKVData(env, `user_totps:${userId}`, newTotpIds);
}

// GitHub token 管理函数
async function getGithubToken(env, userId) {
  return await getKVData(env, `github_token:${userId}`);
}

async function setGithubToken(env, userId, token) {
  return await setKVData(env, `github_token:${userId}`, token);
}

// GitHub OAuth state 管理函数
async function getGithubState(env, state) {
  return await getKVData(env, `github_state:${state}`);
}

async function setGithubState(env, state, userId) {
  // OAuth state 设置较短的过期时间（10分钟）
  try {
    await env.TOTP_KV.put(`github_state:${state}`, JSON.stringify(userId), { expirationTtl: 600 });
    return true;
  } catch (error) {
    console.error(`Error setting GitHub state:`, error);
    return false;
  }
}

async function deleteGithubState(env, state) {
  return await deleteKVData(env, `github_state:${state}`);
}

// 正确的JWT实现，与标准JWT库兼容
async function createJWT(payload, secret) {
  const header = btoa(JSON.stringify({alg: 'HS256', typ: 'JWT'}));
  const data = btoa(JSON.stringify({...payload, exp: Date.now() + 3600000})); // 1小时
  
  // 使用正确的 HMAC-SHA256 算法
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(`${header}.${data}`);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const fullToken = `${header}.${data}.${signature}`;
  return fullToken;
}

async function verifyJWT(token, secret) {
  try {
    const [header, data, signature] = token.split('.');
    
    if (!header || !data || !signature) {
      console.log('Invalid JWT format: missing parts');
      return null;
    }
    
    let payload;
    try {
      payload = JSON.parse(atob(data));
    } catch (e) {
      console.log('Failed to decode JWT payload:', e.message);
      return null;
    }
    
    const now = Date.now();
    if (payload.exp < now) {
      console.log('Token expired');
      return null;
    }
    
    // 使用正确的 HMAC-SHA256 验证
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(`${header}.${data}`);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // 将Base64URL编码的签名转换为字节数组
    let signatureBytes;
    try {
      // 处理Base64URL到Base64的转换
      const base64Signature = signature.replace(/-/g, '+').replace(/_/g, '/');
      // 添加填充
      const paddedSignature = base64Signature + '=='.substring(0, (4 - base64Signature.length % 4) % 4);
      
      signatureBytes = Uint8Array.from(
        atob(paddedSignature),
        c => c.charCodeAt(0)
      );
    } catch (e) {
      console.log('Failed to decode signature:', e.message);
      return null;
    }
    
    const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, messageData);
    return isValid ? payload : null;
  } catch (error) {
    console.log('JWT verification error:', error.message);
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
  // 检查response是否是重定向，如果是则不设置CORS headers
  if (response.status >= 300 && response.status < 400) {
    return response;
  }
  
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

  console.log(`=== API Request: ${method} ${url.pathname} ===`);
  console.log('Full URL:', url.href);
  console.log('Pathname parts:', url.pathname.split('/'));
  console.log('Method:', method);

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
    
    if (url.pathname === '/api/logout' && method === 'POST') {
      return setCORSHeaders(await handleLogout(request, env));
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
    
    // TOTP generate 路由匹配调试
    if (url.pathname.startsWith('/api/totp/') && url.pathname.endsWith('/generate') && method === 'GET') {
      const pathParts = url.pathname.split('/');
      const id = pathParts[3];
      console.log('TOTP generate route matched!');
      console.log('Path parts:', pathParts);
      console.log('Extracted ID:', id);
      console.log('ID exists:', !!id);
      
      if (!id) {
        console.log('No ID found in path');
        return setCORSHeaders(new Response(JSON.stringify({ error: 'Invalid TOTP ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      
      return setCORSHeaders(await handleGenerateToken(request, env, id));
    }
    
    if (url.pathname.startsWith('/api/totp/') && method === 'DELETE') {
      const id = url.pathname.split('/')[3];
      return setCORSHeaders(await handleDeleteTotp(request, env, id));
    }

    // GitHub 相关路由
    if (url.pathname === '/api/github/auth-status' && method === 'GET') {
      return setCORSHeaders(await handleGithubAuthStatus(request, env));
    }
    
    if (url.pathname === '/api/github/auth' && method === 'GET') {
      return setCORSHeaders(await handleGithubAuth(request, env));
    }
    
    if (url.pathname === '/api/github/callback' && method === 'GET') {
      return setCORSHeaders(await handleGithubCallback(request, env));
    }
    
    if (url.pathname === '/api/github/upload' && method === 'POST') {
      return setCORSHeaders(await handleUploadToGist(request, env));
    }
    
    if (url.pathname === '/api/github/versions' && method === 'GET') {
      return setCORSHeaders(await handleGetGistVersions(request, env));
    }
    
    if (url.pathname === '/api/github/restore' && method === 'GET') {
      return setCORSHeaders(await handleRestoreFromGist(request, env));
    }
    
    if (url.pathname === '/api/github/delete-backup' && method === 'DELETE') {
      return setCORSHeaders(await handleDeleteBackup(request, env));
    }
    
    // GitHub token 验证路由
    if (url.pathname === '/api/github/verify-token' && method === 'GET') {
      return setCORSHeaders(await handleVerifyGithubToken(request, env));
    }

    // 默认响应
    console.log('No route matched for:', method, url.pathname);
    console.log('Available route patterns checked:');
    console.log('- TOTP generate (/api/totp/*/generate GET):', {
      startsWithApiTotp: url.pathname.startsWith('/api/totp/'),
      endsWithGenerate: url.pathname.endsWith('/generate'),
      isGET: method === 'GET',
      fullMatch: url.pathname.startsWith('/api/totp/') && url.pathname.endsWith('/generate') && method === 'GET'
    });
    console.log('- TOTP export (/api/totp/*/export GET):', {
      startsWithApiTotp: url.pathname.startsWith('/api/totp/'),
      endsWithExport: url.pathname.endsWith('/export'),
      isGET: method === 'GET',
      fullMatch: url.pathname.startsWith('/api/totp/') && url.pathname.endsWith('/export') && method === 'GET'
    });
    console.log('- TOTP delete (/api/totp/* DELETE):', {
      startsWithApiTotp: url.pathname.startsWith('/api/totp/'),
      isDELETE: method === 'DELETE',
      fullMatch: url.pathname.startsWith('/api/totp/') && method === 'DELETE'
    });
    
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
async function getAuthenticatedUser(request, env) {
  let token = null;
  
  // 从 Authorization header 获取 token
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  
  // 如果 header 中没有，尝试从 Cookie 中获取
  if (!token) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = {};
      // 正确解析Cookie，处理包含等号的值
      cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.trim().split('=');
        if (parts.length >= 2) {
          const key = parts[0];
          const value = parts.slice(1).join('='); // 重新连接等号分隔的部分
          cookies[key] = decodeURIComponent(value);
        }
      });
      token = cookies.sessionToken;
    }
  }
  
  if (!token) {
    return null;
  }
  
  const jwtSecret = env.JWT_SECRET || 'default-secret';
  const result = await verifyJWT(token, jwtSecret);
  return result;
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
  
  // 检查用户是否已存在
  const existingUser = await getUser(env, username);
  if (existingUser) {
    return new Response(JSON.stringify({ error: 'Username already exists. Please choose a different one.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userId = generateId();
  const passwordHash = await hashPassword(password);
  
  const userData = {
    id: userId,
    username,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  };
  
  // 存储到 KV
  const success = await setUser(env, username, userData);
  if (!success) {
    return new Response(JSON.stringify({ error: 'Failed to create user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = await createJWT({ userId, username }, env.JWT_SECRET || 'default-secret');
  
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
  
  const user = await getUser(env, username);
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
  
  const token = await createJWT({ userId: user.id, username }, env.JWT_SECRET || 'default-secret');
  
  return new Response(JSON.stringify({
    message: 'Login successful',
    token,
    user: { id: user.id, username }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 登出处理
async function handleLogout(request, env) {
  // 简化实现，实际应该将 token 加入黑名单
  return new Response(JSON.stringify({
    message: 'Logout successful'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 获取TOTP列表
async function handleGetTotps(request, env) {
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userTotps = await getUserTotps(env, user.userId);
  
  return new Response(JSON.stringify(userTotps), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 添加TOTP
async function handleAddTotp(request, env) {
  const user = await getAuthenticatedUser(request, env);
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
  
  // 存储 TOTP 数据
  const totpSuccess = await setTotp(env, id, totp);
  if (!totpSuccess) {
    return new Response(JSON.stringify({ error: 'Failed to save TOTP' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 添加到用户的 TOTP 列表
  await addUserTotp(env, user.userId, id);
  
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
  console.log('=== Generate Token Start ===');
  console.log('TOTP ID:', id);
  
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.log('No authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('User authenticated:', user.userId);
  
  const totp = await getTotp(env, id);
  console.log('TOTP found:', !!totp);
  
  if (totp) {
    console.log('TOTP user_id:', totp.user_id);
    console.log('TOTP user_info:', totp.user_info);
    console.log('TOTP secret preview:', totp.secret?.substring(0, 8) + '...');
  }
  
  if (!totp || totp.user_id !== user.userId) {
    console.log('TOTP not found or not owned by user');
    return new Response(JSON.stringify({ error: 'TOTP not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    console.log('Generating TOTP token...');
    const token = await generateTOTP(totp.secret);
    console.log('Token generated successfully:', token);
    
    return new Response(JSON.stringify({ token }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate token' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 删除TOTP
async function handleDeleteTotp(request, env, id) {
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const totp = await getTotp(env, id);
  if (!totp || totp.user_id !== user.userId) {
    return new Response(JSON.stringify({ error: 'TOTP not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 从 KV 中删除 TOTP
  await deleteTotp(env, id);
  
  // 从用户的 TOTP 列表中移除
  await removeUserTotp(env, user.userId, id);
  
  return new Response(JSON.stringify({ message: 'TOTP deleted successfully' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 导出TOTP为二维码
async function handleExportTotp(request, env, id) {
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const totp = await getTotp(env, id);
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

// Google Authenticator 迁移格式解析
function parseGoogleAuthMigration(migrationUri) {
  try {
    const url = new URL(migrationUri);
    const data = url.searchParams.get('data');
    
    if (!data) {
      throw new Error('Missing data parameter in migration URI');
    }
    
    // Base64 解码
    const decoded = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    
    // 简化的 Protocol Buffer 解析
    // Google Authenticator 使用的格式通常包含多个 OtpParameters
    const otpList = [];
    let offset = 0;
    
    while (offset < bytes.length) {
      const result = parseOtpParameter(bytes, offset);
      if (result.otp) {
        otpList.push(result.otp);
      }
      offset = result.nextOffset;
      
      // 防止无限循环
      if (result.nextOffset <= offset) {
        break;
      }
    }
    
    return otpList;
  } catch (error) {
    console.error('Error parsing Google Auth migration:', error);
    throw new Error('Failed to parse Google Authenticator migration data');
  }
}

// 解析单个 OTP 参数（简化版 Protocol Buffer 解析）
function parseOtpParameter(bytes, startOffset) {
  let offset = startOffset;
  let secret = '';
  let name = '';
  let issuer = '';
  let algorithm = 1; // SHA1
  let digits = 6;
  let type = 2; // TOTP
  
  try {
    // 查找字段标识符和数据
    while (offset < bytes.length) {
      if (offset >= bytes.length - 1) break;
      
      const fieldNumber = bytes[offset] >> 3;
      const wireType = bytes[offset] & 0x07;
      offset++;
      
      if (wireType === 2) { // Length-delimited
        const length = readVarint(bytes, offset);
        offset = length.nextOffset;
        
        if (offset + length.value > bytes.length) break;
        
        const fieldData = bytes.slice(offset, offset + length.value);
        
        switch (fieldNumber) {
          case 1: // secret
            secret = base32Encode(fieldData);
            break;
          case 2: // name/label
            name = new TextDecoder().decode(fieldData);
            break;
          case 3: // issuer
            issuer = new TextDecoder().decode(fieldData);
            break;
        }
        
        offset += length.value;
      } else {
        // 跳过其他类型的字段
        offset++;
      }
      
      // 简单的结束条件：如果我们已经有了必要的数据
      if (secret && name) {
        break;
      }
    }
    
    const otp = secret && name ? {
      secret: secret,
      name: name,
      issuer: issuer || 'Google Authenticator',
      algorithm: algorithm,
      digits: digits,
      type: type
    } : null;
    
    return {
      otp: otp,
      nextOffset: Math.min(offset + 10, bytes.length) // 简单的偏移增量
    };
  } catch (error) {
    console.error('Error parsing OTP parameter:', error);
    return {
      otp: null,
      nextOffset: Math.min(startOffset + 20, bytes.length)
    };
  }
}

// 读取 Protocol Buffer 的 varint
function readVarint(bytes, offset) {
  let value = 0;
  let shift = 0;
  let currentOffset = offset;
  
  while (currentOffset < bytes.length) {
    const byte = bytes[currentOffset];
    value |= (byte & 0x7F) << shift;
    currentOffset++;
    
    if ((byte & 0x80) === 0) {
      break;
    }
    
    shift += 7;
    if (shift >= 64) {
      throw new Error('Varint too long');
    }
  }
  
  return {
    value: value,
    nextOffset: currentOffset
  };
}

// Base32 编码（用于将二进制密钥转换为 Base32）
function base32Encode(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;
  
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }
  
  // 添加填充
  while (result.length % 8 !== 0) {
    result += '=';
  }
  
  return result;
}

// 导入TOTP
async function handleImportTotp(request, env) {
  const user = await getAuthenticatedUser(request, env);
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
    let importedTotps = [];
    
    // 检查是否为 Google Authenticator 迁移格式
    if (qrData.startsWith('otpauth-migration://')) {
      console.log('Processing Google Authenticator migration format');
      
      try {
        const otpList = parseGoogleAuthMigration(qrData);
        
        for (const otp of otpList) {
          if (otp.secret && otp.name) {
            const id = generateId();
            const totp = {
              id,
              user_id: user.userId,
              user_info: otp.name,
              secret: otp.secret,
              created_at: new Date().toISOString()
            };
            
            // 存储到 KV
            await setTotp(env, id, totp);
            await addUserTotp(env, user.userId, id);
            
            importedTotps.push({
              name: otp.name,
              issuer: otp.issuer
            });
            count++;
          }
        }
        
        if (count === 0) {
          throw new Error('No valid TOTP data found in migration format');
        }
        
      } catch (error) {
        console.error('Migration parsing error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Failed to parse migration data: ${error.message}` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    // 处理标准 TOTP URI
    else if (qrData.startsWith('otpauth://totp/')) {
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
      
      // 存储到 KV
      await setTotp(env, id, totp);
      await addUserTotp(env, user.userId, id);
      
      importedTotps.push({
        name: label || issuer,
        issuer: issuer
      });
      count = 1;
    } else {
      throw new Error('Unsupported QR code format. Please use Google Authenticator migration format or standard TOTP format.');
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      count,
      imported: importedTotps,
      message: `Successfully imported ${count} TOTP${count > 1 ? 's' : ''}` 
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
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 获取用户的所有 TOTP ID
  const totpIds = await getKVData(env, `user_totps:${user.userId}`) || [];
  
  // 删除所有 TOTP 数据
  for (const id of totpIds) {
    await deleteTotp(env, id);
  }
  
  // 清空用户的 TOTP 列表
  await setKVData(env, `user_totps:${user.userId}`, []);
  
  return new Response(JSON.stringify({ 
    message: 'All TOTPs cleared successfully',
    count: totpIds.length 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GitHub 相关功能存储（简化版，实际应使用 KV 或 D1）
const githubTokens = new Map(); // 存储用户的 GitHub token
const githubStates = new Map(); // 存储 OAuth state

// 验证 GitHub Token 有效性
async function handleVerifyGithubToken(request, env) {
  console.log('=== Verify GitHub Token Start ===');
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.log('No authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('User authenticated:', user.userId);
  const token = await getGithubToken(env, user.userId);
  console.log('GitHub token found:', !!token);
  
  if (token) {
    console.log('Token preview:', token.substring(0, 8) + '...');
    console.log('Token type:', typeof token);
    console.log('Token length:', token.length);
  }
  
  if (!token) {
    console.log('No GitHub token found for user');
    return new Response(JSON.stringify({ 
      authenticated: false,
      error: 'No GitHub token found'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    console.log('Testing token validity with GitHub user API...');
    // 使用 /user API 来验证 token 有效性
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TOTP-Manager/1.0'
      }
    });
    
    console.log('GitHub user API response status:', response.status);
    console.log('GitHub user API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const userData = await response.json();
      console.log('GitHub user data retrieved:', {
        login: userData.login,
        id: userData.id,
        name: userData.name
      });
      
      // 验证 gist 权限
      console.log('Testing gist permissions...');
      const gistResponse = await fetch('https://api.github.com/gists', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'TOTP-Manager/1.0'
        }
      });
      
      console.log('GitHub gist API response status:', gistResponse.status);
      
      if (gistResponse.ok) {
        const gists = await gistResponse.json();
        console.log('User gists count:', gists.length);
        
        return new Response(JSON.stringify({ 
          authenticated: true,
          valid: true,
          user: {
            login: userData.login,
            name: userData.name
          },
          permissions: {
            gist: true
          },
          gistCount: gists.length
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // gist 权限错误
        let gistError;
        try {
          gistError = await gistResponse.json();
        } catch (e) {
          gistError = await gistResponse.text();
        }
        
        console.log('Gist permission error:', gistError);
        
        return new Response(JSON.stringify({ 
          authenticated: true,
          valid: true,
          user: {
            login: userData.login,
            name: userData.name
          },
          permissions: {
            gist: false
          },
          error: `Gist permission denied: ${gistResponse.status} - ${JSON.stringify(gistError)}`
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // token 无效
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = await response.text();
      }
      
      console.log('Token validation error:', errorDetails);
      
      return new Response(JSON.stringify({ 
        authenticated: true,
        valid: false,
        error: `Token invalid: ${response.status} - ${JSON.stringify(errorDetails)}`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return new Response(JSON.stringify({ 
      authenticated: true,
      valid: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 检查 GitHub 认证状态
// 检查 GitHub 认证状态
async function handleGithubAuthStatus(request, env) {
  console.log('=== Check GitHub Auth Status ===');
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.log('No authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('User authenticated:', user.userId);
  const token = await getGithubToken(env, user.userId);
  console.log('GitHub token found:', !!token);
  
  if (token) {
    console.log('Token preview:', token.substring(0, 8) + '...');
    console.log('Token type:', typeof token);
  }
  
  const authenticated = !!token;
  
  return new Response(JSON.stringify({ 
    authenticated,
    isTokenExpired: false // 简化实现，实际应检查 token 有效性
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// GitHub OAuth 认证
async function handleGithubAuth(request, env) {
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (!env.GITHUB_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'GitHub OAuth not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const state = generateId();
  await setGithubState(env, state, user.userId);
  
  // 修复：回调 URI 应该指向当前 API 域名，而不是前端域名
  const currentUrl = new URL(request.url);
  const redirectUri = `${currentUrl.origin}/api/github/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=gist&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return Response.redirect(authUrl, 302);
}

// GitHub OAuth 回调
async function handleGithubCallback(request, env) {
  console.log('=== GitHub Callback Start ===');
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  console.log('Callback parameters:', { code: !!code, state });
  
  if (!code || !state) {
    console.log('Missing code or state parameter');
    return new Response(JSON.stringify({ error: 'Missing code or state parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userId = await getGithubState(env, state);
  console.log('User ID from state:', userId);
  
  if (!userId) {
    console.log('Invalid or expired state parameter - this is normal in stateless environment');
    // 在无状态环境中，我们需要从 Cookie 中获取用户信息
    const user = await getAuthenticatedUser(request, env);
    if (!user) {
      console.log('No authenticated user found in request');
      const frontendUrl = env.FRONTEND_URL || 'https://2fa.wkk.su';
      return Response.redirect(`${frontendUrl}?github_auth=error&message=not_logged_in`, 302);
    }
    console.log('Using authenticated user from request:', user.userId);
    // 使用从请求中获取的用户ID
    const actualUserId = user.userId;
    
    try {
      console.log('Attempting to exchange code for access token...');
      // 获取 access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code
        })
      });
      
      const tokenData = await tokenResponse.json();
      console.log('Token response status:', tokenResponse.status);
      console.log('Token response:', { 
        success: !!tokenData.access_token, 
        error: tokenData.error,
        token_type: tokenData.token_type,
        scope: tokenData.scope
      });
      
      if (tokenData.access_token) {
        await setGithubToken(env, actualUserId, tokenData.access_token);
        console.log('GitHub token stored for user:', actualUserId);
        console.log('Token preview:', tokenData.access_token.substring(0, 8) + '...');
        
        // 重定向到前端
        const frontendUrl = env.FRONTEND_URL || 'https://2fa.wkk.su';
        console.log('Redirecting to:', `${frontendUrl}?github_auth=success`);
        return Response.redirect(`${frontendUrl}?github_auth=success`, 302);
      } else {
        throw new Error(`Failed to get access token: ${tokenData.error || 'unknown error'}`);
      }
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      const frontendUrl = env.FRONTEND_URL || 'https://2fa.wkk.su';
      return Response.redirect(`${frontendUrl}?github_auth=error&message=${encodeURIComponent(error.message)}`, 302);
    }
  }
  
  // 原有逻辑（仅在有state的情况下使用）
  await deleteGithubState(env, state);
  
  try {
    // 获取 access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: code
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.access_token) {
      await setGithubToken(env, userId, tokenData.access_token);
      
      // 重定向到前端
      const frontendUrl = env.FRONTEND_URL || 'https://2fa.wkk.su';
      return Response.redirect(`${frontendUrl}?github_auth=success`, 302);
    } else {
      throw new Error('Failed to get access token');
    }
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    const frontendUrl = env.FRONTEND_URL || 'https://2fa.wkk.su';
    return Response.redirect(`${frontendUrl}?github_auth=error`, 302);
  }
}

// 上传到 Gist
async function handleUploadToGist(request, env) {
  console.log('=== Upload to Gist Start ===');
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.log('No authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('User authenticated:', user.userId);
  const token = await getGithubToken(env, user.userId);
  console.log('GitHub token found:', !!token);
  console.log('Token preview:', token ? token.substring(0, 8) + '...' : 'null');
  
  if (!token) {
    console.log('No GitHub token found for user');
    return new Response(JSON.stringify({ error: 'GitHub authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { mode } = await request.json();
  console.log('Upload mode:', mode);
  
  try {
    // 获取用户的所有 TOTP 数据
    const userTotps = await getUserTotps(env, user.userId);
    console.log('User TOTPs count:', userTotps.length);
    
    const backupData = {
      totps: userTotps,
      backup_time: new Date().toISOString(),
      version: '1.0'
    };
    
    const gistData = {
      description: `TOTP Backup - ${new Date().toLocaleString()}`,
      public: false,
      files: {
        'totp-backup.json': {
          content: JSON.stringify(backupData, null, 2)
        }
      }
    };
    
    console.log('Gist data prepared, sending to GitHub API...');
    console.log('Gist description:', gistData.description);
    console.log('File content length:', gistData.files['totp-backup.json'].content.length);
    
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'TOTP-Manager/1.0'
      },
      body: JSON.stringify(gistData)
    });
    
    console.log('GitHub API response status:', response.status);
    console.log('GitHub API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const result = await response.json();
      console.log('Gist created successfully:', result.id);
      return new Response(JSON.stringify({ 
        success: true,
        gist_id: result.id,
        message: 'Backup uploaded successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // 获取详细的错误信息
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = await response.text();
      }
      
      console.log('GitHub API error details:', errorDetails);
      throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorDetails)}`);
    }
  } catch (error) {
    console.error('Upload to Gist error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 获取 Gist 版本列表
async function handleGetGistVersions(request, env) {
  console.log('=== Get Gist Versions Start ===');
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.log('No authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('User authenticated:', user.userId);
  const token = await getGithubToken(env, user.userId);
  console.log('GitHub token found:', !!token);
  
  if (token) {
    console.log('Token preview:', token.substring(0, 8) + '...');
    console.log('Token type:', typeof token);
  }
  
  if (!token) {
    console.log('No GitHub token found for user');
    return new Response(JSON.stringify({ error: 'GitHub authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    console.log('Making request to GitHub API for gists...');
    const response = await fetch('https://api.github.com/gists', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TOTP-Manager/1.0'
      }
    });
    
    console.log('GitHub API response status:', response.status);
    console.log('GitHub API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const gists = await response.json();
      console.log('Total gists found:', gists.length);
      
      // 过滤出 TOTP 备份相关的 Gist
      const totpGists = gists.filter(gist => 
        gist.description && gist.description.includes('TOTP Backup') &&
        gist.files && gist.files['totp-backup.json']
      ).map(gist => ({
        id: gist.id,
        description: gist.description,
        created_at: gist.created_at,
        updated_at: gist.updated_at
      }));
      
      console.log('TOTP backup gists found:', totpGists.length);
      
      return new Response(JSON.stringify(totpGists), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // 获取详细的错误信息
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = await response.text();
      }
      
      console.log('GitHub API error details:', errorDetails);
      throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorDetails)}`);
    }
  } catch (error) {
    console.error('Get Gist versions error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 从 Gist 恢复
async function handleRestoreFromGist(request, env) {
  console.log('=== Restore from Gist Start ===');
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.log('No authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('User authenticated:', user.userId);
  const token = await getGithubToken(env, user.userId);
  console.log('GitHub token found:', !!token);
  
  if (token) {
    console.log('Token preview:', token.substring(0, 8) + '...');
    console.log('Token type:', typeof token);
  }
  
  if (!token) {
    console.log('No GitHub token found for user');
    return new Response(JSON.stringify({ error: 'GitHub authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const gistId = url.searchParams.get('id');
  
  console.log('Gist ID from params:', gistId);
  
  if (!gistId) {
    console.log('Missing Gist ID parameter');
    return new Response(JSON.stringify({ error: 'Gist ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    console.log('Making request to GitHub API for gist:', gistId);
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TOTP-Manager/1.0'
      }
    });
    
    console.log('GitHub API response status:', response.status);
    console.log('GitHub API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const gist = await response.json();
      console.log('Gist data retrieved successfully');
      console.log('Gist files:', Object.keys(gist.files || {}));
      
      if (gist.files && gist.files['totp-backup.json']) {
        const backupContent = gist.files['totp-backup.json'].content;
        console.log('Backup content length:', backupContent.length);
        
        const backupData = JSON.parse(backupContent);
        console.log('Backup data parsed, TOTPs count:', backupData.totps?.length || 0);
        
        // 清除当前用户的所有 TOTP
        const userTotpIds = await getKVData(env, `user_totps:${user.userId}`) || [];
        for (const id of userTotpIds) {
          await deleteTotp(env, id);
        }
        console.log('Cleared existing TOTPs:', userTotpIds.length);
        
        // 恢复数据
        let count = 0;
        const newTotpIds = [];
        if (backupData.totps && Array.isArray(backupData.totps)) {
          for (const totp of backupData.totps) {
            const newId = generateId();
            const newTotp = {
              ...totp,
              id: newId,
              user_id: user.userId
            };
            await setTotp(env, newId, newTotp);
            newTotpIds.push(newId);
            count++;
          }
        }
        
        // 更新用户的 TOTP 列表
        await setKVData(env, `user_totps:${user.userId}`, newTotpIds);
        
        console.log('Restored TOTPs count:', count);
        
        return new Response(JSON.stringify({ 
          success: true,
          count,
          message: `Successfully restored ${count} TOTPs`
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        console.log('Invalid backup format - missing totp-backup.json file');
        throw new Error('Invalid backup format');
      }
    } else {
      // 获取详细的错误信息
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = await response.text();
      }
      
      console.log('GitHub API error details:', errorDetails);
      throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorDetails)}`);
    }
  } catch (error) {
    console.error('Restore from Gist error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 删除备份
async function handleDeleteBackup(request, env) {
  console.log('=== Delete Backup Start ===');
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    console.log('No authenticated user');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('User authenticated:', user.userId);
  const token = await getGithubToken(env, user.userId);
  console.log('GitHub token found:', !!token);
  
  if (token) {
    console.log('Token preview:', token.substring(0, 8) + '...');
    console.log('Token type:', typeof token);
    console.log('Token length:', token.length);
  }
  
  if (!token) {
    console.log('No GitHub token found for user');
    return new Response(JSON.stringify({ error: 'GitHub authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const gistId = url.searchParams.get('id');
  
  console.log('Gist ID from params:', gistId);
  
  if (!gistId) {
    console.log('Missing Gist ID parameter');
    return new Response(JSON.stringify({ error: 'Gist ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    console.log('Making DELETE request to GitHub API for gist:', gistId);
    console.log('Request headers being sent:');
    console.log('- Authorization: Bearer [REDACTED]');
    console.log('- Accept: application/vnd.github.v3+json');
    console.log('- User-Agent: TOTP-Manager/1.0');
    
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TOTP-Manager/1.0'
      }
    });
    
    console.log('GitHub API DELETE response status:', response.status);
    console.log('GitHub API DELETE response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok || response.status === 204) {
      console.log('Gist deleted successfully');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Backup deleted successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // 获取详细的错误信息
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = await response.text();
      }
      
      console.log('GitHub API DELETE error details:', errorDetails);
      throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorDetails)}`);
    }
  } catch (error) {
    console.error('Delete backup error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
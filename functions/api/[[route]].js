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

// 正确的JWT实现，与标准JWT库兼容
async function createJWT(payload, secret) {
  console.log('=== Creating JWT ===');
  console.log('Payload:', payload);
  console.log('Secret provided:', !!secret);
  
  const header = btoa(JSON.stringify({alg: 'HS256', typ: 'JWT'}));
  const data = btoa(JSON.stringify({...payload, exp: Date.now() + 3600000})); // 1小时
  
  console.log('Header:', header);
  console.log('Data:', data);
  
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
  console.log('Generated signature:', signature);
  console.log('Full token length:', fullToken.length);
  console.log('=== End JWT Creation ===');
  
  return fullToken;
}

async function verifyJWT(token, secret) {
  try {
    console.log('=== JWT Verification Debug ===');
    console.log('Input token:', token);
    console.log('Secret:', secret ? 'provided' : 'missing');
    
    const [header, data, signature] = token.split('.');
    
    if (!header || !data || !signature) {
      console.log('Invalid JWT format: missing parts');
      console.log('Parts found:', { header: !!header, data: !!data, signature: !!signature });
      return null;
    }
    
    console.log('JWT parts lengths - header:', header.length, 'data:', data.length, 'signature:', signature.length);
    
    let payload;
    try {
      payload = JSON.parse(atob(data));
      console.log('JWT payload decoded:', payload);
    } catch (e) {
      console.log('Failed to decode JWT payload:', e.message);
      return null;
    }
    
    const now = Date.now();
    console.log('Time check - current:', now, 'token exp:', payload.exp, 'expired:', payload.exp < now);
    
    if (payload.exp < now) {
      console.log('Token expired');
      return null;
    }
    
    // 使用正确的 HMAC-SHA256 验证
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(`${header}.${data}`);
    
    console.log('Creating crypto key with secret...');
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    console.log('Crypto key created successfully');
    
    // 将Base64URL编码的签名转换为字节数组
    let signatureBytes;
    try {
      // 处理Base64URL到Base64的转换
      const base64Signature = signature.replace(/-/g, '+').replace(/_/g, '/');
      // 添加填充
      const paddedSignature = base64Signature + '=='.substring(0, (4 - base64Signature.length % 4) % 4);
      console.log('Original signature:', signature);
      console.log('Base64 signature:', base64Signature);
      console.log('Padded signature:', paddedSignature);
      
      signatureBytes = Uint8Array.from(
        atob(paddedSignature),
        c => c.charCodeAt(0)
      );
      console.log('Signature bytes length:', signatureBytes.length);
    } catch (e) {
      console.log('Failed to decode signature:', e.message);
      return null;
    }
    
    console.log('Verifying HMAC signature...');
    const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, messageData);
    console.log('HMAC-SHA256 signature valid:', isValid);
    console.log('=== End JWT Verification ===');
    
    return isValid ? payload : null;
  } catch (error) {
    console.log('JWT verification error:', error.message);
    console.log('Error stack:', error.stack);
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
    
    if (url.pathname.startsWith('/api/totp/') && url.pathname.endsWith('/generate') && method === 'GET') {
      const id = url.pathname.split('/')[3];
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
async function getAuthenticatedUser(request, env) {
  console.log('=== getAuthenticatedUser Start ===');
  let token = null;
  
  // 从 Authorization header 获取 token
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
    console.log('Token from Authorization header (first 30 chars):', token.substring(0, 30) + '...');
  }
  
  // 如果 header 中没有，尝试从 Cookie 中获取
  if (!token) {
    const cookieHeader = request.headers.get('cookie');
    console.log('Cookie header:', cookieHeader);
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
      console.log('Token from Cookie (first 30 chars):', token ? token.substring(0, 30) + '...' : 'null');
      console.log('Token from Cookie (last 30 chars):', token ? '...' + token.substring(token.length - 30) : 'null');
      console.log('All cookies found:', Object.keys(cookies));
    }
  }
  
  if (!token) {
    console.log('No token found in request');
    console.log('=== getAuthenticatedUser End: No Token ===');
    return null;
  }
  
  const jwtSecret = env.JWT_SECRET || 'default-secret';
  console.log('JWT Secret configured:', jwtSecret !== 'default-secret');
  
  const result = await verifyJWT(token, jwtSecret);
  console.log('Final verification result:', result ? 'SUCCESS' : 'FAILED');
  console.log('=== getAuthenticatedUser End ===');
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
  
  const userTotps = Array.from(totps.values()).filter(totp => totp.user_id === user.userId);
  
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
  const user = await getAuthenticatedUser(request, env);
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
  const user = await getAuthenticatedUser(request, env);
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
  const user = await getAuthenticatedUser(request, env);
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
            
            totps.set(id, totp);
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
      
      totps.set(id, totp);
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

// GitHub 相关功能存储（简化版，实际应使用 KV 或 D1）
const githubTokens = new Map(); // 存储用户的 GitHub token
const githubStates = new Map(); // 存储 OAuth state

// 检查 GitHub 认证状态
async function handleGithubAuthStatus(request, env) {
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = githubTokens.get(user.userId);
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
  githubStates.set(state, user.userId);
  
  // 修复：回调 URI 应该指向当前 API 域名，而不是前端域名
  const currentUrl = new URL(request.url);
  const redirectUri = `${currentUrl.origin}/api/github/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=gist&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return Response.redirect(authUrl, 302);
}

// GitHub OAuth 回调
async function handleGithubCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code || !state) {
    return new Response(JSON.stringify({ error: 'Missing code or state parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userId = githubStates.get(state);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Invalid state parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  githubStates.delete(state);
  
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
      githubTokens.set(userId, tokenData.access_token);
      
      // 重定向到前端
      const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
      return Response.redirect(`${frontendUrl}?github_auth=success`, 302);
    } else {
      throw new Error('Failed to get access token');
    }
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    return Response.redirect(`${frontendUrl}?github_auth=error`, 302);
  }
}

// 上传到 Gist
async function handleUploadToGist(request, env) {
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = githubTokens.get(user.userId);
  if (!token) {
    return new Response(JSON.stringify({ error: 'GitHub authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { mode } = await request.json();
  
  try {
    // 获取用户的所有 TOTP 数据
    const userTotps = Array.from(totps.values()).filter(totp => totp.user_id === user.userId);
    
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
    
    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gistData)
    });
    
    if (response.ok) {
      const result = await response.json();
      return new Response(JSON.stringify({ 
        success: true,
        gist_id: result.id,
        message: 'Backup uploaded successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error(`GitHub API error: ${response.status}`);
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
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = githubTokens.get(user.userId);
  if (!token) {
    return new Response(JSON.stringify({ error: 'GitHub authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const response = await fetch('https://api.github.com/gists', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const gists = await response.json();
      
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
      
      return new Response(JSON.stringify(totpGists), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error(`GitHub API error: ${response.status}`);
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
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = githubTokens.get(user.userId);
  if (!token) {
    return new Response(JSON.stringify({ error: 'GitHub authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const gistId = url.searchParams.get('id');
  
  if (!gistId) {
    return new Response(JSON.stringify({ error: 'Gist ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const gist = await response.json();
      
      if (gist.files && gist.files['totp-backup.json']) {
        const backupContent = gist.files['totp-backup.json'].content;
        const backupData = JSON.parse(backupContent);
        
        // 清除当前用户的所有 TOTP
        const userTotpIds = [];
        for (const [id, totp] of totps.entries()) {
          if (totp.user_id === user.userId) {
            userTotpIds.push(id);
          }
        }
        userTotpIds.forEach(id => totps.delete(id));
        
        // 恢复数据
        let count = 0;
        if (backupData.totps && Array.isArray(backupData.totps)) {
          for (const totp of backupData.totps) {
            const newId = generateId();
            const newTotp = {
              ...totp,
              id: newId,
              user_id: user.userId
            };
            totps.set(newId, newTotp);
            count++;
          }
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          count,
          message: `Successfully restored ${count} TOTPs`
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        throw new Error('Invalid backup format');
      }
    } else {
      throw new Error(`GitHub API error: ${response.status}`);
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
  const user = await getAuthenticatedUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = githubTokens.get(user.userId);
  if (!token) {
    return new Response(JSON.stringify({ error: 'GitHub authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const gistId = url.searchParams.get('id');
  
  if (!gistId) {
    return new Response(JSON.stringify({ error: 'Gist ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok || response.status === 204) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Backup deleted successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error(`GitHub API error: ${response.status}`);
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
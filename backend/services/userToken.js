import crypto from 'crypto';

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 12;

const base64UrlEncode = value => Buffer.from(value).toString('base64url');
const base64UrlDecode = value => Buffer.from(value, 'base64url').toString('utf8');

const getSecret = () => {
  const secret = process.env.USER_JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('USER_JWT_SECRET is not configured');
  }

  return secret;
};

const createSignature = (data, secret) =>
  crypto.createHmac('sha256', secret).update(data).digest('base64url');

export const createUserToken = (payload = {}) => {
  const secret = getSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + Number(process.env.USER_TOKEN_TTL_SECONDS || DEFAULT_TOKEN_TTL_SECONDS);
  const tokenPayload = {
    sub: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp,
    ...payload,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = createSignature(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const verifyUserToken = token => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const secret = getSecret();
    const [encodedHeader, encodedPayload, signature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = createSignature(`${encodedHeader}.${encodedPayload}`, secret);
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
};

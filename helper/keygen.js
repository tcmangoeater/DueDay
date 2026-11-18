/* global __dirname */

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
let cachedKey = null;
let refreshPromise = null;

function keyError(message, fix) {
  const error = new Error(message);
  error.fix = fix;
  return error;
}

function readEnvValue(name) {
  const runtimeValue = typeof process !== 'undefined' ? process.env[name] : '';
  const isVercel = typeof process !== 'undefined' && Boolean(process.env.VERCEL);
  if (runtimeValue) {
    const value = runtimeValue.trim().replace(/^(['"])(.*)\1$/, '$2');
    if (value && value !== 'paste-here') return value;
  }

  if (isVercel) {
    throw keyError(
      name + ' is missing from Vercel environment variables.',
      'Add ' + name + ' in Vercel Project Settings, then redeploy.'
    );
  }

  const envText = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
  const line = envText
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(name + '='));

  if (!line) {
    throw keyError(
      name + ' is missing from .env.',
      'Add ' + name + ' to .env, then restart the helper.'
    );
  }

  const value = line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!value || value === 'paste-here') {
    throw keyError(
      name + ' is still a placeholder.',
      'Put the real MindDo value in .env, then restart the helper.'
    );
  }

  return value;
}

function getExpirationMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1000000000000 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    return Date.parse(value);
  }

  return NaN;
}

async function requestFreshKey() {
  const keygenUrl = readEnvValue('KEYGEN_URL').replace(/\/+$/, '');
  const token = readEnvValue('KEYGEN_TOKEN');

  let response;
  try {
    response = await fetch(keygenUrl + '/api/lookup-key', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch {
    throw keyError(
      'Could not reach MindDo for an AI key.',
      'Check KEYGEN_URL and the computer internet connection.'
    );
  }

  if (!response.ok) {
    throw keyError(
      'MindDo did not provide an AI key.',
      'Check KEYGEN_URL and KEYGEN_TOKEN in .env.'
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw keyError(
      'MindDo returned an unreadable response.',
      'Check that the lookup endpoint returns JSON with apiKey and expiresAt.'
    );
  }

  const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';
  const expiresAtMs = getExpirationMs(payload.expiresAt);

  if (!apiKey || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw keyError(
      'MindDo returned an unusable AI key.',
      'Check that MindDo returns a non-empty apiKey and a future expiresAt.'
    );
  }

  cachedKey = { apiKey, expiresAtMs };
  return apiKey;
}

async function getKey(options = {}) {
  const forceRefresh = options.forceRefresh === true;
  if (!forceRefresh && cachedKey && cachedKey.expiresAtMs > Date.now()) {
    return cachedKey.apiKey;
  }

  if (!refreshPromise) {
    refreshPromise = requestFreshKey().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function invalidateKey() {
  cachedKey = null;
}

module.exports = { getKey, invalidateKey };

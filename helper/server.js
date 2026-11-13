const http = require('node:http');
const { askForReminder } = require('./openai');

const PORT = 3001;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20000) reject(new Error('Request is too large.'));
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== 'POST' || requestUrl.pathname !== '/api/reminder') {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  try {
    const data = JSON.parse(await readBody(request));
    const assignment = typeof data.assignment === 'string' ? data.assignment.trim() : '';
    const dueDate = typeof data.dueDate === 'string' ? data.dueDate.trim() : '';

    if (!assignment || !dueDate) {
      sendJson(response, 400, { error: 'Please enter an assignment and due date.' });
      return;
    }

    const reminder = await askForReminder(assignment, dueDate);
    sendJson(response, 200, { reminder });
  } catch (error) {
    console.error('Reminder request failed:', error.message);
    sendJson(response, 502, {
      error: 'The AI helper could not make a reminder. Check the key and the helper.',
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DueDay helper is running on port ${PORT}.`);
});

const http = require('node:http');
const { answerQuestion, findDueDate } = require('./openai');

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
      if (body.length > 24000) reject(new Error('Request is too large.'));
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function getText(data, key, maxLength) {
  return typeof data[key] === 'string' ? data[key].trim().slice(0, maxLength) : '';
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

  if (request.method !== 'POST' || !['/api/parse-assignment', '/api/question'].includes(requestUrl.pathname)) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  try {
    const data = JSON.parse(await readBody(request));

    if (requestUrl.pathname === '/api/parse-assignment') {
      const assignmentText = getText(data, 'assignmentText', 10000);
      if (!assignmentText) {
        sendJson(response, 400, { error: 'Paste an assignment and due date first.' });
        return;
      }

      const parsed = await findDueDate(assignmentText);
      sendJson(response, 200, parsed);
      return;
    }

    const question = getText(data, 'question', 3000);
    const assignments = Array.isArray(data.assignments) ? data.assignments.slice(0, 100) : [];
    if (!question) {
      sendJson(response, 400, { error: 'Ask a question about your saved assignments.' });
      return;
    }

    const answer = await answerQuestion(question, assignments);
    sendJson(response, 200, { answer });
  } catch (error) {
    console.error('AI request failed:', error.message);
    sendJson(response, 502, {
      error: 'The AI helper could not answer. Check the key and the helper.',
    });
  }
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`DueDay helper is running on port ${PORT}.`);
});

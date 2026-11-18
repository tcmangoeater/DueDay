const { answerQuestion, findDueDate } = require('../helper/openai');

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message, fix) {
  sendJson(response, statusCode, {
    error: { message, fix },
  });
}

function getText(data, key, maxLength) {
  return typeof data[key] === 'string' ? data[key].trim().slice(0, maxLength) : '';
}

function getBody(request) {
  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  if (typeof request.body === 'string') {
    return JSON.parse(request.body);
  }

  return {};
}

module.exports = async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method !== 'POST') {
    sendError(response, 405, 'This AI endpoint only accepts POST requests.', 'Use the DueDay app to send a request.');
    return;
  }

  try {
    const data = getBody(request);

    if (data.action === 'parse-assignment') {
      const assignmentText = getText(data, 'assignmentText', 10000);
      if (!assignmentText) {
        sendError(response, 400, 'Paste an assignment and due date first.', 'Add assignment text before tapping the AI button.');
        return;
      }

      sendJson(response, 200, await findDueDate(assignmentText));
      return;
    }

    if (data.action === 'question') {
      const question = getText(data, 'question', 3000);
      const assignments = Array.isArray(data.assignments) ? data.assignments.slice(0, 100) : [];
      if (!question) {
        sendError(response, 400, 'Ask a question about your saved assignments.', 'Type a question before tapping the AI button.');
        return;
      }

      sendJson(response, 200, { answer: await answerQuestion(question, assignments) });
      return;
    }

    sendError(response, 400, 'The AI request was not recognized.', 'Use the DueDay app to send a request.');
  } catch (error) {
    const message = error && typeof error.message === 'string'
      ? error.message
      : 'The AI helper could not answer.';
    const fix = error && typeof error.fix === 'string'
      ? error.fix
      : 'Check the Vercel environment settings and try again.';
    console.error('AI request fix:', fix);
    sendError(response, 502, message, fix);
  }
};

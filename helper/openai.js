const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function readOpenAIKey() {
  const envText = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
  const line = envText
    .split(/\r?\n/)
    .find((candidate) => /^\s*OPENAI_API_KEY\s*=/.test(candidate));

  if (!line) {
    throw new Error('OPENAI_API_KEY is missing from .env.');
  }

  const value = line.split('=', 2)[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!value || value === 'paste-your-key-here') {
    throw new Error('OPENAI_API_KEY is missing or still the placeholder.');
  }

  return value;
}

function readModel() {
  const notes = fs.readFileSync(path.join(projectRoot, 'NOTES.md'), 'utf8');
  const match = notes.match(/gpt-[A-Za-z0-9._-]*luna[A-Za-z0-9._-]*/i);

  if (!match) {
    throw new Error('The Luna model is missing from NOTES.md.');
  }

  return match[1];
}

function readAiInstructions() {
  const brief = fs.readFileSync(path.join(projectRoot, 'BRIEF.md'), 'utf8');
  const heading = /^## My AI(?:’|')s instructions\s*$/m.exec(brief);

  if (!heading) {
    throw new Error('The AI instructions are missing from BRIEF.md.');
  }

  const sectionStart = heading.index + heading[0].length;
  const rest = brief.slice(sectionStart);
  const nextHeading = /^## /m.exec(rest);
  return rest.slice(0, nextHeading ? nextHeading.index : rest.length).trim();
}

function getResponseText(payload) {
  if (typeof payload.output_text === 'string') {
    return payload.output_text.trim();
  }

  const parts = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }

  return parts.join(' ').trim();
}

async function askForReminder(assignment, dueDate) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${readOpenAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: readModel(),
      instructions: readAiInstructions(),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'The student entered this assignment and due date.',
                `Assignment: ${assignment}`,
                `Due date: ${dueDate}`,
                'Write one friendly sentence that names the assignment and exact due date. Do not invent, change, or guess the date.',
              ].join('\n'),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const reminder = getResponseText(payload);
  if (!reminder) throw new Error('OpenAI returned no reminder text.');

  return reminder;
}

module.exports = { askForReminder };

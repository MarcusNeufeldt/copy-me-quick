import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function logToFile(message: string) {
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'ai-smart-select.log');

  try {
    await fs.mkdir(logDir, { recursive: true });
    await fs.appendFile(logFile, message + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

export async function POST(request: NextRequest) {
  // Check if the API key is configured
  if (!OPENROUTER_API_KEY) {
    const errorMessage = "FATAL: OPENROUTER_API_KEY environment variable is not set. AI Smart Select cannot function.";
    console.error(errorMessage);
    // Attempt to log to file, but handle potential errors if logging fails early
    try {
      await logToFile(errorMessage);
    } catch (logError) {
      console.error('Failed to write API key error to log file:', logError);
    }
    return NextResponse.json({ error: 'Server configuration error: Missing API key.' }, { status: 500 });
  }

  try {
    const { projectTree } = await request.json();

    await logToFile('Received project tree:\n' + projectTree);

    const aiResponse = await getAIResponse(projectTree);

    await logToFile('AI response:\n' + JSON.stringify(aiResponse, null, 2));

    return NextResponse.json({ selectedFiles: aiResponse });
  } catch (error) {
    await logToFile('AI Smart Select error:\n' + error);
    return NextResponse.json({ error: 'AI Smart Select failed' }, { status: 500 });
  }
}

async function getAIResponse(projectTree: string): Promise<string[]> {
  const prompt = `
You are an AI assistant tasked with analyzing a project structure and selecting the important files for understanding the project's functionality. Here's the project tree:

${projectTree}

Please select the files that are crucial for understanding the main functionality and structure of the project. Return your selection as a JSON array of file paths.

Important: Return ONLY the JSON array, without any markdown formatting or additional text.

Example response format:
["src/index.js", "src/components/App.js", "src/utils/helpers.js"]
`;

  await logToFile('Sending prompt to AI:\n' + prompt);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/o1-mini-2024-09-12',
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    await logToFile(`AI response not OK: ${response.status} ${response.statusText}`);
    throw new Error('Failed to get AI response');
  }

  const data = await response.json();
  await logToFile('Raw AI response:\n' + JSON.stringify(data, null, 2));

  const aiMessage = data.choices[0].message.content;
  await logToFile('AI message content:\n' + aiMessage);

  try {
    // Remove any markdown formatting if present
    const cleanedMessage = aiMessage.replace(/```json\n?|\n?```/g, '').trim();
    const parsedResponse = JSON.parse(cleanedMessage);
    await logToFile('Parsed AI response:\n' + JSON.stringify(parsedResponse, null, 2));
    return parsedResponse;
  } catch (error) {
    await logToFile('Failed to parse AI response:\n' + error);
    return [];
  }
}












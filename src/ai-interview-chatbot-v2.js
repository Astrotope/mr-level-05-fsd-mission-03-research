import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL_NAME;

const genAI = new GoogleGenerativeAI(apiKey);

async function getUserInput() {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.resume();
    stdin.once("data", (data) => {
      resolve(data.toString().trim());
    });
  });
}

async function interviewChat() {
  // Get job title from user first
  process.stdout.write("\nWhat position are you interviewing for? ");
  const jobTitle = await getUserInput();
  
  const systemInstruction = `You are an interviewer for a ${jobTitle} position. After each response from the applicant, ask a relevant follow-up question. Do not analyze, give feedback, or provide any advice; simply ask a natural follow-up question based on the previous response.`;
  
  const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemInstruction });

  // Initialize history with job-specific context
  const history = [
    {
      role: "user",
      parts: [{ text: `I am preparing for a ${jobTitle} job interview. Can you help me practice?` }],
    },
    {
      role: "model",
      parts: [{ text: "Tell me about yourself." }],
    },
  ];

  console.log("\n[interviewer] Tell me about yourself.");

  const rounds = 6;

  for (let i = 1; i <= rounds; i++) {
    // Prompt user for their response
    process.stdout.write("\n[applicant] ");
    const userResponse = await getUserInput();

    // Append user's response to the chat history
    history.push({
      role: "user",
      parts: [{ text: `[applicant] ${userResponse}` }],
    });

    // Ensure proper message structure when sending to the API
    const formattedHistory = history.map((message) => {
      // Ensure each part is wrapped in { text: "actual text" }
      return {
        role: message.role,
        parts: message.parts.map((part) => {
          if (typeof part === 'string') {
            return { text: part }; // Wrap the string in the expected format
          }
          return part; // Return already well-formed part
        }),
      };
    });

    // console.log(formattedHistory);
    // console.log(formattedHistory[0]);

    // Send the updated history to the model to get the next question
    const chat = model.startChat({ history: formattedHistory });

    // Pass the formatted history to sendMessageStream
    const result = await chat.sendMessageStream({
      messages: formattedHistory,
    }.toString());

    // Capture AI's follow-up question
    let aiResponse = "";
    for await (const chunk of result.stream) {
      aiResponse += chunk.text();
    }

    // Trim the AI's response to remove any excess whitespace or unintended analysis
    aiResponse = aiResponse.trim();

    // Append AI's response (only the follow-up question) to the history
    const interviewerResponse = `[interviewer] ${aiResponse}`;
    history.push({
      role: "model",
      parts: [{ text: interviewerResponse }],
    });

    // Display the interviewer's follow-up question
    console.log("\n" + interviewerResponse);
  }

  // Add exit message and graceful shutdown
  console.log("\nInterview session complete. Thank you for practicing!");
  process.exit(0);
}

// Start the interview chat loop
interviewChat().catch((err) => console.error("Error:", err));
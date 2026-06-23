import type { RequestHandler } from 'express';
import { z } from 'zod';
import { PromptBodySchema } from '#schemas';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources';

type IncomingPrompt = z.infer<typeof PromptBodySchema>;

export const createCompletion: RequestHandler<unknown, IncomingPrompt> = async (req, res) => {
  const { prompt, stream } = req.body;
  // OpenAI client setup
  const client = new OpenAI({
    apiKey:
      process.env.NODE_ENV === 'development'
        ? process.env.LOCAL_LLM_KEY
        : process.env.OPENAI_API_KEY,
    baseURL: process.env.NODE_ENV === 'development' ? process.env.LOCAL_LLM_URL : undefined
  });
  // Model, we define it here so we can use it in both steps
  const model =
    process.env.NODE_ENV === 'development'
      ? process.env.LOCAL_LLM_MODEL!
      : process.env.OPENAI_MODEL!;
  // Messages, we define it here so we can add more in the future
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'you are a helpful senior software dev with 20 years of frontend exp'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  const finalCompletion = await client.chat.completions.parse({
    model,
    messages,
    temperature: 0
  });
  console.log(finalCompletion.choices);
  const finalResponse = finalCompletion.choices[0]?.message.content;
  if (!finalResponse) {
    res.status(500).json({
      completion: 'Failed to generate a final response.'
    });
    return;
  }
  res.json(finalResponse);
};

import type { RequestHandler } from 'express';
import type { ChatCompletionMessageParam } from 'openai/resources';
import type { z } from 'zod';
import { createOpenAICompletion } from '#utils';
import { zodResponseFormat } from 'openai/helpers/zod';
import { type promptBodySchema, intentSchema, finalResponseSchema } from '#schemas';
import OpenAI from 'openai';
import Pokedex from 'pokedex-promise-v2';
type IncomingPrompt = z.infer<typeof promptBodySchema>;
type ResponseCompletion = { completion: string };
type FinalResponseDTO = z.infer<typeof finalResponseSchema> | { completion: string };
export const createCompletion: RequestHandler<unknown, FinalResponseDTO, IncomingPrompt> = async (
  req,
  res
) => {
  const { prompt } = req.body;
  // OpenAI client setup
  const client = new OpenAI({
    apiKey:
      process.env.NODE_ENV === 'development'
        ? process.env.LOCAL_LLM_KEY
        : process.env.OPENAI_API_KEY,
    baseURL:
      process.env.NODE_ENV === 'development' ? process.env.LOCAL_LLM_URL : process.env.OPENAI_URL // undefined for OpenAI, needed for Gemini or Anthropic
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
      content:
        'You determine if a question is about Pokémon. You can only answer questions about a single Pokémon and not open-ended questions.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];
  // Step 1: Check if the prompt is about Pokémon
  const checkIntentCompletion = await client.chat.completions.parse({
    model,
    messages,
    temperature: 0,
    response_format: zodResponseFormat(intentSchema, 'Intent')
  });

  const intent = checkIntentCompletion.choices[0]?.message.parsed;
  if (!intent?.isPokemon) {
    res.status(400).json({
      completion: intent?.reason || 'I cannot answer this question, try asking about a Pokémon.'
    });
    return;
  }
  console.log(`\x1b[34mIntent detected. Received a question about: ${intent.pokemonName}\x1b[0m`);
  messages.push({
    role: 'assistant',
    content: JSON.stringify(intent, null, 2)
  });
  // Step 2: Fetch the Pokémon data from the PokeAPI
  const P = new Pokedex();
  const pokemonData = await P.getPokemonByName(intent.pokemonName.toLowerCase());
  if (!pokemonData) {
    res.status(404).json({
      completion: `Pokémon ${intent.pokemonName} not found.`
    });
    return;
  }
  console.log(`\x1b[32mFetched data for Pokémon: ${pokemonData.name}\x1b[0m`);
  // Step 3: Add the Pokémon data to the messages and generate a final response
  messages.push({
    role: 'assistant',
    content: `This is all the relevant data about the Pokémon: ${
      intent.pokemonName
    }: ${JSON.stringify(pokemonData, null, 2)}
    Combine it with what you know about it to give the user a complete answer.`
  });
  console.log(`\x1b[33mAdded Pokémon data to messages for further processing.\x1b[0m`);
  const finalCompletion = await client.chat.completions.parse({
    model,
    messages,
    temperature: 0,
    response_format: zodResponseFormat(finalResponseSchema, 'FinalResponse')
  });
  const finalResponse = finalCompletion.choices[0]?.message.parsed;
  if (!finalResponse) {
    res.status(500).json({
      completion: 'Failed to generate a final response.'
    });
    return;
  }
  res.json(finalResponse);
};

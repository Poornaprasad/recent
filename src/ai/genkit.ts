import {genkit} from 'genkit';
import openAICompatible from '@genkit-ai/compat-oai';
import { config } from 'dotenv';

config();

export const ai = genkit({
  plugins: [openAICompatible({
    name: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  })],
});

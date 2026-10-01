import OpenAI from 'openai';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Instantiate the OpenAI client pointed to Grok (xAI) if GROK_API_KEY is present
export const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY || process.env.OPENAI_API_KEY || 'dummy_key_for_testing',
  baseURL: process.env.GROK_API_KEY ? 'https://api.x.ai/v1' : undefined,
});

export const getCandidateData = (): any => {
    let dataPath = resolve(__dirname, '../knowledge/candidate.json');
    if (!existsSync(dataPath)) {
        dataPath = resolve(process.cwd(), 'src/knowledge/candidate.json');
    }
    if (!existsSync(dataPath)) {
        throw new Error("Candidate data not found at " + dataPath);
    }
    const rawContent = readFileSync(dataPath, 'utf-8');
    return JSON.parse(rawContent);
}

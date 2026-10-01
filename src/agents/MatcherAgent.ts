import { openai, getCandidateData } from './llm';
import { MATCHER_PROMPT } from './prompts';

export class MatcherAgent {
  public static async analyzeJD(jobDescription: string) {
    const candidateProfile = getCandidateData();

    const userMessage = `
    Job Description:
    ${jobDescription}

    Candidate Profile:
    ${JSON.stringify(candidateProfile, null, 2)}
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "grok-beta", // Using grok-beta/grok-2 based on Grok API
        messages: [
          { role: "system", content: MATCHER_PROMPT },
          { role: "user", content: userMessage }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const responseContent = response.choices[0]?.message?.content;
      if (!responseContent) throw new Error("Empty response from LLM");
      return JSON.parse(responseContent);
    } catch (error) {
      console.error("Error generating Match Score:", error);
      throw error;
    }
  }
}

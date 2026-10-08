import { openai, getCandidateData } from './llm';
import { PREP_AGENT_PROMPT } from './prompts';

export class ApplicationPrepAgent {
  public static async prepareApplication(jobTitle: string, company: string, screeningQuestions: string[]) {
    const candidateProfile = getCandidateData();

    const userMessage = `
    Job Title: ${jobTitle}
    Company: ${company}

    Candidate Profile:
    ${JSON.stringify(candidateProfile, null, 2)}

    Screening Questions to Answer (if any):
    ${JSON.stringify(screeningQuestions)}
    `;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.GROK_API_KEY ? "grok-beta" : "gpt-4o-mini",
        messages: [
          { role: "system", content: PREP_AGENT_PROMPT },
          { role: "user", content: userMessage }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const responseContent = response.choices[0]?.message?.content;
      if (!responseContent) throw new Error("Empty response from LLM");
      return JSON.parse(responseContent);
    } catch (error) {
      console.error("Error generating application preparation data:", error);
      throw error;
    }
  }
}

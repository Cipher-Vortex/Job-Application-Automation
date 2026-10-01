"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationPrepAgent = void 0;
const llm_1 = require("./llm");
const prompts_1 = require("./prompts");
class ApplicationPrepAgent {
    static async prepareApplication(jobTitle, company, screeningQuestions) {
        const candidateProfile = (0, llm_1.getCandidateData)();
        const userMessage = `
    Job Title: ${jobTitle}
    Company: ${company}

    Candidate Profile:
    ${JSON.stringify(candidateProfile, null, 2)}

    Screening Questions to Answer (if any):
    ${JSON.stringify(screeningQuestions)}
    `;
        try {
            const response = await llm_1.openai.chat.completions.create({
                model: "grok-beta", // Update model name if using Grok
                messages: [
                    { role: "system", content: prompts_1.PREP_AGENT_PROMPT },
                    { role: "user", content: userMessage }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2
            });
            const responseContent = response.choices[0]?.message?.content;
            if (!responseContent)
                throw new Error("Empty response from LLM");
            return JSON.parse(responseContent);
        }
        catch (error) {
            console.error("Error generating application preparation data:", error);
            throw error;
        }
    }
}
exports.ApplicationPrepAgent = ApplicationPrepAgent;
//# sourceMappingURL=ApplicationPrepAgent.js.map
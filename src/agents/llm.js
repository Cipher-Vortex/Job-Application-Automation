"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCandidateData = exports.openai = void 0;
const openai_1 = __importDefault(require("openai"));
const fs_1 = require("fs");
const path_1 = require("path");
// Instantiate the OpenAI client pointed to Grok (xAI) if GROK_API_KEY is present
exports.openai = new openai_1.default({
    apiKey: process.env.GROK_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.GROK_API_KEY ? 'https://api.x.ai/v1' : undefined,
});
const getCandidateData = () => {
    const dataPath = (0, path_1.resolve)(__dirname, '../knowledge/candidate.json');
    if (!(0, fs_1.existsSync)(dataPath)) {
        throw new Error("Candidate data not found at " + dataPath);
    }
    const rawContent = (0, fs_1.readFileSync)(dataPath, 'utf-8');
    return JSON.parse(rawContent);
};
exports.getCandidateData = getCandidateData;
//# sourceMappingURL=llm.js.map
import { getCandidateData } from '../src/agents/llm';

describe('Candidate Profile Knowledge Base', () => {
  it('should successfully load candidate.json', () => {
    const profile = getCandidateData();
    expect(profile).toBeDefined();
    expect(profile.personal_info.full_name).toContain('Kiran S R');
    expect(profile.personal_info.email).toBe('skkiran1258@gmail.com');
  });

  it('should include technical skills and past projects', () => {
    const profile = getCandidateData();
    expect(profile.technical_skills.languages).toContain('JavaScript');
    expect(profile.technical_skills.frameworks_libraries).toContain('React.js');
    expect(Array.isArray(profile.key_projects)).toBe(true);
    expect(profile.key_projects.length).toBeGreaterThan(0);
  });
});

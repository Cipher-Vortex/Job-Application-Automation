export interface CandidateProfile {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  portfolio: string;
  github: string;
  linkedin: string;
}

export interface ExperienceItem {
  company: string;
  role: string;
  duration: string;
  metrics: string[];
}

export interface ProjectItem {
  name: string;
  stack: string;
  points: string;
}

export interface TruthProfileType {
  candidate: CandidateProfile;
  skills: string[];
  experiences: ExperienceItem[];
  projects: ProjectItem[];
}

export const TRUTH_PROFILE: TruthProfileType = {
  candidate: {
    name: "Kiran S R",
    title: "Full Stack Software Engineer",
    email: "skkiran1258@gmail.com",
    phone: "+91 81247 85632",
    location: "Bengaluru, Karnataka, India (Open to Remote)",
    portfolio: "https://cipher-vortex.vercel.app",
    github: "https://github.com/Cipher-Vortex",
    linkedin: "https://linkedin.com/in/kiran-s-r-774530268/"
  },
  skills: [
    "React.js", "Next.js", "TypeScript", "Node.js", "Express.js",
    "Laravel", "Vue 3", "Inertia.js", "MongoDB", "MySQL", "Redis", "REST APIs"
  ],
  experiences: [
    {
      company: "Zupper Commerce Pvt. Ltd.",
      role: "Junior Software Developer",
      duration: "Oct 2024 – Dec 2025",
      metrics: [
        "Reduced frontend load times by ~25% through lazy loading, code-splitting, and memoization.",
        "Engineered modular, reusable React UI components and shared frontend design patterns.",
        "Integrated robust REST API contracts for product, user, and order lifecycles."
      ]
    },
    {
      company: "Jozzby Bazar",
      role: "React Developer Intern",
      duration: "Sep 2023 – Jan 2024",
      metrics: [
        "Constructed responsive UI for web and mobile layouts across breakpoints.",
        "Handled asynchronous API state, error boundaries, and null edge cases."
      ]
    }
  ],
  projects: [
    {
      name: "Yeshu Tours & Travels",
      stack: "Astro, Next.js, Express.js, MongoDB, Redis, Tailwind CSS",
      points: "Full-scale production booking engine with customer frontend, administrative portal, and Redis caching."
    },
    {
      name: "RMC ERP",
      stack: "Laravel, Vue 3, Inertia.js, MySQL, PrimeVue",
      points: "Enterprise ERP handling quotations, batching logs, weighbridge sensor data, and dispatch pipelines."
    },
    {
      name: "Cerebrum",
      stack: "Next.js, Node.js, Grok API, RAG, MongoDB Atlas",
      points: "AI knowledge management tool with automated note summarization and RAG-driven retrieval."
    }
  ]
};

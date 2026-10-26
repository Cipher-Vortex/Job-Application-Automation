module.exports = {
  apps: [
    {
      name: "jobpilot-server",
      script: "server/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
      },
      error_file: "logs/server-error.log",
      out_file: "logs/server-out.log",
      time: true,
    },
    {
      name: "jobpilot-scout",
      script: "npx",
      args: "tsx agent-scout.ts --watch",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/scout-error.log",
      out_file: "logs/scout-out.log",
      time: true,
    },
  ],
};

module.exports = {
  apps: [
    {
      name: "jobpilot-scout",
      script: "npx",
      args: "tsx agent-scout.ts --watch",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/scout-error.log",
      out_file: "logs/scout-out.log",
      time: true,
    },
  ],
};

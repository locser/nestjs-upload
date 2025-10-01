module.exports = {
  apps: [
    {
      name: 'nestjs-demo',
      script: './dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_beta: {
        NODE_ENV: 'beta',
        PORT: 3000,
      },
    },
  ],
};

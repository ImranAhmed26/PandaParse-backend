require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'nest-app',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      env_file: ".env",
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 8000,
        DATABASE_URL: process.env.DATABASE_URL,

        AWS_REGION: process.env.AWS_REGION || 'eu-west-1',
        TEXTRACT_ROLE_ARN: process.env.TEXTRACT_ROLE_ARN,
        TEXTRACT_SNS_TOPIC_ARN: process.env.TEXTRACT_SNS_TOPIC_ARN,
        TEXTRACT_OUTPUT_BUCKET: process.env.TEXTRACT_OUTPUT_BUCKET,
        SQS_QUEUE_URL: process.env.SQS_QUEUE_URL,

        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,

        JWT_SECRET: process.env.JWT_SECRET,
        INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
        FRONTEND_URL: process.env.FRONTEND_URL,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        watch: true,
        ignore_watch: ['node_modules', 'logs'],
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8888,
        DATABASE_URL: process.env.DATABASE_URL,

        AWS_REGION: process.env.AWS_REGION || 'eu-west-1',
        TEXTRACT_ROLE_ARN: process.env.TEXTRACT_ROLE_ARN,
        TEXTRACT_SNS_TOPIC_ARN: process.env.TEXTRACT_SNS_TOPIC_ARN,
        TEXTRACT_OUTPUT_BUCKET: process.env.TEXTRACT_OUTPUT_BUCKET,

        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
        SQS_QUEUE_URL: process.env.SQS_QUEUE_URL,

        JWT_SECRET: process.env.JWT_SECRET,
        INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
        FRONTEND_URL: process.env.FRONTEND_URL,
      },
    },
  ],

  // deploy: {
  //   production: {
  //     user: "deploy",
  //     host: ["[server_ip]"],
  //     ref: "origin/main",
  //     repo: "[your_repo_url]",
  //     path: "/var/www/nest-app",
  //     "post-deploy": "npm install && npm run build && pm2 reload ecosystem.config.js --env production"
  //   }
  // }
};

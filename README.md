# Document Processing & Workspace Management API

A NestJS-based backend application for document processing, workspace management, and team collaboration. Built with TypeScript, Prisma, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **User Management**: Support for individual freelancers, company users, and company owners
- **Workspace Management**: Create and manage workspaces with member control
- **Document Processing**: Upload and process documents with AWS Textract integration
- **Company Management**: Multi-tenant support for companies and teams
- **File Upload**: AWS S3 integration for secure file storage
- **Token System**: Credit-based system for document processing

## Tech Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport
- **File Storage**: AWS S3
- **Document Processing**: AWS Textract
- **API Documentation**: Swagger/OpenAPI
- **Validation**: class-validator & class-transformer

## User Types

- **Individual Freelancer (0)**: Independent users with personal workspaces
- **Company User (1)**: Team members within a company
- **Company Owner (2)**: Company administrators with full access

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- AWS account (for S3 and Textract)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Configure DATABASE_URL, JWT secrets, and AWS credentials

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### Development

```bash
# Start development server
npm run start:dev

# Run tests
npm run test

# View API documentation
# Visit http://localhost:8000/api after starting the server
```

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_REGION="eu-west-1"
S3_BUCKET_NAME="your-bucket-name"
SQS_QUEUE_URL="https://sqs.region.amazonaws.com/account-id/queue-name"
```

## API Endpoints

### Authentication

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token

### Workspaces

- `GET /workspace` - List user workspaces
- `POST /workspace` - Create workspace
- `GET /workspace/:id` - Get workspace details
- `PATCH /workspace/:id` - Update workspace
- `DELETE /workspace/:id` - Delete workspace
- `POST /workspace/check-name-availability` - Check name availability

### Users & Companies

- `GET /user/profile` - Get user profile
- `POST /company` - Create company
- `GET /company/:id` - Get company details

### Document Processing

- `POST /upload` - Upload documents
- `GET /upload/:id/status` - Check processing status

## Database Schema

Key models:

- **User**: Authentication and profile data
- **Company**: Organization management
- **Workspace**: Project workspaces with member management
- **Document**: Uploaded files and processing results
- **TokenBalance**: Credit system for API usage

## Scripts

```bash
# Development
npm run start:dev    # Start with hot reload
npm run start:debug  # Start with debugging

# Production
npm run build        # Build the application
npm run start:prod   # Start production server

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run test:cov     # Run tests with coverage

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## License

This project is licensed under the UNLICENSED license.

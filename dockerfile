# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy Prisma schema (important to do before generating)
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the source code
COPY . .

# Build the project
RUN npm run build

# Expose backend port
EXPOSE 8000

# Run the app
CMD ["npm", "run", "start:prod"]

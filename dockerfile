# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy all source files
COPY . .

# Expose backend port (e.g. 8000)
EXPOSE 8000

# Run the app
CMD ["npm", "run", "start:prod"]

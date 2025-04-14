# Use the official Node.js image as the base image
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/twilio

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Clean any existing node_modules and install dependencies
RUN rm -rf node_modules && npm install

# Copy the rest of the application files
COPY . .

# Build the Prisma client
RUN npx prisma generate

# Build the NestJS application
RUN npm run build

# Expose the application port
EXPOSE 80

# Command to run the application
CMD ["node", "dist/src/main"]
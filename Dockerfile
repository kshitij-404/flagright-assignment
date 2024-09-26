# Use the official Bun image as a parent image
FROM oven/bun:latest

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of your application's source code
COPY . .

# Expose the port your app runs on (adjust if necessary)
EXPOSE 3000

# Run your application
CMD ["bun", "run", "dev"]
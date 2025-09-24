# Use Node.js 20 as the base image (as recommended in the README)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install git and other necessary packages (as per installation instructions)
RUN apk add --no-cache git curl

# Clone the repository
RUN git clone https://github.com/alijayanet/gembok-bill.git .

# Install dependencies
RUN npm install

# Run the database setup script (as per installation instructions)
RUN node scripts/add-payment-gateway-tables.js

# Expose the application port (default 3003 from settings.json)
EXPOSE 3003

# Use PM2 for production mode (as recommended in the README)
RUN npm install -g pm2

# Start the application with PM2
CMD ["pm2-runtime", "start", "app.js", "--name", "gembok-bill"]
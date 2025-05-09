# Use the official Deno image
FROM denoland/deno:1.37.0

# Set working directory
WORKDIR /app

# Copy dependency file
COPY deps.ts .
# Cache the dependencies
RUN deno cache deps.ts

# Copy rest of the application
COPY . .

# Compile the app (optional, improves startup)
RUN deno cache server.ts

# Create a non-root user to run the app and own app files
RUN chown -R deno:deno /app
USER deno

# The port your app runs on
EXPOSE 8080

# Command to run the application
CMD ["run", "--allow-net", "--allow-read", "--allow-env", "--allow-write", "server.ts"]
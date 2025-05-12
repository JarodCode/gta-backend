FROM denoland/deno:1.32.4

# The port that your application listens to.
EXPOSE 8000

WORKDIR /app

# Cache the dependencies as a layer
COPY deps.ts .
RUN deno cache deps.ts

# Add application source code
COPY . .

# Compile the app (optional, for faster startup)
RUN deno cache main.ts

# Run with necessary permissions
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]

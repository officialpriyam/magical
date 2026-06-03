FROM node:21-slim

WORKDIR /home/user/vue-app

RUN npx nuxi@latest init . --packageManager=npm --gitInit=no -f
RUN npx nuxi@latest module add tailwindcss
COPY nuxt.config.ts /home/user/vue-app/nuxt.config.ts

# Move the Vue app to the home directory and remove the Vue directory
RUN mv /home/user/vue-app/* /home/user/ && rm -rf /home/user/vue-app

# Set working directory to user home
WORKDIR /home/user
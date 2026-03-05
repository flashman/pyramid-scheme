FROM nginx:alpine

# Copy nginx config first
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the actual game files — not Dockerfiles or configs
COPY audio/      /usr/share/nginx/html/audio/
COPY draw/       /usr/share/nginx/html/draw/
COPY engine/     /usr/share/nginx/html/engine/
COPY game/       /usr/share/nginx/html/game/
COPY ui/         /usr/share/nginx/html/ui/
COPY worlds/     /usr/share/nginx/html/worlds/
COPY index.html  /usr/share/nginx/html/
COPY main.js     /usr/share/nginx/html/
COPY style.css   /usr/share/nginx/html/

EXPOSE 80

FROM nginx:alpine

# Copy game source files to nginx web root
COPY . /usr/share/nginx/html/

# Replace default nginx config with ours
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

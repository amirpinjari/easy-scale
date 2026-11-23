FROM nginx:1.27-alpine

COPY index.html *.css *.js *.svg /usr/share/nginx/html/

EXPOSE 80

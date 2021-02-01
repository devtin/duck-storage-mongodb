FROM node:12
ADD . /app
WORKDIR /app
EXPOSE 3000
CMD ["npm", "run", "start"]

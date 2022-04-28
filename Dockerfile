FROM node:alpine

COPY package.json ./
COPY yarn.lock ./
RUN yarn install

COPY . .
RUN yarn build

EXPOSE 3000
CMD [ "yarn", "start" ]
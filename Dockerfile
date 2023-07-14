FROM node:20-slim
USER node
WORKDIR /home/app
CMD ["tail", "-f", "/dev/null"]

FROM node:20-slim
USER node
CMD ["tail" "-f" "/dev/null"]
#CMD ["npm" "run" "start:dev"]

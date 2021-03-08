FROM node:10
RUN apt-get update \
     && apt-get install -y curl unoconv libreoffice poppler-utils catdoc docx2txt odt2txt \
     && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
COPY start.sh /usr/local/bin/start
COPY package.json /usr/src/app/package.json
RUN npm install
RUN chmod +x /usr/local/bin/start
COPY . .
CMD ["/usr/local/bin/start"]
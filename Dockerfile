FROM node:10
RUN apt-get update \
     && apt-get install -y curl poppler-utils catdoc docx2txt odt2txt --no-install-recommends \
     && curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py && python get-pip.py \
     && pip install pdfminer \
     && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
COPY start.sh /usr/local/bin/start
COPY package.json /usr/src/app/package.json
RUN npm install
RUN chmod +x /usr/local/bin/start
COPY . .
CMD ["/usr/local/bin/start"]
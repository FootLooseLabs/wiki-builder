FROM nikolaik/python-nodejs:python3.9-nodejs16

RUN pip install mkdocs

RUN pip install mkdocs-with-pdf

RUN pip install mkdocs-mermaid2-plugin

RUN pip install mkdocs-material


RUN npm -g config set user root

RUN npm i -g npm@latest

ADD package.json /package.json

ADD index.js /index.js

ADD entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

RUN npm install

RUN ls

ENTRYPOINT ["/entrypoint.sh"]

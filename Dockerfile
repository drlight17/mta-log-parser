# Dockerfile for deploy
FROM python:3.9-alpine
RUN apk update
RUN apk add bash ncurses musl-dev gcc flock openldap-dev
# upgrade pip
RUN pip install --upgrade pip
RUN pip3 install -U pipenv
WORKDIR /app
COPY Pipfile /app/
# uncomment to append ypur ca cert for TLS connections i.e. LDAPS
#COPY ca.crt /usr/local/share/ca-certificates/ca.crt
#RUN cat /usr/local/share/ca-certificates/ca.crt >> /etc/ssl/certs/ca-certificates.crt
ENV PIPENV_PYTHON=/usr/local/bin/python3.9
RUN pipenv lock && pipenv install --system --deploy
COPY . /app/

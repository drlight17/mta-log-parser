# Dockerfile for production
FROM python:3.8-alpine
RUN apk update
RUN apk add bash ncurses musl-dev gcc flock
RUN pip3 install -U pipenv
WORKDIR /app
COPY . /app/
RUN pipenv install

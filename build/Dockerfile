FROM python:3.8-alpine
RUN apk update
RUN apk add bash ncurses musl-dev gcc flock
RUN pip3 install -U pipenv
WORKDIR /app
COPY Pipfile /app/
# uncomment to append ypur ca cert for TLS connections i.e. LDAPS, place crt file in folder with Dockerfile
#COPY ca.crt /usr/local/share/ca-certificates/ca.crt
#RUN cat /usr/local/share/ca-certificates/ca.crt >> /etc/ssl/certs/ca-certificates.crt
RUN pipenv install

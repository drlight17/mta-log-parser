#!/usr/bin/env bash

docker-compose down
docker rmi drlight17/mta-log-parser -f
docker-compose up -d

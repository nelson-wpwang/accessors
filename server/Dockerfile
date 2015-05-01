FROM	ubuntu:14.04

RUN apt-get update --fix-missing

# Install curl (apparently we're in the minimalist view of the world w/ ubuntu)
RUN	apt-get install -y --force-yes -q curl

# Seems we have to install git as well (let's err on the side of caution w/ b-e too)
RUN	sudo apt-get install -y build-essential git

# Install pip
RUN	sudo apt-get install -y python3-pip

# Install io.js
RUN gpg --keyserver pool.sks-keyservers.net --recv-keys \
  9554F04D7259F04124DE6B476D5A82AC7E37093B \
  DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
  FD3A5288F042B6850C66B31F09FE44734EB7990E

ENV IOJS_VERSION 1.8.1

RUN curl -SLO "https://iojs.org/dist/v$IOJS_VERSION/iojs-v$IOJS_VERSION-linux-x64.tar.gz" \
  && curl -SLO "https://iojs.org/dist/v$IOJS_VERSION/SHASUMS256.txt.asc" \
  && gpg --verify SHASUMS256.txt.asc \
  && grep " iojs-v$IOJS_VERSION-linux-x64.tar.gz\$" SHASUMS256.txt.asc | sha256sum -c - \
  && tar -xzf "iojs-v$IOJS_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
  && rm "iojs-v$IOJS_VERSION-linux-x64.tar.gz" SHASUMS256.txt.asc

# Copy my app source code
ADD	accessors	/accessors
ADD	interfaces	/interfaces
ADD	groups		/groups
ADD	server		/server
ADD	tests		/tests
ADD	requirements.txt	/requirements.txt

# Install python deps
RUN	pip3 install -r requirements.txt

# Install node requirements
RUN	cd /server; npm install

# Allow access to server port
EXPOSE	6565

CMD	["python3", "server/accessor_host.py", "-p", "/accessors", "-i", "/interfaces"]

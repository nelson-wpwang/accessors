FROM	ubuntu:14.04

# Install curl (apparently we're in the minimalist view of the world w/ ubuntu)
RUN	apt-get install -y --force-yes -q curl

# Install node
RUN	curl -sL https://deb.nodesource.com/setup | sudo bash -
RUN	sudo apt-get install -y nodejs

# Install bower
RUN npm install -g bower

# Copy my app source code
COPY	runtimes/web /web_runtime
COPY	requirements.txt	/requirements.txt

# Seems we have to install git as well (let's err on the side of caution w/ b-e too)
RUN	sudo apt-get install -y git build-essential

# Install python requirements
RUN	sudo apt-get install -y python3-pip
RUN	pip3 install -r requirements.txt

# Install bower requirements
RUN cd /web_runtime/static; bower install --allow-root

# Allow access to server port
EXPOSE	5000

#CMD	["python3", "server/accessor_host.py", "-p", "/accessors", "-i", "/interfaces"]

ENTRYPOINT ["python3", "web_runtime/server.py"]

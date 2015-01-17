FROM	ubuntu:14.04

# Install curl (apparently we're in the minimalist view of the world w/ ubuntu)
RUN	apt-get install -y --force-yes -q curl

# Install node
RUN	curl -sL https://deb.nodesource.com/setup | sudo bash -
RUN	sudo apt-get install -y nodejs

# Copy my app source code
COPY	accessors	/accessors
COPY	interfaces	/interfaces
COPY	groups		/groups
COPY	server		/server
COPY	tests		/tests
COPY	tools		/tools
COPY	requirements.txt	/requirements.txt

# Seems we have to install git as well (let's err on the side of caution w/ b-e too)
RUN	sudo apt-get install -y git build-essential

# Install python requirements
RUN	sudo apt-get install -y python3-pip
RUN	pip3 install -r requirements.txt

# Install node requirements
RUN	cd /server; npm install

# Allow access to server port
EXPOSE	6565

CMD	["python3", "server/accessor_host.py", "-p", "/accessors", "-i", "/interfaces"]

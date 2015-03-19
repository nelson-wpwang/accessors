FROM	ubuntu:14.04

RUN apt-get update --fix-missing

# Install curl (apparently we're in the minimalist view of the world w/ ubuntu)
RUN	apt-get install -y --force-yes -q curl

# Seems we have to install git as well (let's err on the side of caution w/ b-e too)
RUN	sudo apt-get install -y build-essential git

# Install pip
RUN	sudo apt-get install -y python3-pip

# Install node
RUN	curl -sL https://deb.nodesource.com/setup | sudo bash -
RUN	sudo apt-get install -y nodejs

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

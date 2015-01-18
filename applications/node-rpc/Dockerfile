FROM	ubuntu:14.04

# Install curl (apparently we're in the minimalist view of the world w/ ubuntu)
RUN	apt-get install -y --force-yes -q curl

# Install node
RUN	curl -sL https://deb.nodesource.com/setup | sudo bash -
RUN	sudo apt-get install -y nodejs

# Seems we have to install git as well (let's err on the side of caution w/ b-e too)
RUN	sudo apt-get install -y git build-essential

# Install nvm and use new node
RUN	mkdir /nvm
RUN	curl https://raw.githubusercontent.com/creationix/nvm/v0.22.2/install.sh | NVM_DIR=nvm bash
RUN	bash -c "source /nvm/nvm.sh && nvm install 0.11"

# Copy my app source code
COPY	groups			/groups
COPY	runtimes/node		/node-runtime
COPY	applications/node-rpc	/app

# Install node requirements
RUN	cd /node-runtime; npm install
RUN	cd /app; npm install

# This sets up our cross-package relationship; it's like npm install only without
# all the uploading and downloading and copying of the node runtime
RUN	cd /app/node_modules && rm -f accessors && ln -s ../../node-runtime accessors

# Allow access to server port
EXPOSE	3000:3000

# Hack around directory specificity of node_modules
RUN	echo '#!/bin/bash\nset -e\nsource /nvm/nvm.sh\nnvm use 0.11\ncd /app\nnode rpc.js "$@"' > run.sh && chmod +x run.sh

ENTRYPOINT ["bash", "run.sh"]

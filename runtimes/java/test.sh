#!/usr/bin/env bash

set -e

if [ ! -e bower_components/traceur-runtime/traceur-runtime.js ]; then
	echo -e "\nRunning bower..."
	bower install
fi
if [ ! -e bower_components/traceur/traceur.js ]; then
	echo -e "\nRunning bower..."
	bower install
fi

echo -e "\nCompiling..."
javac AccessorRuntime.java

echo -e "\nRunning..."
java AccessorRuntime -s http://localhost:6565 -l /usa/michigan/annarbor/universityofmichigan/bbb/4908/

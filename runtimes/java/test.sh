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
#javac -Xlint:unchecked AccessorRuntime.java
javac AccessorRuntime.java
#javac Arguments.java
#javac Log.java
#javac HueSingle.java
#javac Stock.java
#javac RpiDoor.java
javac Nop.java

echo -e "\nRunning..."
#java AccessorRuntime -s http://localhost:6565 -l /usa/michigan/annarbor/universityofmichigan/bbb/4908/
#java HueSingle
#java Stock -l /
java Nop

#!/usr/bin/env bash

set -e

echo -e "\nCompiling..."
javac AccessorRuntime.java

echo -e "\nRunning..."
java AccessorRuntime -s http://localhost:6565 -l /usa/michigan/annarbor/universityofmichigan/bbb/4908/

#!/bin/bash
set -e
./node_modules/.bin/browserify -t [ babelify --presets [ es2015 react ] ] yabandeh.js -o html/js/yabandeh.js
./node_modules/.bin/browserify -t [ babelify --presets [ es2015 react ] ] ramp.js -o html/js/ramp.js
./node_modules/.bin/browserify -t [ babelify --presets [ es2015 react ] ] paxos.js -o html/js/paxos.js
cp ./node_modules/react/dist/react.min.js html/js/react.js
cp ./node_modules/react-dom/dist/react-dom.min.js html/js/react-dom.js

#!/bin/bash
set -e
./node_modules/.bin/browserify -t [ babelify --presets [ react ] ] yabandeh.js -o html/js/yabandeh.js
./node_modules/.bin/browserify -t [ babelify --presets [ react ] ] ramp.js -o html/js/ramp.js
cp ./node_modules/react/dist/react.js html/js/react.js
cp ./node_modules/react-dom/dist/react-dom.js html/js/react-dom.js

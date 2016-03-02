#!/bin/bash
set -e
./node_modules/.bin/browserify -t [ babelify --presets [ react ] ] yabandeh.js -o html/js/yabandeh.js
cp ./node_modules/react/dist/react.min.js html/js/react.js
cp ./node_modules/react-dom/dist/react-dom.min.js html/js/react-dom.js

module.exports = hl2;

var TML = require("../stepbystep/view").TML;

function hl2(text) {
    return html(
        text
            .replace(/"([^"]+)"/g, "<span class=\"string\">\"$1\"</span>")
            .replace(/function ([^(]+)\(/g, "function <span class=\"fun-name\">$1</span>(")
            .replace(/this.([^ ]+) = function/, "this.<span class=\"fun-name\">$1</span> = function")
            .replace(/function/g, "<span class=\"function\">function</span>")
            .replace(/([^a-z])(\d+)/g, "$1<span class=\"number\">$2</span>")
            .replace(/return/g, "<span class=\"return\">return</span>")
            .replace(/while/g, "<span class=\"while\">while</span>")
            .replace(/if/g, "<span class=\"if\">if</span>")
            .replace(/else/g, "<span class=\"else\">else</span>")
            .replace(/try/g, "<span class=\"try\">try</span>")
            .replace(/catch/g, "<span class=\"catch\">catch</span>")
            .replace(/true/g, "<span class=\"bool\">true</span>")
            .replace(/false/g, "<span class=\"bool\">false</span>")
            .replace(/this/g, "<span class=\"this\">this</span>")
            .replace(/var/g, "<span class=\"var\">var</span>")
    );
}

function html(text) {
    return TML.html(text);
}
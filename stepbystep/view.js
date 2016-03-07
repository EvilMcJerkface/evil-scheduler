var TML = {};
TML.Click = function(x, f) { 
    return {is_click: true, text: x, f: f };
}
TML.html = function(text) { 
    return {is_html: true, text: text };
}

module.exports.TML = TML;

module.exports.CodeView = React.createClass({
    renderCodeDOMRawHTML: function(codeDOM) {
        var shift = 4;
        if (this.props.shift) {
            shift = this.props.shift;
        }
        return codeDOM.accept_writer(
            0, HtmlCodeWriter(), shift
        ).get(this.props.width);
    },
    render: function() {
        return (
            <div className="codeView">
            {this.renderCodeDOMRawHTML(this.props.dom)}
            </div>
        );
    }
});

module.exports.buildShadesMap = buildShadesMap;

function buildShadesMap(set) {
    var tss = [];
    var ts_pos = {};
    for (var ts in set) {
        if (!set.hasOwnProperty(ts)) {
            continue;
        }
        if (!set[ts]) {
            continue;
        }
        tss.push(parseInt(ts));
    }
    tss = tss.sort(function(x,y){return x-y;});
    for (var i=0;i<tss.length;i++) {
        ts_pos[tss[i]] =  (1.0 + i) / tss.length;
    }
    return ts_pos;
}

function HtmlCodeWriter() {
    var self = {
        line_group: {
            is_group: true,
            label: null,
            lines: [],
            prev: null
        },
        begin_marked: function(label) {
            var prev = self.line_group;
            self.line_group = {
                is_group: true,
                label: label,
                lines: [],
                prev: prev
            };
        },
        end_marked: function() {
            var curr = self.line_group;
            self.line_group = curr.prev;
            self.line_group.lines.push(curr);
        },
        write: function(marked, offset, line) {
            var off = repeat(" ", offset);

            var sink = [<span>{off}</span>];
            fill_with_tml(line, sink, off);
            line = sink;

            var h = 0;
            var s = 0;
            var a = 0.0;
            var c = 0

            for (var thread_id in marked) {
                if (!marked.hasOwnProperty(thread_id)) {
                    continue;
                }
                var thread = marked[thread_id].thread;
                var ts_pos = buildShadesMap(thread.trace);
                var hit = -1;
                marked[thread_id].hits.forEach(function(x){
                    hit = Math.max(hit, x);
                });
                if (hit != -1) {
                    h += thread.color.h;
                    s += thread.color.s;
                    a += ts_pos[hit];
                    c += 1;
                }
            }

            if (c>0) {
                self.line_group.lines.push({
                    is_group: false,
                    is_current: true,
                    color: {h: Math.floor(h/c), s: Math.floor(s/c), a: a/c},
                    text: line
                });
            } else {
                self.line_group.lines.push({
                    is_group: false,
                    is_current: false,
                    text: line
                })
            }

            function fill_with_tml(element, sink, off) {
                if ((typeof element)=="string") {
                    sink.push(<span>{element.replace(/\n/g, "\n" + off)}</span>);
                    return;
                }
                if (Array.isArray(element)) {
                    element.forEach(function(item){
                        fill_with_tml(item, sink, off);
                    });
                    return;
                }
                if ((typeof element)=="object") {
                    if (element.is_html) {
                        sink.push(<span dangerouslySetInnerHTML={{
                            __html: element.text.replace(/\n/g, "\n" + off)
                        }} />);
                        return;
                    }
                    if (element.is_click) {
                        var subsink = [];
                        fill_with_tml(element.text, subsink, off);
                        sink.push(<span className="code_link" onClick={element.f}>{subsink}</span>);
                        return;
                    }
                    throw "WTF?!";
                }
            }
        },
        get: function(width) {
            if (self.line_group.label != null) {
                throw "WTF?!";
            }

            var pres = [];
            render_group(self.line_group, true, pres);
            return (<div className={"sourceCode"}>{pres}</div>);


            function render_group(group, is_last_group, pres) {
                var widthStyle = {};
                if (width) {
                    widthStyle.width = "" + width + "ch";
                }

                var text = [];
                for (var i=0;i<group.lines.length;i++) {
                    var isLast = (i==group.lines.length-1);
                    var line = group.lines[i];
                    if (line.is_group) {
                        pres.push(<pre style={widthStyle}>{text}</pre>);
                        text = [];
                        var sub = [];
                        render_group(line, isLast && is_last_group, sub);
                        pres.push(<div className={"sourceCode " + line.label}>{sub}</div>);
                    } else {
                        if (line.is_current) {
                            pres.push(<pre style={widthStyle}>{text}</pre>);
                            var style = clone(widthStyle);
                            style.backgroundColor = "hsla(" +
                                line.color.h + "," +
                                line.color.s + "%," +
                                "40%," +
                                line.color.a +
                            ")";
                            var lineView = [line.text];
                            if (!(isLast && is_last_group)) {
                                lineView.push(<span>{"\n"}</span>);  
                            }
                            pres.push(<pre style={style}>{lineView}</pre>);
                            text = [];
                        } else {
                            text.push(line.text);
                            if (!isLast) {
                                text.push(<span>{"\n"}</span>);
                            }
                        }
                    }
                }
                pres.push(<pre style={widthStyle}>{text}</pre>);
            }
        }
    };
    return self;
    function active_threads(threads) {
        var active = [];
        for (var x in threads) {
            if (threads.hasOwnProperty(x)) {
                if (threads[x]) {
                    active.push("" + x);
                } 
            }
        }
        return active;
    }
    function repeat(text, n){
        var off = "";
        for (var i=0;i<n;i++) {
            off += text;
        }
        return off;
    }
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }
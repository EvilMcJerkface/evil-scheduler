module.exports.CodeView = React.createClass({
    renderCodeDOMRawHTML: function(codeDOM) {
        var html = codeDOM.accept_writer(0, HtmlCodeWriter(this.props.threads_marker)).get();
        return { __html: html };
    },
    render: function() {
        return (
            <div
                className="codeView"
                dangerouslySetInnerHTML={this.renderCodeDOMRawHTML(this.props.dom)} />
        );
    }
});

function HtmlCodeWriter(threads_marker) {
    var self = {
        lines: [],
        write: function(threads, offset, line) {
            var off = repeat(" ", offset);
            var active = active_threads(threads);
            if (active.length>0) {
                self.lines.push({
                    is_current: true,
                    class_name: threads_marker(active),
                    line: off + line.replace(/\n/g, "\n" + off)
                });
            } else {
                self.lines.push({
                    is_current: false,
                    line: off + line.replace(/\n/g, "\n" + off)
                })
            }
        },
        get: function() {
            var text = "";
            for (var i=0;i<self.lines.length;i++) {
                var isLast = (i==self.lines.length-1);
                var line = self.lines[i];
                var line_text = line.line + (isLast ? "" : "\n");
                if (line.is_current) {
                    text += "</pre><pre class=\"" + line.class_name + "\">"
                    text += line_text;
                    text += "</pre><pre>";
                } else {
                    text += line_text;
                }
            }
            return "<pre>" + text + "</pre>";
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
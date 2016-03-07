var view = require("../stepbystep/view");
var CodeView = view.CodeView;

var ThreadControl = React.createClass({
    nextHandler: function() {
        this.props.thread.iter();
    },
    abortHandler: function() {
        this.props.thread.abort();
    },
    rerunHandler: function() {
        this.props.thread.init();
    },
    render: function() {
        var controls = [];
        var title = this.props.title;
        if (this.props.thread.is_active) {
            controls.push(<span className="tv-btn"><button onClick={this.nextHandler}>Step</button></span>);
            controls.push(<span className="tv-btn"><button onClick={this.abortHandler}>Abort</button></span>);
        } else {
            if (this.props.thread.was_active) {
                controls.push(<span className="tv-btn"><button onClick={this.rerunHandler}>Restart</button></span>);
                controls.push(<span className="tv-status">{this.props.thread.was_aborted ? "Aborted" : "Executed"}</span>);
            } else {
                controls.push(<span className="tv-btn"><button onClick={this.rerunHandler}>Start</button></span>);
            }
        }
        return (<div className="thread-control">{title}{controls}</div>);
    }
});

module.exports = React.createClass({
    render: function() {
        return (
            <div className="thread-view">
                <ThreadControl title = {this.props.title} thread = {this.props.thread} />
                <CodeView dom = {this.props.thread.thread} />
            </div>
        )
    }
});
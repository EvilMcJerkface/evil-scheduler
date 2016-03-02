var YabandehModel = require("./YabandehModel");
var view = require("../stepbystep/view");
var ThreadControl = require("./ThreadControl");

var CodeView;
var DBView = require("./DBView");
var TXView = require("./TXView");

var ThreadView = React.createClass({
    render: function() {
        return (
            <div className="info-block threadview">
                <h3>{this.props.title}</h3>
                <CodeView dom = {this.props.thread.thread} />
                <ThreadControl thread = {this.props.thread} />
            </div>
        )
    }
});

module.exports = React.createClass({
    getInitialState: function() {
        var app_model = YabandehModel();
        app_model.on_state_updated = (function(app_model) {
            this.setState(app_model);
        }).bind(this);

        return app_model;
    },

    render: function() {
        return (
            <table>
                <tbody>
                    <tr>
                        <td className="first-td">
                            <CodeView dom = {this.state.clean_read} />
                        </td>
                        <td className="second-td">
                            <CodeView dom = {this.state.update} />
                            <CodeView dom = {this.state.commit} />
                            <CodeView dom = {this.state.clean} />
                        </td>
                        <td className="third-td">
                            <ThreadView title="Swap a and b" thread={this.state.tx1} />
                            <ThreadView title="Swap b and c" thread={this.state.tx2} />
                            <DBView db={this.state.db} />
                            <TXView db={this.state.db} />
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    }
});

var CodeView = React.createClass({
    render: function() {
        var CV = view.CodeView;
        return (
            <CV dom = {this.props.dom} threads_marker = {threads_marker} />
        );
    }
});

function threads_marker(threads) {
    if (threads.length > 2) throw "WTF";
    var known = {
        "0": true,
        "1": true
    };
    for (var i=0;i<threads.length;i++) {
        if (!known[threads[i]]) throw "WTF";
    }
    if (threads.length == 2) {
        return "thread01";
    }
    if (threads.length == 1) {
        return "thread" + threads[0];
    }
    return "nop";
}
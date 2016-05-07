var PaxosModel = require("./PaxosModel");
var view = require("../stepbystep/view");
var ThreadView = require("../yabandeh/ThreadView");
var CodeView = view.CodeView;
var SideView = require("./SideView");

var ThreadControl = React.createClass({
    nextHandler: function() {
        this.props.thread.iter();
    },
    rerunHandler: function() {
        this.props.thread.init();
    },
    render: function() {
        var control = null;
        if (this.props.thread.is_active) {
            control = (<span className="tv-btn"><button onClick={this.nextHandler} disabled={!!this.props.thread.data.isPaused}>Step</button></span>);
        } else {
            control = (<span className="tv-btn"><button onClick={this.rerunHandler} disabled={!!this.props.thread.data.isPaused}>Start</button></span>);
        }
        return control;
    }
});

module.exports = React.createClass({
    getInitialState: function() {
        PaxosModel.on_state_updated = (function(app_model) {
            this.setState(app_model);
        }).bind(this);

        return PaxosModel;
    },

    render: function() {
        return (
            <table>
                <tbody>
                    <tr>
                        <td className="first-td" style={{verticalAlign: "top"}}>
                            <CodeView shift={2} dom = {this.state.paxos} />
                        </td>
                        <td className="second-td" style={{verticalAlign: "top"}}>
                            <CodeView shift={2} dom = {this.state.client} />
                        </td>
                        <td className="third-td" style={{verticalAlign: "top"}}>
                            <div className="thread-controls">
                                <div className="lee-control">
                                    <div className="general"><span>General Lee</span></div>
                                    <div className="control"><ThreadControl thread = {this.state.tx1} /></div>
                                    <div className="clear"></div>
                                </div>
                                <div className="ross-control">
                                    <div className="general"><span>General Ross</span></div>
                                    <div className="control"><ThreadControl thread = {this.state.tx2} /></div>
                                    <div className="clear"></div>
                                </div>
                            </div>
                            <SideView model={this.state} />
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    }
});
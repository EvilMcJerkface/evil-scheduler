var RAMPModel = require("./RAMPModel");
var view = require("../stepbystep/view");
var ThreadView = require("../yabandeh/ThreadView");
var SideView = require("./SideView");

var CodeView = view.CodeView;

module.exports = React.createClass({
    getInitialState: function() {
        RAMPModel.on_state_updated = (function(app_model) {
            this.setState(app_model);
        }).bind(this);

        return RAMPModel;
    },

    render: function() {
        return (
            <table>
                <tbody>
                    <tr>
                        <td className="first-td" style={{verticalAlign: "top"}}>
                            <CodeView dom = {this.state.proposer} shift={2} width={68} />
                        </td>
                        <td className="second-td" style={{verticalAlign: "top"}}>
                            <div style={{"position": "relative"}}>
                                <div style={{"position": "fixed"}}>
                                    <div>
                                        <div style={{"display": "inline-block", marginRight: "5px"}}>
                                            <ThreadView title="Tx#1" thread={this.state.tx1} model = {this.state} />
                                        </div>
                                        <div style={{"display": "inline-block"}}>
                                            <ThreadView title="Tx#2" thread={this.state.tx2} model = {this.state} />
                                        </div>
                                    </div>
                                    <SideView model={this.state} />
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    }
});
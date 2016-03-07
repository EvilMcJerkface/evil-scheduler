var YabandehModel = require("./YabandehModel");
var view = require("../stepbystep/view");
var ThreadView = require("./ThreadView");

var CodeView = view.CodeView;
var DBView = require("./DBView");
var TXView = require("./TXView");

module.exports = React.createClass({
    getInitialState: function() {
        YabandehModel.on_state_updated = (function(app_model) {
            this.setState(app_model);
        }).bind(this);

        return YabandehModel;
    },

    render: function() {
        return (
            <table>
                <tbody>
                    <tr>
                        <td className="first-td">
                            <CodeView shift={2} dom = {this.state.clean_read} />
                        </td>
                        <td className="second-td">
                            <CodeView shift={2} dom = {this.state.update} />
                            <CodeView shift={2} dom = {this.state.commit} />
                            <CodeView shift={2} dom = {this.state.clean} />
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
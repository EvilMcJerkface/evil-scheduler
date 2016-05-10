var Menu;

var StackView = require("../stepbystep/sideview/StackView");
var obj_to_table = require("../stepbystep/sideview/obj_to_table");
var HashVar = require("../stepbystep/model").HashVar;
var Messages = require("./Messages");
var view = require("../stepbystep/view");
var CodeView = view.CodeView;

var icbm_proj = require("./utils/icbm_proj");

var DBView = null;

module.exports = React.createClass({
    netClicked: function() {
        this.props.model.set_sideview("net");
        this.props.model.notify();
    },
    dataClicked: function() {
        this.props.model.set_sideview("db");
        this.props.model.notify();
    },
    varsClicked: function() {
        this.props.model.set_sideview("vars");
        this.props.model.notify();
    },
    render: function() {
        var side_view = this.props.model.side_view;

        var view = null;

        if (side_view == "net") {
            view = (<Messages messages={this.props.model.messages.__messages} />)
        } else if (side_view == "db") {
            view = (<DBView model={this.props.model} />)
        } else if (side_view == "vars") {
            view = (<StackView frames={this.props.model.frames}></StackView>);
        } else if (side_view == "help") {
            var database  = (<span className="menulink free" onClick={this.dataClicked}>Database</span>);

            var stack = null;
            if (this.props.model.has_frames_var()) {
                stack = (<span className="menulink free" onClick={this.varsClicked}>Stack</span>);
            } else {
                stack = (<span className="menulink dis">Stack</span>);
            }

            var network = null;
            if (this.props.model.messages.__messages.length>0) {
                network = (<span className="menulink free" onClick={this.netClicked}>{
                    "Network (" +
                        this.props.model.messages.__messages.length +
                    ")"
                }</span>);
            } else {
                network = (<span className="menulink dis">Network (0)</span>);
            }

            var start = null;
            var step = null;
            if (this.props.model.tx1.is_active) {
                var disabled = !!this.props.model.tx1.data.isPaused;
                var next = () => {
                    this.props.model.tx1.iter();
                };
                step = (<button onClick={next} disabled={disabled}>Step</button>);
                start = (<button disabled={true}>Start</button>);
            } else {
                var disabled = !!this.props.model.tx1.data.isPaused;
                var init = () => {
                    this.props.model.tx1.init();
                };
                step = (<button disabled={true}>Step</button>);
                start = (<button onClick={init} disabled={disabled}>Start</button>);
            }


            view = (<div className="help">
                <p>Refresh the page to restart the visualization.</p>
                <p>
                    Click on the General Lee`s {start} button to initiate its thread and then on the {step} button 
                    to evaluate the current step of the thread. Once you get familiar with the one thread add the 
                    Ross`s thread to see how they interact together.
                </p>
                <p>The {database} tab reflects the permanent memory of the system like the proposer`s latest ballot numbers and the state of the acceptors.</p>
                <p>With the {stack} tab you can see the values of the variables visible up to this moment.</p>
                <div>
                    <p>The next line for each acceptor makes a promise RPC call.</p>
                    <CodeView shift={2} dom = {this.props.model.promise_rpc_call} />
                    <p>While the next line blocks the execution and awaits the majority of successful answers</p>
                    <CodeView shift={2} dom = {this.props.model.promise_rpc_wait} />
                </div>
                <p>On the {network} tab you can control order in which messages between proposers and acceptors are delivered or even lost some of them.</p>
            </div>);
        }
        return (
            <div className="data-area">
                <Menu model={this.props.model} />
                {view}
            </div>
        );
    }
});

DBView = React.createClass({
    render: function() {
        var promised = [];
        this.props.model.acceptors.forEach(acceptor => {
            for (var key in acceptor.promised) {
                promised.push({
                    acceptor: acceptor.name,
                    key: key,
                    value: acceptor.promised[key]
                });
            }
        });

        var accepted = [];
        this.props.model.acceptors.forEach(acceptor => {
            for (var key in acceptor.accepted) {
                var value = null;
                if (acceptor.accepted[key].value!=null) {
                    var signs = [];
                    for (var general in acceptor.accepted[key].value.signOffs) {
                        signs.push(general);
                    }
                    value = [{
                        signOffs: signs,
                        isSent: acceptor.accepted[key].value.isSent
                    }];
                }
                
                accepted.push({
                    acceptor: acceptor.name,
                    key: key,
                    ballot: acceptor.accepted[key].ballot,
                    value: value
                });
            }
        });

        var tables = [];

        tables.push(<div>
            <div className="table_name">Proposers</div>
            {obj_to_table(this.props.model.proposers)}
        </div>);


        if (promised.length>0) {
            tables.push(<div>
                <div className="table_name">Promised</div>
                {obj_to_table(promised)}
            </div>);
        }

        if (accepted.length>0) {
            tables.push(<div>
                <div className="table_name">Accepted</div>
                {obj_to_table(accepted)}
            </div>);
        }

        return (<div className="databases">
            {tables}
        </div>);
    }
});

Menu = React.createClass({
    netClicked: function() {
        this.props.model.set_sideview("net");
        this.props.model.notify();
    },
    dataClicked: function() {
        this.props.model.set_sideview("db");
        this.props.model.notify();
    },
    varsClicked: function() {
        this.props.model.set_sideview("vars");
        this.props.model.notify();
    },
    helpClicked: function() {
        this.props.model.set_sideview("help");
        this.props.model.notify();
    },
    render: function() {
        var side_view = this.props.model.side_view;

        var menu = [];
        if (side_view == "net") {
            menu.push(<span className="curr">{
                "Network (" +
                    this.props.model.messages.__messages.length +
                ")"
            }</span>);
        } else {
            if (this.props.model.messages.__messages.length>0) {
                menu.push(<span className="free" onClick={this.netClicked}>{
                    "Network (" +
                        this.props.model.messages.__messages.length +
                    ")"
                }</span>);
            } else {
                menu.push(<span className="dis">Network (0)</span>);
            }
        }

        if (side_view == "db") {
            menu.push(<span className="curr">Database</span>);
        } else {
            menu.push(<span className="free" onClick={this.dataClicked}>Database</span>);
        }
        
        if (side_view == "vars") {
            menu.push(<span className="curr">Stack</span>);
        } else {
            if (this.props.model.has_frames_var()) {
                menu.push(<span className="free" onClick={this.varsClicked}>Stack</span>);
            } else {
                menu.push(<span className="dis">Stack</span>);
            }
        }

        if (side_view == "help") {
            menu.push(<span className="curr">Help</span>);
        } else {
            menu.push(<span className="free" onClick={this.helpClicked}>Help</span>);
        }

        return (<div className="menu">{menu}</div>);
    }
});

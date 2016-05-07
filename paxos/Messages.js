var obj_to_table = require("../stepbystep/sideview/obj_to_table");
var HashVar = require("../stepbystep/model").HashVar;
var icbm_proj = require("./utils/icbm_proj");

module.exports = React.createClass({
    render: function() {
        var messages = this.props.messages;
        messages.sort(function(a,b) { return a.id - b.id; });
        var output = [];
        messages.forEach(function(msg) {
            var color = "hsla(" +
                msg.thread.color.h + "," +
                msg.thread.color.s + "%," +
                "40%," +
                1 +
            ")";
            if (msg.isPromise) {
                output.push((<div className="messages-msg promiseMsg" style={{borderColor: color}}>
                    <div className="msg-header" style={{backgroundColor: color}}>
                        <button onClick={msg.execute.bind(msg)}>Invoke</button>
                        <button onClick={msg.lost.bind(msg)}>Lost</button>
                    </div>
                    <div className="msg-body">
                        <div className="msg-label">Invoke promise with</div>
                        <div className="promise-value">{obj_to_table([{
                            acceptor: msg.acceptor.name,
                            key: msg.key,
                            ballot: msg.ballot
                        }])}</div>
                    </div>
                </div>));
            } else if (msg.isPromiseOk) {
                output.push((<div className="messages-msg promiseOkMsg" style={{borderColor: color}}>
                    <div className="msg-header" style={{backgroundColor: color}}>
                        <button onClick={msg.execute.bind(msg)}>Return</button>
                        <button onClick={msg.lost.bind(msg)}>Lost</button>
                    </div>
                    <div className="msg-body">
                        <div className="msg-label">Return</div>
                        <div className="promise-ok-value">{obj_to_table([{
                            ballot: msg.accepted.ballot,
                            value: icbm_proj(msg.accepted.value)
                        }])}</div>
                        <div className="msg-label">as a result of calling promise with</div>
                        <div className="promise-value">{obj_to_table([{
                            acceptor: msg.promise.acceptor.name,
                            key: msg.promise.key,
                            ballot: msg.promise.ballot
                        }])}</div>
                    </div>
                </div>));
            } else if (msg.isPromiseFail) {
                output.push((<div className="messages-msg promiseFailMsg" style={{borderColor: color}}>
                    <div className="msg-header" style={{backgroundColor: color}}>
                        <button onClick={msg.execute.bind(msg)}>Deliver</button>
                        <button onClick={msg.lost.bind(msg)}>Lost</button>
                    </div>
                    <div className="msg-body">
                        <div className="msg-label">Return failure</div>
                        <div className="promise-failure-value">{obj_to_table([{
                                ballot: msg.ballot
                            }])}</div>
                        <div className="msg-label">as a result of calling promise with</div>
                        <div className="promise-value">{obj_to_table([{
                            acceptor: msg.promise.acceptor.name,
                            key: msg.promise.key,
                            ballot: msg.promise.ballot
                        }])}</div>
                    </div>
                </div>));
            } else if (msg.isAccept) {
                output.push((<div className="messages-msg acceptMsg" style={{borderColor: color}}>
                    <div className="msg-header" style={{backgroundColor: color}}>
                        <button onClick={msg.execute.bind(msg)}>Deliver</button>
                        <button onClick={msg.lost.bind(msg)}>Lost</button>
                    </div>
                    <div className="msg-body">
                        <div className="msg-label">Invoke accept with</div>
                        <div className="accept-value">{obj_to_table([{
                            acceptor: msg.acceptor.name,
                            key: msg.key,
                            ballot: msg.ballot,
                            value: icbm_proj(msg.value)
                        }])}</div>
                    </div>
                </div>));
            } else if (msg.isAcceptOk) {
                output.push((<div className="messages-msg acceptOkMsg" style={{borderColor: color}}>
                    <div className="msg-header" style={{backgroundColor: color}}>
                        <button onClick={msg.execute.bind(msg)}>Confirm</button>
                        <button onClick={msg.lost.bind(msg)}>Lost</button>
                    </div>
                    <div className="msg-body">
                        <div className="msg-label">Confirm invocation of accept with</div>
                        <div className="promise-value">{obj_to_table([{
                            acceptor: msg.request.acceptor.name,
                            key: msg.request.key,
                            ballot: msg.request.ballot,
                            value: icbm_proj(msg.request.value)
                        }])}</div>
                    </div>
                </div>));
            } else if (msg.isAcceptFail) {
                output.push((<div className="messages-msg acceptFailureMsg" style={{borderColor: color}}>
                    <div className="msg-header" style={{backgroundColor: color}}>
                        <button onClick={msg.execute.bind(msg)}>Deliver</button>
                        <button onClick={msg.lost.bind(msg)}>Lost</button>
                    </div>
                    <div className="msg-body">
                        <div className="msg-label">Return failure</div>
                        <div className="promise-failure-value">{obj_to_table([{
                                ballot: msg.ballot
                            }])}</div>
                        <div className="msg-label">as a result of calling accept with</div>
                        <div className="promise-value">{obj_to_table([{
                            acceptor: msg.request.acceptor.name,
                            key: msg.request.key,
                            ballot: msg.request.ballot,
                            value: icbm_proj(msg.request.value)
                        }])}</div>
                    </div>
                </div>));
            } else if (msg.isThreadMessage) {
                output.push((<div className="messages-msg threadMsg" style={{borderColor: color}}>
                    <div className="msg-header" style={{backgroundColor: color}}>
                        <button onClick={msg.execute.bind(msg)}>Step</button>
                    </div>
                </div>));
            } else if (msg.isUpdateBallotMessage) {
                output.push((<div className="messages-msg threadMsg" style={{borderColor: color}}>
                    <div className="msg-header" style={{backgroundColor: color}}>
                        <button onClick={msg.execute.bind(msg)}>Deliver</button>
                        <button onClick={msg.lost.bind(msg)}>Lost</button>
                    </div>
                    <div className="msg-body">
                        <div className="msg-label">Broadcast ballot counter</div>
                        <div className="promise-failure-value">{obj_to_table([{
                            target: {proposer_id: msg.proposer.proposer_id},
                            fail: {promised_ballot: msg.ballot}
                        }])}</div>
                    </div>
                </div>));
            }
        });
        return (<div className="messages">{output}</div>);
    }
});
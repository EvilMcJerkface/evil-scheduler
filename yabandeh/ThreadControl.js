module.exports = React.createClass({
    nextHandler: function() {
        this.props.thread.iter();
    },
    rerunHandler: function() {
        this.props.thread.init();
    },
    render: function() {
        var button = null;
        var text = "";
        if (this.props.thread.is_active) {
            button = (<button onClick={this.nextHandler}>Execute</button>);
        } else {
            if (this.props.thread.was_active) {
                button = (<button onClick={this.rerunHandler}>Restart</button>);
                if (this.props.thread.was_aborted) {
                    text = "Aborted";
                } else {
                    text = "Executed";
                }
            } else {
                button = (<button onClick={this.rerunHandler}>Start</button>);
            }
        }

        return (<div className="threadControl">
            {button}
            <span>{text}</span>
        </div>);
    }
});
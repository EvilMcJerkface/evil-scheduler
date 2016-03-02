module.exports = React.createClass({
    renderKeyValueTr: function(key, value) {
        return (<tr>
            <th>{key}</th>
            <td>{value.ver}</td>
            <td>{value.value}</td>
            <td>{value.future}</td>
            <td>{value.tx_link}</td>
        </tr>)
    },
    render: function() {
        var a = this.props.db.get("a");
        var b = this.props.db.get("b");
        var c = this.props.db.get("c");
        return (
            <div className="info-block dbview">
                <h3>State</h3>
                <table>
                    <tbody>
                        <tr className="header">
                            <th></th>
                            <th>ver</th>
                            <th>value</th>
                            <th>future</th>
                            <th>tx_link</th>
                        </tr>
                        {this.renderKeyValueTr("a", a)}
                        {this.renderKeyValueTr("b", b)}
                        {this.renderKeyValueTr("c", c)}
                    </tbody>
                </table>
            </div>
        );
    }
});
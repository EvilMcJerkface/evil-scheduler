module.exports = React.createClass({
    render: function() {
        var db = this.props.db; 
        var a = db.get("a");
        var b = db.get("b");
        var c = db.get("c");

        var in_use = {};
        in_use[a.tx_link] = true;
        in_use[b.tx_link] = true;
        in_use[c.tx_link] = true;

        var txs = [];
        for (var key in this.props.db.__storage) {
            if (!this.props.db.__storage.hasOwnProperty(key)) continue;
            if (key.indexOf("tx:")!=0) continue;
            txs.push(key);
        }

        txs.sort(function(x,y) {
            return parseInt(x.substring(3)) - parseInt(y.substring(3));
        });

        var cut = []
        for(var i = Math.max(txs.length - 5, 0);i < txs.length;i++) {
            cut.push(txs[i]);
        }
        txs = cut;

        if (txs.length==0) {
            return (<div className="txview"></div>);
        }

        return (
            <div className="info-block txview">
                <h3>Transactions</h3>
                <table>
                    <tbody>
                        <tr className="header">
                            <th></th>
                            <th>ver</th>
                            <th>status</th>
                        </tr>
                        {txs.map(function(tx_key) {
                            var tx = db.get(tx_key);
                            return (<tr>
                                <th>{tx_key}</th>
                                <td>{tx.ver}</td>
                                <td>{tx.status}</td>
                            </tr>);
                        })}
                    </tbody>
                </table>
            </div>
        );
    }
});
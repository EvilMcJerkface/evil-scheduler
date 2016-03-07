var ProposersView = React.createClass({
    renderValueTr: function(proposer) {
        return (<tr>
            <td className="prop">{proposer.name}</td>
            <td className="prop">{proposer.proposer_id}</td>
            <td className="prop">{proposer.n}</td>
        </tr>)
    },
    render: function() {
        var broadcast = null;
        if (this.props.db.broadcasts.length > 0) {
            broadcast = (<div className="broadcast">
                <div className="title">Broadcast:</div>
                <div>
                    {this.props.db.broadcasts.map(function(broadcast) {
                        function apply() {
                            this.props.db.apply_ballot_number(broadcast.id);
                            this.props.model.notify();
                        }
                        return (<button onClick={apply.bind(this)}>{"n=" + broadcast.n}</button>)
                    }.bind(this))}
                </div>
            </div>);
        }
        return (
            <div className="db2-view proposer-table">
                <h3>Proposers</h3>
                <table className="db2-table">
                    <tbody>
                        <tr>
                            <th>name</th>
                            <th>proposer id</th>
                            <th>n</th>
                        </tr>
                        {this.props.db.proposers.map(function(proposer) {
                            return this.renderValueTr(proposer);
                        }.bind(this))}
                    </tbody>
                </table>
                {broadcast}
            </div>
        );
    }
});

var CommittedView = React.createClass({
    renderValueTr: function(committed) {
        return (<tr>
            <td className="prop">{committed.shard}</td>
            <td className="prop">{committed.key}</td>
            <td className="prop">{committed.txid}</td>
            <td className="prop">{committed.confirmed ? "true" : "false"}</td>
        </tr>)
    },
    render: function() {
        return (
            <div className="db2-view commit-table">
                <h3>Committed</h3>
                <table className="db2-table">
                    <tbody>
                        <tr>
                            <th colSpan="2">key</th>
                            <th className="empty"></th>
                            <th className="empty"></th>
                        </tr>
                        <tr>
                            <th>lender</th>
                            <th>debtor</th>
                            <th>txid</th>
                            <th>is confirmed</th>
                        </tr>
                        {this.props.committed.map(function(committed) {
                            return this.renderValueTr(committed);
                        }.bind(this))}
                    </tbody>
                </table>
            </div>
        );
    }
});

var ValuesView = React.createClass({
    gc: function() {
        this.props.model.gc();
    },
    renderValueTr: function(row) {
        if (row.key == null) {
            return (<tr>
                <td className="prop"></td>
                <td className="prop"></td>
                <td className="prop"></td>
                <td className="prop"></td>
                <td className="prop">{row.meta.lender}</td>
                <td className="prop">{row.meta.debtor}</td>
            </tr>)
        } else {
            var meta = null;
            if (row.meta==null) {
                meta = [
                    <td className="prop"></td>,
                    <td className="prop"></td>
                ]
            } else {
                meta = [
                    <td className="prop">{row.meta.lender}</td>,
                    <td className="prop">{row.meta.debtor}</td>
                ];
            }
            return (<tr>
                <td className="prop">{row.key.lender}</td>
                <td className="prop">{row.key.debtor}</td>
                <td className="prop">{row.txid}</td>
                <td className="prop">{row.value}</td>
                {meta}
            </tr>)
        }
    },
    render: function() {
        var model = this.props.model;

        var rows = []
        for (var i=0;i<this.props.values.length;i++) {
            var base = {
                key: {
                    lender: this.props.values[i].key.lender,
                    debtor: this.props.values[i].key.debtor
                },
                txid: this.props.values[i].txid,
                value: this.props.values[i].value,
                meta: null,
                is_last: true
            };
            if (this.props.values[i].md.length==0) {
                rows.push(base);
            } else {
                var md = this.props.values[i].md;
                for (var j=0;j<md.length;j++) {
                    if (j==0) {
                        rows.push({
                            key: base.key,
                            txid: base.txid,
                            value: base.value,
                            meta: { lender: md[j].lender, debtor: md[j].debtor },
                            is_last: false
                        });
                    } else {
                        rows.push({
                            key: null,
                            meta: { lender: md[j].lender, debtor: md[j].debtor },
                            is_last: j==md.length-1
                        });
                    }
                }
            }
        }

        return (
            <div className="db2-view value-table">
                <h3>Values
                <span className="gc">{!model.tx1.is_active && !model.tx2.is_active ?
                 (<button onClick={this.gc}>Collect garbage</button>) : 
                 (<button disabled="disabled" onClick={this.gc}>Collect garbage</button>) 
                }</span>
                </h3>
                <table className="db2-table">
                    <tbody>
                        <tr>
                            <th colSpan="2">key</th>
                            <th className="empty"></th>
                            <th className="empty"></th>
                            <th colSpan="2">meta</th>
                        </tr>
                        <tr>
                            <th>lender</th>
                            <th>debtor</th>
                            <th>txid</th>
                            <th>value</th>
                            <th>lender</th>
                            <th>debtor</th>
                        </tr>
                        {rows.map(function(row) {
                            return this.renderValueTr(row);
                        }.bind(this))}
                    </tbody>
                </table>
            </div>
        );
    }
});

module.exports = React.createClass({
    render: function() {
        var db = this.props.model.db;
        var model = this.props.model;

        var sharded = {};
        for (var i=0;i<db.values.length;i++) {
            var value = db.values[i];
            if (!sharded.hasOwnProperty(value.key.lender)) {
                sharded[value.key.lender] = true;
            }
        }

        var shards = [];
        for (var shard in sharded) {
            if (!sharded.hasOwnProperty(shard)) continue;
            shards.push(shard);
        }
        shards = shards.sort();

        var committed = [];
        shards = shards.forEach(function(shard) {
            var keys = [];
            for (var key in db.committed[shard]) {
                if (!db.committed[shard].hasOwnProperty(key)) continue;
                keys.push(key);
            }
            keys = keys.sort();

            keys.forEach(function(key) {
                committed.push({
                    shard: shard, 
                    key: key, 
                    txid: db.committed[shard][key].txid,
                    confirmed: db.committed[shard][key].confirmed
                });
            });
        });

        return (
            <table>
                <tbody>
                    <tr>
                        <td style={{verticalAlign: "top"}}>
                            <CommittedView committed={committed} />
                            <ProposersView db={db} model={model} />
                        </td>
                        <td style={{verticalAlign: "top", paddingLeft: "10px"}}>
                            <ValuesView values={reverse(db.values)} model={model} />
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    }
});

function reverse(values) {
    values = JSON.parse(JSON.stringify(values));
    values.reverse();
    return values;
}
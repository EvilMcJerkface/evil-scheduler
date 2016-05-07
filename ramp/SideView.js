var DBView = require("./DBView");
var HashVar = require("../stepbystep/model").HashVar;
var buildShadesMap = require("../stepbystep/view").buildShadesMap;

var GET_QUERY, PREPARE_QUERY, COMMIT_QUERY, FINALIZE_QUERY, DEBTS_QUERY;

var Menu, QueryView;

var StackView = require("../stepbystep/sideview/StackView");

module.exports = React.createClass({
    render: function() {
        var side_view = this.props.model.side_view;

        var view = null;

        if (side_view == "db") {
            view = (<DBView model={this.props.model} />)
        } else if (side_view == "vars") {
            view = (<StackView frames={this.props.model.frames}></StackView>);
        } else if (side_view.indexOf("sql:")==0) {
            view = (<QueryView query={side_view} />);
        }
        return (
            <div className="data-area">
                <Menu model={this.props.model} />
                {view}
            </div>
        );
    }
});

QueryView = React.createClass({
    render: function() {
        var query = "";
        if (this.props.query == "sql:get") {
            query = GET_QUERY;
        } else if (this.props.query == "sql:prepare") {
            query = PREPARE_QUERY;
        } else if (this.props.query == "sql:commit") {
            query = COMMIT_QUERY;
        } else if (this.props.query == "sql:debts") {
            query = DEBTS_QUERY;
        } else if (this.props.query == "sql:confirm") {
            query = FINALIZE_QUERY;
        }
        return (<div><pre>{query}</pre></div>);
    }
});

Menu = React.createClass({
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

        var menu = [];
        if (side_view == "db") {
            menu.push(<span className="curr">Database</span>);
        } else {
            menu.push(<span className="free" onClick={this.dataClicked}>Database</span>);
        }
        
        if (side_view == "vars") {
            menu.push(<span className="curr">Stackframe variables</span>);
        } else {
            if (this.props.model.has_frames_var()) {
                menu.push(<span className="free" onClick={this.varsClicked}>Stackframe variables</span>);
            } else {
                menu.push(<span className="dis">Stackframe variables</span>);
            }
        }

        if (side_view.indexOf("sql:")==0) {
            menu.push(<span className="curr">Query</span>);
        } else {
            menu.push(<span className="dis">Query</span>);
        }

        return (<div className="menu">{menu}</div>);
    }
});



GET_QUERY = "function get($key_txid_pairs) {\n" +
"  A = (\n" +
"    SELECT key, txid \n" +
"    FROM $key_txid_pairs\n" +
"    WHERE txid != NULL\n" +
"  )\n" +
"  B = (\n" +
"    SELECT key\n" +
"    FROM $key_txid_pairs\n" +
"    WHERE txid == NULL\n" +
"  )\n" +
"  C = (\n" +
"    SELECT B.key, c.txid \n" +
"    FROM B LEFT JOIN Committed c \n" +
"     ON c.key == B.key\n" +
"  )\n" +
"  D = A UNION C\n" +
"  return (\n" +
"    SELECT \n" + 
"      key, p.txid, value,\n" +
"      md, confirmed\n" +
"    FROM Prepared p\n" +
"    LEFT JOIN Committed c\n" +
"      ON p.txid == c.txid\n" +
"    WHERE (key, txid) in D\n" +
"  )\n" +
"}";

PREPARE_QUERY = "function prepare($values) {\n" +
"  INSERT INTO Prepared(\n" +
"    key, txid, value, md\n" +
"  ) SELECT key, txid, value, md\n" +
"  FROM $values;\n" +
"}";

COMMIT_QUERY = "function commit($txids) {\n" +
"  A = (\n" +
"    SELECT key, txid, confirmed\n" +
"    FROM Prepared\n" +
"    WHERE txid in $txid\n" +
"  )\n" +
"  Committed = (\n" +
"    SELECT key, MAX(txid)\n" +
"    FROM A UNION Committed\n" +
"    GROUP BY key\n" +
"  )\n" +
"  UPDATE Committed\n" +
"  SET\n" +
"    confirmed = false\n" +
"  WHERE \n" + 
"    txid in $txids AND\n" +
"    NOT(confirmed)\n" +
"}";

FINALIZE_QUERY = "function confirm($txids) {\n" +
"  UPDATE Committed\n" +
"  SET\n" +
"    confirmed = true\n" +
"  WHERE txid in $txids\n" +
"}";

DEBTS_QUERY = "function get_debts_of($person) {\n" +
"  A = (\n" +
"    SELECT key, txid\n" +
"    FROM Committed \n" +
"    WHERE key.creditor = $person\n" +
"  )\n" +
"  return (\n" +
"    SELECT key, txid, value, md\n" +
"    FROM Prepared\n" +
"    WHERE (key, txid) in A\n" +
"  )\n" +
"}";
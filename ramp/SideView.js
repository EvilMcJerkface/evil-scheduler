var DBView = require("./DBView");
var HashVar = require("../stepbystep/model").HashVar;
var buildShadesMap = require("../stepbystep/view").buildShadesMap;

var GET_QUERY, PREPARE_QUERY, COMMIT_QUERY, FINALIZE_QUERY, DEBTS_QUERY;

var StackView, Menu, QueryView;

module.exports = React.createClass({
    render: function() {
        var side_view = this.props.model.side_view;

        var view = null;

        if (side_view == "db") {
            view = (<DBView model={this.props.model} />)
        } else if (side_view == "vars") {
            var vars = extractVarsFromFrames(this.props.model.frames)
            if (vars.length>0) {
                view = (<StackView vars={vars}></StackView>);
            }
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

StackView = React.createClass({
    render: function() {
        return (<div className="var-view"><table className="var-table"><tbody>
            {this.props.vars.map(function(record){
                var color = "hsla(" +
                                record.h + "," +
                                record.s + "%," +
                                "40%," +
                                record.a +
                            ")";
                return (<tr className="var-tr">
                    <td className="var-name" style={{"backgroundColor": color}}>{record.name}</td>
                    <td className="var-value">{obj_to_table(record.obj)}</td>
                </tr>);
            })}
        </tbody></table></div>);
    }
});

function extractVarsFromFrames(frames) {
    var deep_by_thread = {};
    for (var i=0;i<frames.length;i++) {
        var frame = frames[i];
        if (!deep_by_thread.hasOwnProperty(frame.thread.thread_id)) {
            deep_by_thread[frame.thread.thread_id] = {};
        }
        if (frame.vars.length > 0) {
            deep_by_thread[frame.thread.thread_id][i] = true;
        }
    }
    var shades_by_thread = {};
    for (var thread in deep_by_thread) {
        if (!deep_by_thread.hasOwnProperty(thread)) continue;
        shades_by_thread[thread] = buildShadesMap(deep_by_thread[thread]);
    }

    var vars = [];
    for (var i=0;i<frames.length;i++) {
        var frame = frames[i];
        if (frame.vars.length==0) continue;
        var h = frame.thread.color.h;
        var s = frame.thread.color.s;
        var a = shades_by_thread[frame.thread.thread_id][i];
        frame.vars.forEach(function(record) {
            vars.push({
                name: record.name,
                obj: record.obj,
                h: h,
                s: s,
                a: a
            });
        });
    }

    return reverse(vars);
}

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

function tabler(obj) {
    if (obj instanceof HashVar) {
        var rows = [];
        for (var key in obj.obj) {
            if (!obj.obj.hasOwnProperty(key)) continue;
            if (Array.isArray(obj.obj[key])) {
                for (var j=0;j<obj.obj[key].length;j++) {
                    rows.push({key: j==0 ? key : null, value: obj.obj[key][j]});
                }
            } else {
                rows.push({key: key, value: obj.obj[key]});
            }
        }
        if (rows.length == 0) {
            return (<span className="value-obj-empty">{"{}"}</span>);
        } else {
            var tableInfo = build_table_info(rows[0].value, null, null);
            return (<table className="value-table"><tbody>
                {(tableInfo.get_header().map(function(tr){
                    return (<tr>
                        <th className="empty"></th>
                        {tr}
                    </tr>);
                }))}
                {rows.map(function(obj){
                    var row = [
                        obj.key == null ?
                            (<th className="empty"></th>) :
                            (<th className="header prop">{obj.key}</th>)
                    ];
                    tableInfo.render_row(obj.value, row);
                    return (<tr className="value-table-obj">{row}</tr>);
                })}
            </tbody></table>);
        }
    } else {
        if (obj.length==0) {
            return (<span className="value-list-empty">{"[]"}</span>);
        } else {
            var tableInfo = build_table_info(obj[0], null, null);
            return (<table className="value-table"><tbody>
                {(tableInfo.get_header().map(function(tr){
                    return (<tr>{tr}</tr>);
                }))}
                {obj.map(function(obj){
                    var row = [];
                    tableInfo.render_row(obj, row);
                    return (<tr className="value-table-obj">{row}</tr>);
                })}
            </tbody></table>);
        }
    }

    function TableInfo(is_leaf, name, prop) {
        this.is_leaf = is_leaf;
        this.name = name;
        this.prop = prop;
        this.children = [];
        this.spans = is_leaf ? 1 : 0;
        this.lvl = 0;
        this.get_header = function() {
            var by_lvl = this.collect_by_lvl([]);
            var last = null;
            var table = [];
            var tr = [];
            by_lvl.forEach(function(node){
                if (last==null) {
                    last = node.lvl;
                }
                if (last != node.lvl) {
                    table.push(tr);
                    tr = [];
                    last = node.lvl;
                }
                tr.push(node);
            });
            table.push(tr);
            table = table.filter(function(tr) {
                return !tr.every(function(cell){ return cell.name == null; });
            }).map(function(tr) {
                return tr.map(function(node) {
                    var name = node.name == null ? "" : node.name;
                    var className = node.name == null ? "empty" : "header";
                    return (<th className={className} colSpan={node.spans}>{name}</th>);
                });
            });
            return table;
        }
        this.render_row = function(obj, collector) {
            if (this.is_leaf) {
                collector.push(<td className="prop">{obj_to_table(obj[this.prop])}</td>);
            } else {
                if (this.prop != null) {
                    obj = obj[this.prop];
                }
                this.children.forEach(function(child) {
                    child.render_row(obj, collector);
                });
            }
        }
        this.collect_by_lvl = function(list) {
            var plan = [this];
            var i = 0;
            while(i < plan.length) {
                var e = plan[i];
                list.push(e);
                e.children.forEach(function(child) {
                    plan.push(child);
                });
                i++;
            }
            return list;
        };
    }

    function build_table_info(obj, name, prop) {
        if (typeof obj != "object" || Array.isArray(obj) || obj==null) {
            return new TableInfo(true, name, prop);
        } else {
            var root = new TableInfo(false, name, prop);
            var children = [];
            for (var key in obj) {
                if (!obj.hasOwnProperty(key)) continue;
                var child = build_table_info(obj[key], key, key);
                root.lvl = Math.max(root.lvl, child.lvl+1);
                root.spans += child.spans;
                children.push(child);
            }
            children.forEach(function(child) {
                root.children.push(fill_skips(root.lvl-1, child));
            });
            return root
        }

        function fill_skips(lvl, node) {
            if (lvl < node.lvl) throw "WTF?!";
            if (lvl == node.lvl) return node;
            var filler = new TableInfo(false, null);
            filler.lvl = lvl;
            filler.children.push(fill_skips(lvl-1, node));
            return filler;
        }
    }
}

function obj_to_table(obj) {
    if (typeof obj == "string") {
        return (<span className="value-string">{"\"" + obj + "\""}</span>);
    }
    if (obj == null) {
        return (<span className="value-null">{"null"}</span>);
    }
    if (Array.isArray(obj) && obj.length>0 && typeof obj[0] == "number") {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj) || obj instanceof HashVar) {
        return tabler(obj);
    }
    return JSON.stringify(obj);
}

function reverse(arr) {
    arr = Array.prototype.slice.call(arr);
    arr.reverse();
    return arr;
}
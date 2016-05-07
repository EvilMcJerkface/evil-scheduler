var HashVar = require("../model").HashVar;

module.exports = obj_to_table;

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
                if (this.prop != null) {
                    obj = obj[this.prop];
                }
                collector.push(<td className="prop">{obj_to_table(obj)}</td>);
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
        if (typeof obj != "object" || obj instanceof HashVar || Array.isArray(obj) || obj==null) {
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
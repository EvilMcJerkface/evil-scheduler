var obj_to_table = require("./obj_to_table");

var buildShadesMap = require("../view").buildShadesMap;

module.exports = React.createClass({
    render: function() {
        var vars = extractVarsFromFrames(this.props.frames);
        if (vars.length>0) {
            return (<div className="var-view"><table className="var-table"><tbody>
                {vars.map(function(record){
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
        };
        return null;
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

function reverse(arr) {
    arr = Array.prototype.slice.call(arr);
    arr.reverse();
    return arr;
}
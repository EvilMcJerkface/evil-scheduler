var dsl = require("../stepbystep/dsl");
var DB = require("./DB");
var KeyTable = require("./KeyTable");


var Statement = dsl.Statement;
var Abort = dsl.Abort;
var Seq = dsl.Seq;
var Cond = dsl.Cond;
var Fun = dsl.Fun;
var Call = dsl.Call;
var Return = dsl.Return;
var Each = dsl.Each;
var Nope = dsl.Nope;
var Skip = dsl.Skip;
var Shift = dsl.Shift;
var Marked = dsl.Marked;
var TML = require("../stepbystep/view").TML;
var hl2 = require("../stepbystep/monokai");

var model = require("../stepbystep/model");
var AppModel = model.AppModel;
var ThreadModel = model.ThreadModel;
var HashVar = model.HashVar;

var ramp_model = AppModel()
module.exports = ramp_model;

ramp_model.change_notify = function(fn, args) {
    fn.apply(ramp_model, args);
    ramp_model.notify();
}

ramp_model.set_sideview = function(type) {
    module.exports.side_view = type;
}

//ramp_model.change_notify(ramp_model.set_sideview, ["sql:prepare"])

module.exports.side_view = "db";

function db_prepare_clicked() {
    ramp_model.set_sideview("sql:prepare");
    ramp_model.notify();
};
function db_commit_clicked() {
    ramp_model.set_sideview("sql:commit");
    ramp_model.notify();
};
function db_get_clicked() {
    ramp_model.set_sideview("sql:get");
    ramp_model.notify();
};
function db_debts_clicked() {
    ramp_model.set_sideview("sql:debts");
    ramp_model.notify();
};
function db_confirm_clicked() {
    ramp_model.set_sideview("sql:confirm");
    ramp_model.notify();
};

var db = new DB();

db.prepare("Euclid", [
    {key: {lender: "Euclid", debtor: "Galois"}, txid: 0, value: 0, md: []},
    {key: {lender: "Euclid", debtor: "Godel"}, txid: 0, value: 0, md: []}
]);
db.prepare("Galois", [
    {key: {lender: "Galois", debtor: "Euclid"}, txid: 0, value: 0, md: []},
    {key: {lender: "Galois", debtor: "Godel"}, txid: 0, value: 0, md: []}
]);
db.prepare("Godel", [
    {key: {lender: "Godel", debtor: "Euclid"}, txid: 0, value: 0, md: []},
    {key: {lender: "Godel", debtor: "Galois"}, txid: 0, value: 0, md: []}
]);
db.commit("Euclid", [0]);
db.commit("Galois", [0]);
db.commit("Godel", [0]);
db.proposers = [
    {name: "proposer1", proposer_id: 0, n: 0},
    {name: "proposer2", proposer_id: 1, n: 0}
];

var __req = Fun(hl2("function read_to(query, ret) {"), Seq([
    Skip(function(ctx) {
        ctx.__thread.frame_var("query", ctx.query);
    }),
    Each(
        function(ctx) {
            var sharded = {};
            ctx.query.forEach(function(key) {
                if (!sharded.hasOwnProperty(key.key.lender)) {
                    sharded[key.key.lender] = [];
                }
                sharded[key.key.lender].push(key);
            });
            var items = [];
            for (var shard in sharded) {
                if (!sharded.hasOwnProperty(shard)) continue;
                items.push({
                    shard: shard,
                    values: sharded[shard]
                });
            }
            return items; 
        },
        function(e) { return {s: e.shard, ks: e.values }; },
        "query.group_by(x => shard(x.key)).flatMap((s, ks) => {", Seq([
            Skip(function(ctx) {
                ctx.__thread.frame_var("s", ctx.s);
                ctx.__thread.frame_var("ks", ctx.ks);
            }),
            Statement(
                [ hl2("return "),
                  TML.Click("dbs[s].get(ks)", db_get_clicked),
                  ".map(x=>(x.key,x));" ],
                function(ctx) {
                    db.get(ctx.s, ctx.ks).forEach(function(e) {
                        ctx.__seed.__seed.ret.put(e.key, e);
                    });
                }
            )
        ]), "}).each((key,value) => { ret[key]=value; });"
    )
]), "}");

////////////////////////////////////////////////////////////

var __put_all = Fun(hl2("this.put_all = function(changes) {"), Seq([
    Skip(function(ctx){
        ctx.__thread.frame_var("changes", ctx.changes);
    }),
    Statement(hl2(
        "var toptx = changes.map(x => x.txid).reduce(Math.max, 0);\n" +
        "this.n = Math.max(this.n, toptx / 10);\n" +
        "var txid = 100*(++this.n) + this.proposer_id;"), 
        function(ctx) {
            ctx.toptx = ctx.changes.map(function(x) { 
                return x.txid; 
            }).reduce(function(x,y) { return Math.max(x,y); }, 0);
            ctx.__thread.frame_var("toptx", ctx.toptx);
            ctx.__self.n = Math.max(ctx.__self.n, ctx.toptx / 100);
            ctx.__thread.frame_var("n", ctx.__self.n);
            ctx.__self.n += 1;
            ctx.txid = 100*ctx.__self.n + ctx.__self.proposer_id;
            ctx.__thread.frame_var("txid", ctx.txid);
        }
    ),
    Statement(hl2("proposers.broadcast(this.n);"), function(ctx) {
        module.exports.db.broadcast_ballot_number(ctx.__self.n);
    }),

    Statement(hl2(
        "var md = set(changes.map(x => x.key));\n" + 
        "var by_shard = changes.map((key,value) => {\n" +
        "  key: key,\n" +
        "  txid: txid,\n" +
        "  value: value,\n" +
        "  md: md - { key }\n" +
        "}).group_by(x=>shard(x.key));"),
        function(ctx) {
            ctx.md = ctx.changes.map(function(x) { return x.key; });
            ctx.__thread.frame_var("md", ctx.md);
            ctx.group_by = {};
            for (var i = 0; i < ctx.changes.length; i++) {
                var key = ctx.changes[i].key.lender;
                if (!ctx.group_by.hasOwnProperty(key)) {
                    ctx.group_by[key] = [];
                }
                ctx.group_by[key].push({
                    key: ctx.changes[i].key,
                    txid: ctx.txid,
                    value: ctx.changes[i].value,
                    md: ctx.md.filter(function(md) { 
                        return !(
                            md.lender == ctx.changes[i].key.lender &&
                            md.debtor == ctx.changes[i].key.debtor
                        );
                    })
                });
            }
            ctx.__thread.frame_var("md", ctx.md);
            ctx.__thread.frame_var("by_shard", new HashVar(ctx.group_by));
        }
    ),
    Each(
        function(ctx) { 
            var arr = [];
            for (var shard in ctx.group_by) {
                if (!ctx.group_by.hasOwnProperty(shard)) continue;
                arr.push({shard: shard, values: ctx.group_by[shard]});
            }
            return arr;
        },
        function(e) { return e; },
        "by_shard.each((shard,values) => {",
            Seq([
                Skip(function(ctx) {
                    ctx.__thread.frame_var(null, [{shard: ctx.shard, values: ctx.values}]);
                }),
                Statement([
                    TML.Click("dbs[shard].prepare(values)", db_prepare_clicked), ";"
                ], function(ctx) { db.prepare(ctx.shard, ctx.values); })
            ]),
        "});"
    ),
    Skip(function(ctx) {
        ctx.shards = [];
        for (var shard in ctx.group_by) {
            if (!ctx.group_by.hasOwnProperty(shard)) {
                continue;
            }
            ctx.shards.push(shard);
        }
    }),
    Each(
        function(ctx) { return ctx.shards; },
        function(e) { return { shard: e }; },
        "by_shard.each((shard,_) => {",
            Seq([
                Skip(function(ctx) {
                    ctx.__thread.frame_var("shard", ctx.shard);
                }),
                Statement([
                    TML.Click("dbs[shard].commit([txid])", db_commit_clicked), ";"
                ], function(ctx) { db.commit(ctx.shard, [ctx.__seed.txid]); })
            ]),
        "});"
    ),
    Each(
        function(ctx) { return ctx.shards; },
        function(e) { return { shard: e }; },
        "by_shard.each((shard,_) => {",
            Seq([
                Skip(function(ctx) {
                    ctx.__thread.frame_var("shard", ctx.shard);
                }),
                Statement([
                    TML.Click("dbs[shard].confirm([txid])", db_confirm_clicked), ";"
                ], function(ctx) { db.confirm(ctx.shard, [ctx.__seed.txid]); })
            ]),
        "});"
    )
]), "};");

var __confirm = Fun(hl2("function confirm(values) {"), Seq([
    Skip(function(ctx) {
        ctx.__thread.frame_var("values", ctx.values);
    }),
    Statement(hl2(
        "var fresh = set(values.when(x => !x.confirmed).flatMap(x => [\n" +
        "  {shard: shard(x.key), txid: x.txid}\n" +
        "] + x.md.map(y => {shard: shard(y), txid: x.txid})));\n" +
        "var by_shard = fresh.group_by(x => x.shard).map(\n" +
        "  (shard, values) => (shard, values.map(x => x.txid))\n" +
        ");"), 
        function(ctx) {
            var unfinished = [];
            var is_used = {};
            var add = function(shard, txid) {
                if (is_used.hasOwnProperty(shard) && is_used[shard][txid]) {
                    return;
                }
                if (!is_used.hasOwnProperty(shard)) {
                    is_used[shard]={};
                }
                is_used[shard][txid] = true;
                unfinished.push({shard: shard, txid: txid});
            };
            for (var i=0;i<ctx.values.length;i++) {
                if (ctx.values[i].confirmed === false) {
                    add(ctx.values[i].key.lender, ctx.values[i].txid);
                    ctx.values[i].md.forEach(function(md) {
                        add(md.lender, ctx.values[i].txid);
                    });
                }
            }
            ctx.unfinished = unfinished;
            ctx.__thread.frame_var("fresh", ctx.unfinished);
            var by_shard = {};
            ctx.unfinished.forEach(function(x) {
                if (!by_shard.hasOwnProperty(x.shard)) {
                    by_shard[x.shard] = [];
                }
                by_shard[x.shard].push(x.txid);
            });
            var groupped = [];
            for (var shard in by_shard) {
                if (!by_shard.hasOwnProperty(shard)) {
                    continue;
                }
                groupped.push({shard: shard, txids: by_shard[shard]});
            }
            ctx.by_shard = groupped;
            ctx.__thread.frame_var("by_shard", groupped);
        }
    ),
    Each(
        function(ctx) { 
            return ctx.by_shard;
        },
        function(e) { return { shard: e.shard, txids: e.txids }; },
        "by_shard.each((shard,txids) => {",
            Seq([
                Skip(function(ctx) {
                    ctx.__thread.frame_var("shard", ctx.shard);
                    ctx.__thread.frame_var("txids", ctx.txids);
                }),
                Statement([
                    TML.Click("dbs[shard].commit(txids)", db_commit_clicked), ";"
                ], function(ctx) { db.commit(ctx.shard, ctx.txids); })
            ]),
        "});"
    ),
    Each(
        function(ctx) { 
            return ctx.by_shard;
        },
        function(e) { return { shard: e.shard, txids: e.txids }; },
        "by_shard.each((shard,txids) => {",
            Seq([
                Skip(function(ctx) {
                    ctx.__thread.frame_var("shard", ctx.shard);
                    ctx.__thread.frame_var("txids", ctx.txids);
                }),
                Statement([
                    TML.Click("dbs[shard].confirm(txids)", db_confirm_clicked), ";"
                ], function(ctx) { db.confirm(ctx.shard, ctx.txids); })
            ]),
        "});"
    )
]), "}");

var __get_all = Fun(hl2("this.get_all = function(keys) {"), Seq([
    Skip(function(ctx) {
        ctx.__thread.frame_var("keys", ctx.keys);
    }),
    Statement(hl2("var ret = {};"), function(ctx) {
        ctx.ret = new KeyTable();
        ctx.__thread.frame_var("ret", new HashVar(ctx.ret.as_obj()));
    }),
    Call(
        "read_to(keys.map(key=>{key: key, txid: null}), ret);",
        function(ctx) {
            return { query: ctx.keys.map(function(key) {
                return {key: key, txid: null};
            }) };
        },
        __req,
        function(ctx, ret) {
            ctx.__thread.frame_var("ret", new HashVar(ctx.ret.as_obj()));
        }
    ),
    Call(
        "confirm(ret.values());",
        function(ctx) {
            return { values: ctx.ret.values() };
        },
        __confirm,
        function(ctx, ret) { }
    ),
    Statement(hl2(
        "var versions = [\n" + 
        "  {key: md, txid: r.txid} | r in ret.values(), md in r.md\n" + 
        "];\n" + 
        "var newer = versions.group_by(x => x.key).map(\n" +
        "  (key, values) => (key, max(values))\n" +
        ").when(\n" +
        "  (key, txid) => key in ret && txid > ret[key].txid\n" +
        ");"),
        function(ctx) {
            var latest = new KeyTable(function() { return -1 });
            var versions = [];
            ctx.ret.forEach(function(r_key, r) {
                for (var md_key in r.md) {
                    if (!r.md.hasOwnProperty(md_key)) continue;
                    var md = r.md[md_key];
                    versions.push({key: md, txid: r.txid});
                    latest.put(md, Math.max(r.txid, latest.get(md)));
                }
            });
            ctx.__thread.frame_var("versions", versions);
            var newer = [];
            ctx.ret.forEach(function(key, value) {
                if (latest.get(key) > value.txid) {
                    newer.push({
                        key: key,
                        txid: latest.get(key)
                    });
                }
            });
            ctx.newer = newer;
            ctx.__thread.frame_var("newer", newer);
        }
    ),
    Call(
        "read_to(newer.map((key, txid)=>{key: key, txid: txid}), ret);",
        function(ctx) { return { query: ctx.newer }; },
        __req,
        function(ctx, ret) { }
    ),
    Return(hl2("return ret;"), function(ctx) { return ctx.ret; }),
    Nope(""),
    __req,
    Nope(""),
    __confirm
]), "};");

var __get_borrowers = Fun(hl2("function get_borrowers() {"), Seq([
    Statement(
        [
            hl2("var keys = "),
            TML.Click("db[shard(person)].get_debts_of(person)", db_debts_clicked), ";"
        ],
        function(ctx) { 
            ctx.keys = db.get_debts(ctx.person); 
            ctx.__thread.frame_var("keys", ctx.keys);
        }
    ),
    Statement(hl2(
        "keys = keys.map(key => {\n" +
        "  {lender: person, debtor: key.debtor}\n"+
        "})\n" +
        "var borrowers = {};"),
        function(ctx) {
            var values = ctx.keys;
            var result = [];
            values.forEach(function(value){
                result.push({lender: value.key.lender, debtor: value.key.debtor});
            });
            ctx.keys = result;
            ctx.__thread.frame_var("keys", result);
            ctx.borrowers = {};
            ctx.__thread.frame_var("borrowers", new HashVar({}));
        }
    ),
    Call(
        "proposer.get_all(keys).values().each(\n" +
        "  v => borrowers[v.key.borrower] = v\n" +
        ");",
        function(ctx) { return {
            keys: ctx.keys,
            __self: ctx.proposer
        }; },
        __get_all,
        function(ctx, ret) {
            ret.forEach(function(key, value) {
                ctx.borrowers[value.key.debtor] = value;
            });
            ctx.__thread.frame_var("borrowers", new HashVar(ctx.borrowers));
        }
    ),
    Return(hl2("return borrowers;"), function(ctx) { return ctx.borrowers; })
]), "}");

function wrap_update(update, has_thread, is_open_by_user) {
    if (has_thread.update || is_open_by_user.update) {
        var signature;
        if (is_open_by_user.update && !has_thread.update) {
            signature = Nope([
                hl2("function update(proposer, person, changes) { "),
                TML.Click("collapse", collapse_update)
            ]);
        } else {
            signature = Nope(hl2("function update(proposer, person, changes) {"));
        }
        return Seq([
            Nope(""),
            signature,
            Shift(update.body),
            Nope("}")
        ]);
    } else {
        return Seq([
            Nope(""),
            Nope([
                hl2("function update(proposer, person, changes) { "),
                TML.Click("...", expand_update),
                " }"
            ])
        ]);
    }
}

function wrap_get(get, has_thread, is_open_by_user) {
    if (has_thread.get || is_open_by_user.get) {
        var signature;
        if (is_open_by_user.get && !has_thread.get) {
            signature = Nope([
                hl2("this.get_all = function(keys) { "),
                TML.Click("collapse", collapse_get)
            ]);
        } else {
            signature = Nope(hl2("this.get_all = function(keys) {"));
        }
        return Seq([
            Nope(""),
            signature,
            Shift(get.body),
            Nope("};")
        ]);
    } else {
        return Seq([
            Nope(""),
            Nope([
                hl2("this.get_all = function(keys) { "),
                TML.Click("...", expand_get),
                " };",
            ])
        ]);
    }
}

function wrap_put(put, has_thread, is_open_by_user) {
    if (has_thread.put || is_open_by_user.put) {
        var signature;
        if (is_open_by_user.put && !has_thread.put) {
            signature = Nope([
                hl2("this.put_all = function(changes) { "),
                TML.Click("collapse", collapse_put)
            ]);
        } else {
            signature = Nope(hl2("this.put_all = function(changes) { "));
        }
        return Seq([
            Nope(""),
            signature,
            Shift(put.body),
            Nope("};")
        ]);
    } else {
        return Seq([
            Nope(""),
            Nope([
                hl2("this.put_all = function(changes) { "),
                TML.Click("...", expand_put),
                " };"
            ])
        ]);
    }
}

var __update = Fun(hl2("function update(proposer, person, changes) {"), Seq([
    Skip(function(ctx) {
        ctx.__thread.frame_var("proposer", ctx.proposer.name);
        ctx.__thread.frame_var("person", ctx.person);
        ctx.__thread.frame_var("changes", ctx.changes);
    }),
    Call(
        hl2("var borrowers = get_borrowers();"),
        function(ctx) { return {
            proposer: ctx.proposer,
            person: ctx.person
        }; },
        __get_borrowers,
        function(ctx, ret) { 
            ctx.borrowers = ret;
            ctx.__thread.frame_var("borrowers", new HashVar(ret));
        }
    ),
    Statement(hl2(
        "changes = changes.flatMap(x => [\n" +
        "  { key: { lender: person, debtor: x.borrower },\n" +
        "    value: borrowers[x.borrower].value + x.changes,\n" +
        "    txid: borrowers[x.borrower].txid }, \n" +
        "  { key: { lender: x.borrower, debtor: person },\n" +
        "    value: -(borrowers[x.borrower].value + x.changes),\n" +
        "    txid: borrowers[x.borrower].txid }\n" +
        "]);"),
        function(ctx) {
            var changes = [];
            ctx.changes.forEach(function(change) {
                changes.push({
                    key: {lender: ctx.person, debtor: change.debtor},
                    value: ctx.borrowers[change.debtor].value + change.value,
                    txid: ctx.borrowers[change.debtor].txid
                });
                changes.push({
                    key: {lender: change.debtor, debtor: ctx.person},
                    value: -(ctx.borrowers[change.debtor].value + change.value),
                    txid: ctx.borrowers[change.debtor].txid
                });
            });
            ctx.changes = changes;
            ctx.__thread.frame_var("changes", changes);
        }
    ),
    Call(
        "proposer.put_all(changes);",
        function(ctx) { return {
            changes: ctx.changes,
            __self: ctx.proposer
        }; },
        __put_all,
        function(ctx, ret) { }
    ),
    Nope(""),
    __get_borrowers
]), "}");

function make_core(put_all, get_all, update) {
    return Seq([
        Nope(hl2("function Proposer(proposers, proposer_id, n) {")),
        Shift(Seq([
            Nope(hl2("this.proposer_id = proposer_id;")),
            Nope(hl2("this.n = n;")),
            put_all,
            get_all
        ])),
        Nope("}"),
        update
    ]);
}

var has_thread = {
    put: false,
    get: false,
    update: false
};

var is_open_by_user = {
    put: false,
    get: false,
    update: false
};

function expand_put() {
    is_open_by_user.put = true;
    expand();
}

function expand_get() {
    is_open_by_user.get = true;
    expand();
}

function expand_update() {
    is_open_by_user.update = true;
    expand();
}

function collapse_put() {
    is_open_by_user.put = false;
    expand();
}

function collapse_get() {
    is_open_by_user.get = false;
    expand();
}

function collapse_update() {
    is_open_by_user.update = false;
    expand();
}


function expand() {
    module.exports.proposer = make_core(
        wrap_put(__put_all, has_thread, is_open_by_user),
        wrap_get(__get_all, has_thread, is_open_by_user), 
        wrap_update(__update, has_thread, is_open_by_user)
    );
    module.exports.notify();
}

module.exports.proposer = make_core(
    wrap_put(__put_all, has_thread, is_open_by_user), 
    wrap_get(__get_all, has_thread, is_open_by_user), 
    wrap_update(__update, has_thread, is_open_by_user)
);

////////////////////////////////////////////////////////////


module.exports.ticked = function(thread) {
    has_thread = {
        put: is_called_from(thread.ctx, __put_all),
        get: is_called_from(thread.ctx, __get_all),
        update: is_called_from(thread.ctx, __update)
    };

    if (ramp_model.frames.length==0) {
        ramp_model.side_view = "db";
    }

    expand();

    function is_called_from(ctx, fun) {
        if (!ctx) return false;
        if (ctx.__fun === fun) return true;
        return is_called_from(ctx.__seed, fun);
    }
};

ramp_model.frames = [];
ramp_model.clear_frames = function(thread) {
    ramp_model.frames = ramp_model.frames.filter(function(x){
        return x.thread_id != thread.thread_id;
    });
};
ramp_model.push_frame = function(thread) {
    ramp_model.frames.push({
        thread_id: thread.thread_id,
        thread: thread,
        vars: []
    });
};
ramp_model.pop_frame = function(thread) {
    var tail = [];
    while(true) {
        var frame = ramp_model.frames.pop();
        if (frame.thread_id==thread.thread_id) {
            break
        }
        tail.push(frame);
    }
    while(tail.length > 0) {
        ramp_model.frames.push(tail.pop());
    }
};
ramp_model.frame_var = function(thread, name, obj) {
    for (var i=ramp_model.frames.length-1;i>=0;i--) {
        if (ramp_model.frames[i].thread_id == thread.thread_id) {
            ramp_model.frames[i].vars = ramp_model.frames[i].vars.filter(function(val){
                return name==null || val.name!=name;
            });
            ramp_model.frames[i].vars.push({name: name, obj: obj});
            return;
        }
    }
    throw "WTF?!";
};
ramp_model.has_frames_var = function() {
    var count = 0;
    module.exports.frames.forEach(function(frame) {
        count += frame.vars.length;
    });
    return count > 0;
};

////////////////
// 15

var __tx1 = get_tx("proposer1", "Euclid", [
    {debtor: "Galois", value: 3},
    {debtor: "Godel", value: 3}
]);

var __tx2 = get_tx("proposer2", "Godel", [
    {debtor: "Euclid", value: 10},
    {debtor: "Galois", value: 10}
]);

module.exports.db = db;
module.exports.gc = function() {
    this.db.gc();
    module.exports.notify();
}

module.exports.tx1 = ThreadModel(__tx1, module.exports, "0", 182, 25);
module.exports.tx2 = ThreadModel(__tx2, module.exports, "1", 51, 100);

function get_tx(proposer, person, changes) {
    var text = "update(" + proposer + ", \"" + person + "\", [\n";
    changes.forEach(function(change, i){
        var c = i+1==changes.length ? "" : ",";
        text += "  {debtor: \"" + change.debtor + "\", value: " + change.value + "}" + c + "\n";
    });
    text += "]);";
    var proposer = db.proposers.filter(function(x){
        return x.name == proposer;
    })[0];
    return Seq([
        Call(
            text,
            function(ctx) { return {
                person: person,
                changes: changes,
                proposer: proposer
            }; },
            __update,
            function(ctx, ret) {}
        )
    ]);
}

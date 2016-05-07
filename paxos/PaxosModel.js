var model = require("../stepbystep/model");
var AppModel = model.AppModel;

var ThreadModel = model.ThreadModel;

var hl2 = require("../stepbystep/monokai");

var HashVar = model.HashVar;

var icbm_proj = require("./utils/icbm_proj");

var dsl = require("../stepbystep/dsl");
var Statement = dsl.Statement;
var While2 = function(view_begin, pred, body, view_end) {
    return dsl.While(hl2(view_begin), pred, body, hl2(view_end));
};
var Abort = dsl.Abort;
var Defer = dsl.Defer;
var Seq = dsl.Seq;
var Cond = dsl.Cond;
var Fun = dsl.Fun;
var Call = function(view, pack, fun, unpack) {
    return dsl.Call(hl2(view), pack, fun, unpack);
};
var Call2 = function(view, pack, fun, unpack) {
    return dsl.Call2(hl2(view), pack, fun, unpack);
};
var Return = dsl.Return;
var Return2 = function(view, x) {
    return dsl.Return(hl2(view), x);
};
var TryCatch2 = function(try_view, expression, catch_view, pack, handler, end) {
    return dsl.TryCatch(hl2(try_view), expression, hl2(catch_view), pack, handler, end);
};
var Throw = dsl.Throw;
var Each = dsl.Each;
var Nope2 = function(x) {
    return dsl.Nope(hl2(x));
};
var Statement2 = function(view, action) {
    return dsl.Statement(hl2(view), action);
};
var Skip = dsl.Skip;
var Shift = dsl.Shift;
var Marked = dsl.Marked;
var TML = require("../stepbystep/view").TML;
var hl2 = require("../stepbystep/monokai");

var MAJORITY = 2;

var __acceptor = Seq([
    Nope2("function Acceptor() {"),
    Shift(Seq([
        Nope2("this.promised = {};"),
        Nope2("this.accepted = {};"),
        Nope2("this.promise = function(key, ballot) {"),
        Shift(Seq([
            Nope2("this.promised[key] = ballot;"),
            Nope2("return ok(this.accepted[key]);")
        ])),
        Nope2("};"),
        Nope2("this.accept = function(key, ballot, value) {"),
        Shift(Seq([
            Nope2("if (this.promised[key] <= ballot) {"),
            Shift(Seq([
                Nope2("this.promised[key] = ballot;"),
                Nope2("this.accepted[key] = {ballot: ballot, value: value};"),
                Nope2("return ok();")
            ])),
            Nope2("}"),
            Nope2("return fail(this.promised[key]);")
        ])),
        Nope2("};")
    ])),
    Nope2("}")
]);

var paxos_model = AppModel();
paxos_model.messages = new Messages();
function Acceptor(name) {
    this.name = name;
    this.promised = {};
    this.accepted = {};
    this.isEmpty = function() {
        for (var key in this.promised) {
            if (!this.promised.hasOwnProperty(key)) continue;
            return false;
        }

        for (var key in this.accepted) {
            if (!this.accepted.hasOwnProperty(key)) continue;
            return false;
        }

        return true;
    };
}
paxos_model.acceptors = [
    new Acceptor("a"),
    new Acceptor("b"),
    new Acceptor("c")
];

paxos_model.areAllAcceptorsEmpty = function() {
    return paxos_model.acceptors.filter(x => !x.isEmpty()).length==0;
}

paxos_model.set_sideview = function(type) {
    paxos_model.side_view = type;
}

paxos_model.side_view = "help";

var __promise_rpc;
var promise_rpc_wait;

var __execute = Fun(hl2("this.execute = function(key, action, msg) {"), Seq([
    Skip(ctx => {
        ctx.__thread.frame_var("key", ctx.key);
        ctx.__thread.frame_var("msg", new HashVar(ctx.msg));
    }),
    Statement2("var ballot = 100*(++this.n) + this.proposer_id;", function(ctx) {
        ctx.__self.n++;
        ctx.ballot = 100*ctx.__self.n + ctx.__self.proposer_id;
        ctx.__thread.frame_var("ballot", ctx.ballot);
    }),
    Statement2("proposers.update_ballot({promised_ballot: ballot});", function(ctx) {
        paxos_model.proposers.forEach(proposer => {
            if (proposer != ctx.__self) {
                var msg = new UpdateBallotMessage(
                    paxos_model.messages, proposer, ctx.ballot, ctx.__thread
                );
                paxos_model.messages.emit(msg);
            }
        });
    }),
    __promise_rpc = Statement2("var q = acceptors.promise(key, ballot);", function(ctx) {
        ctx.__thread.data.q = {
            thread: ctx.__thread,
            ctx: ctx,
            pending: paxos_model.acceptors.length,
            ok: [],
            fail: [],
            timeout: 0,
            try_unblock: function() {
                if (this.pending===0) {
                    this.thread.data.isPaused = false;
                }
            }
        };

        ctx.q = ctx.__thread.data.q;

        paxos_model.acceptors.forEach(function(acceptor) {
            var msg = new PromiseMessage(
                paxos_model.messages, acceptor, ctx.key, ctx.ballot, ctx.q, ctx.__thread
            );
            paxos_model.messages.emit(msg);
        });
    }),
    Statement2("q.on(x => x.is_fail).do(this.update_ballot.bind(this));", function(ctx) { }),
    Skip(function(ctx) {
        if (ctx.__thread.data.q.pending!=0) {
            ctx.__thread.data.isPaused = true;
        }
    }),
    promise_rpc_wait = Statement2("var a = q.on(x => x.is_ok).at_least(MAJORITY).wait();", ctx => { }),
    Defer(function(ctx) {
        if (ctx.q.ok.length < MAJORITY) {
            return [dsl.flow.Throw("timeout"), ctx];
        } else {
            return [dsl.flow.Unit(), ctx];
        }
    }),
    Statement2("var curr = a.max(x => x.accepted.ballot).accepted.value;", ctx => {
        var ballot = -1;
        var value = null;
        ctx.q.ok.forEach(item => {
            if (ballot <= item.ballot) {
                ballot = item.ballot;
                value = item.value;
            }
        });
        ctx.curr = value;
        ctx.__thread.frame_var("curr", icbm_proj(value));
    }),
    Call2(
        "var next = action(curr, msg);", 
        function(ctx) { return { value: ctx.curr, msg: ctx.msg }; },
        function(ctx) { return ctx.action; },
        function(ctx, ret) { 
            ctx.next = ret;
            ctx.__thread.frame_var("next", icbm_proj(ret));
        }
    ),
    Statement2("q = acceptors.accept(key, ballot, next);", function(ctx) {
        ctx.__thread.data.q = {
            thread: ctx.__thread,
            ctx: ctx,
            pending: paxos_model.acceptors.length,
            ok: [],
            fail: [],
            timeout: 0,
            proposer: ctx.__self,
            try_unblock: function() {
                if (this.pending===0) {
                    this.thread.data.isPaused = false;
                }
            }
        };

        ctx.q = ctx.__thread.data.q;

        paxos_model.acceptors.forEach(function(acceptor) {
            var msg = new AcceptMessage(
                paxos_model.messages, acceptor, ctx.key, ctx.ballot, ctx.next, ctx.q, ctx.__thread
            );
            paxos_model.messages.emit(msg);
        });
    }),
    Statement2("q.on(x => x.is_fail).do(this.update_ballot.bind(this));", ctx => {}),
    Skip(function(ctx) {
        if (ctx.__thread.data.q.pending!=0) {
            ctx.__thread.data.isPaused = true;
        }
    }),
    Statement2("q.on(x => x.is_ok).at_least(MAJORITY).wait();", ctx => {}),
    Defer(function(ctx) {
        if (ctx.q.ok.length < MAJORITY) {
            return [dsl.flow.Throw("timeout"), ctx];
        } else {
            return [dsl.flow.Unit(), ctx];
        }
    }),
    Return2("return next;", function(ctx) { return ctx.next; })
]), "};");


var __update = Statement2("this.n = Math.max(this.n, fail.promised_ballot / 100);", ctx => {
    ctx.__self.n = Math.max(ctx.__self.n, ctx.fail.promised_ballot / 100);
});

var __proposer = Seq([
    Nope2("function Proposer(acceptors, proposer_id, n) {"),
    Shift(Seq([
        Nope2("this.proposer_id = proposer_id;"),
        Nope2("this.n = n;"),
        __execute,
        Seq([
            Nope2("this.update_ballot = function(fail) {"),
            Shift(__update),
            Nope2("};"),
        ])
    ])),
    Nope2("}")
]);

var __sign = Fun(hl2("function sign(value, msg) {"), Seq([
    Skip(ctx => {
        ctx.value = JSON.parse(JSON.stringify(ctx.value));
        ctx.__thread.frame_var("value", icbm_proj(ctx.value));
        ctx.__thread.frame_var("msg", new HashVar(ctx.msg));
    }),
    Statement2("value.signs[msg.general] = true;", ctx => {
        if (!ctx.value.signs[ctx.msg.general]) {
            ctx.value.signs[ctx.msg.general] = true;
            ctx.value.len += 1;
            ctx.__thread.frame_var("value", icbm_proj(ctx.value));
        }
    }),
    Cond("len(value.signs) == 2", ctx => ctx.value.len == 2, Seq([
        Statement2("value.signed = true;", ctx => {
            ctx.value.signed = true;
            ctx.__thread.frame_var("value", icbm_proj(ctx.value));
        })
    ])),
    Return2("return value;", ctx => ctx.value)
]), "}");

function icbm_proj(value) {
    if (value==null) {
        return value;
    }
    return [{
        signs: new HashVar(value.signs),
        signed: JSON.stringify(value.signed)
    }];
}

var __unsign = Fun(hl2("function unsign(value, msg) {"), Seq([
    Skip(ctx => {
        ctx.__thread.frame_var("value", icbm_proj(ctx.value));
        ctx.__thread.frame_var("msg", new HashVar(ctx.msg));
    }),
    Cond("value == null", ctx => ctx.value==null, Seq([
        Statement2("value = {signs: {}, signed: false};", ctx => {
            ctx.value = {signs: {}, signed: false, len: 0};
            ctx.__thread.frame_var("value", icbm_proj(ctx.value));
        })
    ])),
    Skip(ctx => {
        ctx.value = JSON.parse(JSON.stringify(ctx.value));
    }),
    Cond("!value.signed", ctx => !ctx.value.signed, Seq([
        Statement2("delete value.signs[msg.general];", ctx => {
            if (ctx.value.signs.hasOwnProperty(ctx.msg.general)) {
                delete ctx.value.signs[ctx.msg.general];
                ctx.__thread.frame_var("value", icbm_proj(ctx.value));
                ctx.value.len-=1;
            }
        })
    ])),
    Return2("return value;", ctx => ctx.value)
]), "}");



var client_loop = Seq([
    While2("while (true) {", function(ctx) { return true; }, Seq([
        TryCatch2(
            "try {", Seq([
                Call(
                    "var launch = proposer.execute(\"ICBM\", unsign, {\n " +
                    "  general: name\n" +
                    "});",
                    function(ctx) {
                        return {
                            key: "ICBM",
                            action: __unsign,
                            msg: { general: ctx.general_name },
                            __self: ctx.proposer
                        };
                    },
                    __execute,
                    function(ctx, ret) {
                        ctx.launch = ret;
                        ctx.__thread.frame_var("launch", icbm_proj(ret));
                    }
                ),
                Cond("launch.signed", ctx => ctx.launch.signed, Seq([
                    Statement2("console.info(\"LAUNCHED!\");", ctx => {
                        console.info("LAUNCHED");
                    })
                ]), Seq([
                    Call(
                        "launch = proposer.execute(\"ICBM\", sign, {\n " +
                        "  general: name\n" +
                        "});",
                        function(ctx) {
                            return {
                                key: "ICBM",
                                action: __sign,
                                msg: { general: ctx.general_name },
                                __self: prososer_a
                            };
                        },
                        __execute,
                        function(ctx, ret) {
                            ctx.launch = ret;
                            ctx.__thread.frame_var("launch", icbm_proj(ret));
                        }
                    ),
                    Statement2("console.info(launch.signed?\"LAUNCHED\":\"STEADY\");", ctx => {
                        console.info(ctx.signed ? "LAUNCHED" : "STEADY");
                    })
                ]))
            ]), "} catch(e) {", (ctx,obj) => {ctx.e = obj;}, Seq([
                Statement2("console.info(e);", ctx => { console.info(ctx.e); })
            ]), "}"
        )
    ]), "}")
]);

var prososer_a = {
    proposer_id: 0,
    n: 1
};

var prososer_b = {
    proposer_id: 1,
    n: 1
};

paxos_model.proposers = [prososer_a, prososer_b];

var general_lee = Seq([
      Skip(ctx => {
        ctx.general_name = "Lee";
        ctx.proposer = prososer_a;
        ctx.__thread.frame_var("proposer_id", ctx.proposer.proposer_id);
        ctx.__thread.frame_var("name", ctx.general_name);
      }),
      client_loop
]);
var general_ross = Seq([
      Skip(ctx => {
        ctx.general_name = "Ross";
        ctx.proposer = prososer_b;
        ctx.__thread.frame_var("proposer_id", ctx.proposer.proposer_id);
        ctx.__thread.frame_var("name", ctx.general_name);
      }),
      client_loop
]);

var lee_thread = ThreadModel(general_lee, paxos_model, "0", 182, 25);
var ross_thread = ThreadModel(general_ross, paxos_model, "1", 51, 100);

function Message(messages) {
    this.id = Message.ID++;
    this.isMessage = true;
    this.messages = messages;
}
Message.ID = 1;

function UpdateBallotMessage(messages, proposer, ballot, thread) {
    Message.call(this, messages);
    this.isUpdateBallotMessage = true;
    this.thread = thread;
    this.ballot = ballot;
    this.proposer = proposer;
    this.execute = function() {
        this.messages.rm(this);

        var thread = ThreadModel(Seq([
            Skip(ctx => {
                ctx.__self = this.proposer;
                ctx.fail = {
                    promised_ballot: this.ballot
                };
            }),
            __update
        ]), {
            ticked: () => {}
        }, this.thread.thread_id, this.thread.color.h, this.thread.color.s);
        thread.init();

        if (thread.is_active) {
            var step = new ThreadMessage(this.messages, thread);
            step.id = this.id;
            this.messages.emit(step);
        }
        
        paxos_model.notify();
    };
    this.lost = function() {
        this.messages.rm(this);
        paxos_model.notify();
    };
}

function AcceptOkMessage(messages, promise, mailbox, thread) {
    Message.call(this, messages);
    this.isAcceptOk = true;
    this.mailbox = mailbox;
    this.thread = thread;
    this.request = promise;
    this.method_call_view = 
      ">" + promise.method_call_view + "\n" +
      "ok();";
    this.execute = function() {
        this.messages.rm(this);
        this.mailbox.pending--;
        this.mailbox.ok.push({});
        this.mailbox.try_unblock();
        paxos_model.notify();
    };
    this.lost = function() {
        this.messages.rm(this);
        this.mailbox.pending--;
        this.mailbox.timeout++;
        this.mailbox.try_unblock();
        paxos_model.notify();
    };
}

function PromiseOkMessage(messages, promise, accepted, mailbox, thread) {
    Message.call(this, messages);
    this.promise = promise;
    this.isPromiseOk = true;
    this.accepted = accepted;
    this.mailbox = mailbox;
    this.thread = thread;
    this.method_call_view = 
      ">" + promise.method_call_view + "\n" +
      "ok(\"" + promise.key + "\", " + JSON.stringify(this.accepted) + ");";
    this.execute = function() {
        this.messages.rm(this);
        this.mailbox.pending--;
        this.mailbox.ok.push(this.accepted);
        this.mailbox.try_unblock();
        paxos_model.notify();
    };
    this.lost = function() {
        this.messages.rm(this);
        this.mailbox.pending--;
        this.mailbox.timeout++;
        this.mailbox.try_unblock();
        paxos_model.notify();
    };
}

function AcceptFailMessage(messages, promise, ballot, mailbox, thread) {
    Message.call(this, messages);
    this.isAcceptFail = true;
    this.ballot = ballot;
    this.mailbox = mailbox;
    this.thread = thread;
    this.request = promise;
    this.method_call_view = 
      ">" + promise.method_call_view + "\n" +
      "fail(" + this.ballot + ");";
    this.execute = function() {
        this.messages.rm(this);
        this.mailbox.pending--;
        this.mailbox.fail.push(this.ballot);
        this.mailbox.try_unblock();

        var thread = ThreadModel(Seq([
            Skip(ctx => {
                ctx.__self = this.mailbox.proposer;
                ctx.fail = {
                    promised_ballot: this.ballot
                };
            }),
            __update
        ]), {
            ticked: () => {}
        }, this.thread.thread_id, this.thread.color.h, this.thread.color.s);
        thread.init();

        if (thread.is_active) {
            var step = new ThreadMessage(this.messages, thread);
            step.id = this.id;
            this.messages.emit(step);
        }
        paxos_model.notify();
    };
    this.lost = function() {
        this.messages.rm(this);
        this.mailbox.timeout++;
        this.mailbox.pending--;
        this.mailbox.try_unblock();
        paxos_model.notify();
    };
}

function ThreadMessage(messages, thread) {
    Message.call(this, messages);
    
    this.thread = thread;
    this.isThreadMessage = true;

    this.execute = function() {
        this.thread.iter();
        if (!this.thread.is_active) {
            this.messages.rm(this);
        }
        paxos_model.notify();
    };
}

function PromiseFailMessage(messages, promise, ballot, mailbox, thread) {
    Message.call(this, messages);
    this.isPromiseFail = true;
    this.ballot = ballot;
    this.mailbox = mailbox;
    this.thread = thread;
    this.promise = promise;
    this.method_call_view = 
      ">" + promise.method_call_view + "\n" +
      "fail(\"" + promise.key + "\", " + this.ballot + ");";
    this.execute = function() {
        this.messages.rm(this);
        this.mailbox.pending--;
        this.mailbox.fail.push(this.ballot);
        this.mailbox.try_unblock();

        var thread = ThreadModel(Seq([
            Skip(ctx => {
                ctx.__self = this.mailbox.proposer;
                ctx.fail = {
                    promised_ballot: this.ballot
                };
            }),
            __update
        ]), paxos_model, this.thread.thread_id, this.thread.color.h, this.thread.color.s);
        thread.init();

        if (thread.is_active) {
            var step = new ThreadMessage(this.messages, thread);
            step.id = this.id;
            this.messages.emit(step);
        }
        paxos_model.notify();
    };
    this.lost = function() {
        this.messages.rm(this);
        this.mailbox.timeout++;
        this.mailbox.pending--;
        this.mailbox.try_unblock();
        paxos_model.notify();
    };
}

function AcceptMessage(messages, acceptor, key, ballot, next, mailbox, thread) {
    Message.call(this, messages);
    this.isAccept = true;
    this.acceptor = acceptor;
    this.key = key;
    this.ballot = ballot;
    this.value = next;
    this.mailbox = mailbox;
    this.thread = thread;
    this.method_call_view = "accept(\"" + 
        this.acceptor.name + "\", \"" + this.key + "\", " + this.ballot + "\," + JSON.stringify(this.value)
    ");";
    this.execute = function() {
        this.messages.rm(this);
        if (!this.acceptor.promised.hasOwnProperty(this.key)) {
            this.acceptor.promised[this.key] = -1;
        }
        if (!this.acceptor.accepted.hasOwnProperty(this.key)) {
            this.acceptor.accepted[this.key] = {
                ballot: -1, value: null
            };
        }
        
        var result
        if (this.acceptor.promised[this.key] <= this.ballot) {
            this.acceptor.promised[this.key] = this.ballot;
            this.acceptor.accepted[this.key] = {ballot: this.ballot, value: this.value};
            result = new AcceptOkMessage(this.messages, this, this.mailbox, this.thread);
        } else {
            result = new AcceptFailMessage(this.messages, this, this.acceptor.promised[key], this.mailbox, this.thread);
        }
        result.id = this.id;
        this.messages.emit(result);
        paxos_model.notify();
    };
    this.lost = function() {
        this.messages.rm(this);
        this.mailbox.timeout++; 
        this.mailbox.pending--;
        this.mailbox.try_unblock();
        paxos_model.notify();
    }
}

function PromiseMessage(messages, acceptor, key, ballot, mailbox, thread) {
    Message.call(this, messages);
    this.isPromise = true;
    this.acceptor = acceptor;
    this.key = key;
    this.ballot = ballot;
    this.mailbox = mailbox;
    this.thread = thread;
    this.method_call_view = "promise(\"" + 
        this.acceptor.name + "\", \"" + this.key + "\", " + this.ballot + 
    ");";
    this.execute = function() {
        this.messages.rm(this);
        if (!this.acceptor.promised.hasOwnProperty(this.key)) {
            this.acceptor.promised[this.key] = -1;
        }
        if (!this.acceptor.accepted.hasOwnProperty(this.key)) {
            this.acceptor.accepted[this.key] = {
                ballot: -1, value: null
            };
        }
        var result;
        if (this.acceptor.promised[this.key] < this.ballot) {
            this.acceptor.promised[this.key] = this.ballot;
            result = new PromiseOkMessage(this.messages, this, this.acceptor.accepted[key], this.mailbox, this.thread);
        } else {
            result = new PromiseFailMessage(this.messages, this, this.acceptor.promised[key], this.mailbox, this.thread);
        }
        result.id = this.id;
        this.messages.emit(result);
        paxos_model.notify();
    };
    this.lost = function() {
        this.messages.rm(this);
        this.mailbox.timeout++; 
        this.mailbox.pending--;
        this.mailbox.try_unblock();
        paxos_model.notify();
    };
}

function Messages() {
    this.__messages = [];
    this.emit = function(msg) {
        this.__messages.push(msg);
        return this;
    };
    this.rm = function(msg) {
        this.__messages = this.__messages.filter(function(item) { 
            return item != msg; 
        });
        return this;
    };
}

paxos_model.paxos = Seq([ Nope2("var MAJORITY = 2;"), __acceptor, __proposer ]);
paxos_model.client = Seq([ __sign, __unsign, client_loop ]);
paxos_model.tx1 = lee_thread;
paxos_model.tx2 = ross_thread;
paxos_model.promise_rpc_call = __promise_rpc;
paxos_model.promise_rpc_wait = promise_rpc_wait;

paxos_model.ticked = function(thread) {
    paxos_model.notify();
};

module.exports = paxos_model;
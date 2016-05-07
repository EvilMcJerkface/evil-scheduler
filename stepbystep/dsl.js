module.exports = {
    Statement: Statement,
    Abort: Abort,
    Seq: Seq,
    Cond: Cond,
    Fun: Fun,
    Call: Call,
    Call2: Call2,
    Return: Return,
    Each: Each,
    Nope: Nope,
    Shift: Shift,
    Skip: Skip,
    Defer: Defer,
    While: While,
    Wormhole: Wormhole,
    Marked: Marked,
    TryCatch: TryCatch,
    Throw: ThrowAst,
    flow: {
        Throw: Throw,
        Unit: Unit
    }
}

var hl2 = require("./monokai");

/////////////////////

function Step(pre, action, post) {
    return {
        isStep: true,
        pre: pre,
        post: post,
        get_action: function() {
            return action;
        },
        bind: function(g) {
            return Step(this.pre, function(ctx) {
                var phase = action(ctx);
                return Phase(phase.step.bind(g), phase.ctx)
            }.bind(this), this.post);
        }
    }
}

function Jump(action) {
    return {
        isJump: true,
        get_action: function() {
            return action;
        },
        bind: function(g) {
            return Jump(function(ctx) {
                var phase = action(ctx);
                return Phase(phase.step.bind(g), phase.ctx)
            });
        }
    }
}

function Throw(obj) {
    return {
        isThrow: true,
        obj: obj,
        bind: function(g) {
            if (g.isCatch) {
                return g.caught(this.obj).bind(g.tail);
            } else {
                return this;
            }
        }
    }
}

function Catch(caught, tail) {
    return {
        isCatch: true,
        caught: caught,
        tail: tail,
        extract: function() {
            return tail;
        },
        bind: function(g) {
            return Catch(caught, this.tail.bind(g));
        }
    }
}

// TODO: implement via try/catch
function AsReturn(step) {
    return {
        isReturn: true,
        step: step,
        bind: function(g) {
            if (!g.isAccept) return this;
            return step.bind(g.step);
        }
    }
}

function AsAccept(step) {
    return {
        isAccept: true,
        step: step,
        extract: function() {
            return step;
        },
        bind: function(g) {
            return AsAccept(step.bind(g));
        }
    }
}

function Unit() {
    return {
        isUnit: true,
        bind: function(g) {
            return g;
        }
    }
}

function Zero() {
    return {
        isZero: true,
        bind: function(g) {
            return this;
        }
    }
}

function Phase(step, ctx) {
    return {
        step: step,
        ctx: ctx
    }
}

/////////////////////

function bind(f,g) {
    return f.bind(g);
}

function unit(x) {
    return x.unit();
}

/////////////////////

function none() {}

function marker(x) {
    return function(thread) {
        if (!x.marked.hasOwnProperty(thread.id)) {
            x.marked[thread.thread_id] = {
                thread: thread,
                hits: []
            };
        }
        x.marked[thread.thread_id].hits.push(thread.ts);
        thread.trace[thread.ts] = x;
    }
}

function unmarker(x) {
    return function(thread) {
        var ts = x.marked[thread.thread_id].hits.pop();
        if (x.marked[thread.thread_id].hits.length==0) {
            delete x.marked[thread.thread_id];
        }
        delete thread.trace[ts];
    }
}

/////////////////////

// Move to ast.*

// TODO: remove
function Wormhole() {
    this.pres = [];
    this.posts = [];
    this.pre = function() {
        this.pres.forEach(function(x) { x(); });
    };
    this.post = function() {
        this.posts.forEach(function(x) { x(); });
    };
    this.reg = function(stmnt) {
        var wh = this;
        var step = stmnt.unit();
        this.pres.push(step.pre);
        this.posts.push(step.post);
        step.unit = function() {
            return Step(wh.pre.bind(wh), step.action, wh.post.bind(wh));
        };
        return step;
    }
}

function Statement(view, action) {
    var self = {
        view: view,
        action: action,
        marked: {},
        unit: function() {
            return Step(marker(self), function(ctx){
                action(ctx);
                return Phase(Unit(), ctx);
            }, unmarker(self));
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, self.view);
            return writer;
        }
    };
    return self;
}

function Marked(label, body) {
    var self = {
        label: label,
        unit: function() { return body.unit(); },
        accept_writer: function(offset, writer, shift) {
            writer.begin_marked(label);
            body.accept_writer(offset, writer, shift);
            writer.end_marked();
            return writer;
        }
    };
    return self;
}

function Skip(action) {
    var self = {
        action: action,
        unit: function() {
            return Jump(function(ctx) {
                action(ctx);
                return Phase(Unit(), ctx);
            });
        },
        accept_writer: function(offset, writer, shift) {
            return writer;
        }
    };
    return self;
}

function Defer(action) {
    var self = {
        action: action,
        unit: function() {
            return Jump(function(ctx) {
                let [step, state] = action(ctx);
                return Phase(step, state);
            });
        },
        accept_writer: function(offset, writer, shift) {
            return writer;
        }
    };
    return self;
}

function TryCatch(try_view, expression, catch_view, pack, handler, end) {
    var self = {
        try_view: try_view,
        expression: expression,
        catch_view: catch_view,
        pack: pack,
        handler: handler,
        end: end,
        marked: {},
        unit: function() {
            var call = Step(marker(self), function(ctx) {
                return Phase(expression.unit(), ctx);
            }, unmarker(self));

            var catcher = Catch(function(obj) {
                return Jump(function(ctx) {
                    pack(ctx, obj);
                    return Phase(self.handler.unit(), ctx);
                });
            }, Unit());
            
            return call.bind(catcher);
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, try_view);
            self.expression.accept_writer(offset + shift, writer, shift);
            writer.write(self.marked, offset, catch_view);
            self.handler.accept_writer(offset + shift, writer, shift);
            writer.write(self.marked, offset, end);
            return writer;
        }
    };
    return self;
}

function Return(view, selector) {
    var self = {
        view: view,
        selector: selector,
        marked: {},
        unit: function() {
            return AsReturn(Step(marker(self), function(ctx){
                ctx.__ret = self.selector(ctx)
                return Phase(Unit(), ctx);
            }, unmarker(self)));
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, self.view);
            return writer;
        }
    };
    return self;
}

function ThrowAst(view, selector) {
    var self = {
        view: view,
        selector: selector,
        marked: {},
        unit: function() {
            return Step(marker(self), function(ctx) {
                var obj = selector(ctx);
                return Phase(Throw(obj), ctx);
            }, unmarker(self));
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, self.view);
            return writer;
        }
    };
    return self;
}

// TODO: remove in favor of Throw
function Abort(view) {
    var self = {
        marked: {},
        view: view,
        unit: function() {
            return Step(marker(self), function(ctx){
                return Phase(Zero(), ctx);
            }, unmarker(self));
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, view);
            return writer;
        }
    };
    return self;
}

function Seq(statements) {
    var self = {
        statements: statements,
        unit: function() {
            return self.statements.map(unit).reduce(bind, Unit());
        },
        accept_writer: function(offset, writer, shift) {
            for (var i=0;i<self.statements.length;i++) {
                self.statements[i].accept_writer(offset, writer, shift)
            }
            return writer;
        }
    }
    return self;
}

function Cond(cond_view, predicate, body, alt) {
    var self = {
        cond_view: cond_view,
        predicate: predicate,
        body: body,
        alt: alt,
        marked: {},
        unit: function() {
            return Step(marker(self), function(ctx){
                if (predicate(ctx)) {
                    return Phase(body.unit(), ctx);
                } else {
                    if (alt) {
                        return Phase(alt.unit(), ctx);
                    } else {
                        return Phase(Unit(), ctx);
                    }
                }
            }, unmarker(self));
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, hl2("if (" + cond_view + ") {"));
            body.accept_writer(offset+shift, writer, shift);
            if (alt) {
                writer.write(false, offset, hl2("} else {"));
                alt.accept_writer(offset+shift, writer, shift);
                writer.write(false, offset, "}");
            } else {
                writer.write(false, offset, "}");
            }
            return writer;
        }
    }
    return self;
}

function Fun(begin, body, end) {
    var self = {
        signature: begin,
        body: body,
        end: end,
        unit: function() {
            return Unit();
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(false, offset, begin);
            body.accept_writer(offset+shift, writer, shift);
            writer.write(false, offset, end);
            return writer;
        }
    };
    return self;
}


function While(view_begin, pred, body, view_end) {
    var self = {
        marked: {},
        unit: function() {
            return Step(marker(self), function(ctx) {
                if (pred(ctx)) {
                    return Phase(body.unit().bind(self.unit()), ctx)
                } else {
                    return Phase(Unit(), ctx);
                }    
            }, unmarker(self));
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, view_begin);
            body.accept_writer(offset+shift, writer, shift);
            writer.write(self.marked, offset, view_end);
        }
    };
    return self;
}


function Each(selector, pack, begin, body, end) {
    var self = {
        selector: selector,
        pack: pack,
        begin: begin,
        body: body,
        end: end,
        marked: {},
        unit: function() {
            return Step(marker(self), function(ctx) {
                var xs = selector(ctx);
                var arr = [];
                xs.forEach(function(x) { arr.push(x); });
                if (xs.length==0) {
                    return Phase(Unit(), ctx);
                } else {
                    var tail = Jump(function(ctx) {
                        ctx.__thread.pop_frame();
                        return Phase(Unit(), ctx);
                    }).bind(Step(marker(self), function(ctx) {
                        return Phase(Unit(), ctx.__seed);
                    }, unmarker(self)));
                    for (var i=xs.length-1;i>=0;i--) {
                        tail =(function(item){
                            var repack = Jump(function(ctx) {
                                ctx.__thread.pop_frame();
                                var packed = pack(item);
                                packed.__thread = ctx.__thread;
                                packed.__seed = ctx.__seed;
                                ctx.__thread.push_frame();
                                return Phase(Unit(), packed);
                            });
                            return repack.bind(body.unit()).bind(tail);
                        })(xs[i]);
                    }
                    ctx.__thread.push_frame();
                    return Phase(tail, {__seed: ctx, __thread: ctx.__thread});
                }
            }, unmarker(self));
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, begin);
            body.accept_writer(offset+shift, writer, shift);
            writer.write(self.marked, offset, end);
            return writer;
        }
    };
    
    return self;
}

// TODO: replace with Call2
function Call(view, pack, fun, unpack) {
    var self = {
        view: view,
        pack: pack,
        fun: fun,
        unpack: unpack,
        marked: {},
        unit: function() {
            var call = Step(marker(self), function(ctx) {
                ctx.__thread.push_frame();
                var sub = pack(ctx);
                sub.__seed = ctx;
                sub.__fun = fun;
                sub.__thread = ctx.__thread;
                return Phase(fun.body.unit(), sub);
            }, none);
            var accept = AsAccept(Jump(function(ctx) {
                var seed = ctx.__seed;
                var ret = ctx.__ret;
                ctx.__thread.pop_frame();
                unpack(seed, ret);
                return Phase(Unit(), seed);
            }));
            var pause = Step(none, function(ctx) {
                return Phase(Unit(), ctx);
            }, unmarker(self));
            var catcher = Catch(function(obj) {
                return Jump(function(ctx) {
                    unmarker(self)(ctx.__thread);
                    ctx.__thread.pop_frame();
                    return Phase(Throw(obj), ctx.__seed);
                });
            }, Unit());
            return call.bind(accept).bind(pause).bind(catcher);
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, view);
            return writer;
        }
    };
    return self;
}

function Call2(view, pack, fun, unpack) {
    var self = {
        view: view,
        pack: pack,
        fun: fun,
        unpack: unpack,
        marked: {},
        unit: function() {
            var call = Step(marker(self), function(ctx) {
                var fun = self.fun(ctx);
                ctx.__thread.push_frame();
                var sub = pack(ctx);
                sub.__seed = ctx;
                sub.__fun = fun;
                sub.__thread = ctx.__thread;
                return Phase(fun.body.unit(), sub);
            }, none);
            var accept = AsAccept(Jump(function(ctx) {
                var seed = ctx.__seed;
                var ret = ctx.__ret;
                ctx.__thread.pop_frame();
                unpack(seed, ret);
                return Phase(Unit(), seed);
            }));
            var pause = Step(none, function(ctx) {
                return Phase(Unit(), ctx);
            }, unmarker(self));
            var catcher = Catch(function(obj) {
                return Jump(function(ctx) {
                    unmarker(self)(ctx.__thread);
                    ctx.__thread.pop_frame();
                    return Phase(Throw(obj), ctx.__seed);
                });
            }, Unit());
            return call.bind(accept).bind(pause).bind(catcher);
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(self.marked, offset, view);
            return writer;
        }
    };
    
    return self;
}

function Nope(view) {
    var self = {
        view: view,
        unit: function() {
            return Unit();
        },
        accept_writer: function(offset, writer, shift) {
            writer.write(false, offset, view);
            return writer;
        }
    };
    return self;
}

function Shift(body) {
    var self = {
        body: body,
        unit: function() {
            return Unit();
        },
        accept_writer: function(offset, writer, shift) {
            body.accept_writer(offset+shift, writer, shift);
            return writer;
        }
    };
    return self;
}
module.exports = {
    Statement: Statement,
    Abort: Abort,
    Seq: Seq,
    Cond: Cond,
    Fun: Fun,
    Call: Call,
    Return: Return
}

/////////////////////

function Step(pre, action, post) {
    return {
        isStep: true,
        pre: pre,
        action: action,
        post: post,
        bind: function(g) {
            return Step(this.pre, function(ctx) {
                var phase = this.action(ctx);
                return Phase(phase.step.bind(g), phase.ctx)
            }.bind(this), this.post);
        }
    }
}

function AsReturn(step) {
    step.isReturn = true;
    var old_bind = step.bind.bind(step);
    step.bind = function(g) {
        if (!g.isAccept) return this;
        return old_bind(g);
    }
    return step;
}

function AsAccept(step) {
    step.isAccept = true;
    return step;
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

function marker(x) {
    return function(thread_id) {
        x.threads[thread_id] = true;
    }
}

function unmarker(x) {
    return function(thread_id) {
        x.threads[thread_id] = false;
    }
}

/////////////////////

function Statement(view, action) {
    var self = {
        view: view,
        action: action,
        threads: {},
        unit: function() {
            return Step(marker(self), function(ctx){
                self.action(ctx);
                return Phase(Unit(), ctx);
            }, unmarker(self));
        },
        accept_writer: function(offset, writer) {
            writer.write(self.threads, offset, self.view);
            return writer;
        }
    };
    return self;
}

function Return(view, selector) {
    var self = {
        view: view,
        selector: selector,
        threads: {},
        unit: function() {
            return AsReturn(Step(marker(self), function(ctx){
                ctx.__ret = self.selector(ctx)
                return Phase(Unit(), ctx);
            }, unmarker(self)));
        },
        accept_writer: function(offset, writer) {
            writer.write(self.threads, offset, self.view);
            return writer;
        }
    };
    return self;
}

function Abort(view) {
    var self = {
        threads: {},
        view: view,
        unit: function() {
            return Step(marker(self), function(ctx){
                return Phase(Zero(), ctx);
            }, unmarker(self));
        },
        accept_writer: function(offset, writer) {
            writer.write(self.threads, offset, view);
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
        accept_writer: function(offset, writer) {
            for (var i=0;i<self.statements.length;i++) {
                self.statements[i].accept_writer(offset, writer)
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
        threads: {},
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
        accept_writer: function(offset, writer) {
            writer.write(self.threads, offset, "if (" + cond_view + ") {");
            body.accept_writer(offset+4, writer);
            if (alt) {
                writer.write(false, offset, "} else {");
                alt.accept_writer(offset+4, writer);
                writer.write(false, offset, "}");
            } else {
                writer.write(false, offset, "}");
            }
            return writer;
        }
    }
    return self;
}

function Fun(signature, body) {
    var self = {
        signature: signature,
        body: body,
        unit: function() {
            return Unit();
        },
        accept_writer: function(offset, writer) {
            writer.write(false, offset, "function " + signature + " {");
            body.accept_writer(offset+4, writer);
            writer.write(false, offset, "}");
            return writer;
        }
    };
    return self;
}

function Call(view, pack, fun, unpack) {
    var self = {
        view: view,
        pack: pack,
        fun: fun,
        unpack: unpack,
        threads: {},
        unit: function() {
            return bind(
                Step(marker(self), function(ctx) {
                    var sub = pack(ctx);
                    sub.__seed = ctx;
                    return Phase(fun.body.unit(), sub);
                }, unmarker(self)),
                AsAccept(Step(marker(self), function(ctx) {
                    if (!ctx.__seed) {
                        throw "WTF?!";
                    }
                    var seed = ctx.__seed;
                    var ret = ctx.__ret;
                    unpack(seed, ret);
                    return Phase(Unit(), seed);
                } ,unmarker(self)))
            );
        },
        accept_writer: function(offset, writer) {
            writer.write(self.threads, offset, view);
            return writer;
        }
    };
    
    return self;
}
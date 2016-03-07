module.exports = {
	ThreadModel: ThreadModel,
	AppModel: AppModel,
    HashVar: HashVar
};

function HashVar(obj) {
    this.obj = obj;
}

function ThreadModel(entry_point, app_model, thread_id, h, s) {
    var self = {
        thread_id: thread_id,
        is_active: false,
        was_active: false,
        was_aborted: false,
        thread: entry_point,
        color: {h: h, s: s},
        ts: 0,
        trace: {},
        step: {},

        push_frame: function() {
            app_model.push_frame(self);
        },
        pop_frame: function() {
            app_model.pop_frame(self);
        },
        frame_var: function(name, obj) {
            app_model.frame_var(self, name, obj);
        },
        init: function() {
            self.was_active = true;
            self.was_aborted = false;
            self.step = self.thread.unit();
            self.ctx = {
                __thread: self
            };
            
            while (self.step.isJump || self.step.isAccept) {
                while (self.step.isJump) {
                    var phase = self.step.get_action()(self.ctx);
                    self.ctx = phase.ctx;
                    self.step = phase.step;
                }
                if (self.step.isAccept) {
                    self.step = self.step.extract();
                }
            }
            
            if (self.step.isStep) {
                self.ts += 1;
                self.is_active = true;
                self.step.pre(self);
            }
            app_model.ticked(self);
        },
        unselect: function() {
            var trace = [];
            for (var ts in self.trace) {
                if (!self.trace.hasOwnProperty(ts)) {
                    continue;
                }
                trace.push(ts);
            }
            trace.forEach(function(ts) {
                delete self.trace[ts].marked[self.thread_id]
                delete self.trace[ts];
            });
        },
        abort: function() {
            self.unselect();
            self.was_aborted = true;
            self.is_active = false;
            self.ctx = {
                __thread: self
            };
            app_model.clear_frames(self);
            app_model.ticked(self);
        },
        iter: function() {
            if (self.step.isStep) {
                var phase = self.step.get_action()(self.ctx);
                self.step.post(self);
                self.ctx = phase.ctx;
                self.step = phase.step;
                while (self.step.isJump || self.step.isAccept) {
                    while (self.step.isJump) {
                        var phase = self.step.get_action()(self.ctx);
                        self.ctx = phase.ctx;
                        self.step = phase.step;
                    }
                    if (self.step.isAccept) {
                        self.step = self.step.extract();
                    }
                }
            }
            if (self.step.isStep) {
                self.ts += 1;
                self.step.pre(self);
            } else {
                if (self.step.isZero) {
                    self.was_aborted = true;
                }
                self.is_active = false;
                self.unselect();
            }
            app_model.ticked(self);
        }
    };
    return self;
}

function AppModel() {
    var app_model = {
        on_state_updated: null,
        notify: function() {
            if (app_model.on_state_updated != null) {
                app_model.on_state_updated(app_model);
            }
        }
    };
    return app_model;
}
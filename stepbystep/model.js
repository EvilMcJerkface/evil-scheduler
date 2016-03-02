module.exports = {
	ThreadModel: ThreadModel,
	AppModel: AppModel
};

function ThreadModel(entry_point, app_model, thread_id) {
    var thread_model = {
        thread_id: thread_id,
        is_active: false,
        was_active: false,
        was_aborted: false,
        thread: entry_point,
        init: function() {
            thread_model.was_active = true;
            thread_model.was_aborted = false;
            thread_model.step = thread_model.thread.unit();
            thread_model.ctx = {};
            if (thread_model.step.isStep) {
                thread_model.is_active = true;
                thread_model.step.pre(thread_id);
            }
            app_model.notify();
        },
        iter: function() {
            if (thread_model.step.isStep) {
                var phase = thread_model.step.action(thread_model.ctx);
                thread_model.step.post(thread_id);
                thread_model.ctx = phase.ctx;
                thread_model.step = phase.step;
            }
            if (thread_model.step.isStep) {
                thread_model.step.pre(thread_id);
            } else {
                if (thread_model.step.isZero) {
                    thread_model.was_aborted = true;
                }
                thread_model.is_active = false;
            }
            app_model.notify();
        }
    };
    return thread_model;
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
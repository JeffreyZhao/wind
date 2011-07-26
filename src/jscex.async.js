Jscex.Async = { };

/** @constructor */
Jscex.Async.Task = function (delegate) {
    this._delegate = delegate;
    this._handlers = [];
    this.status = "ready";
}
Jscex.Async.Task.prototype = {
    start: function () {
        if (this.status != "ready") {
            throw 'Task can only be started in "ready" status.';
        }

        var _this = this;

        this.status = "running";
        this._delegate["onStart"](function (type, value) {

            if (_this.status != "running") {
                throw ('Callback can only be used in "running" status.');
            }

            if (type == "success") {

                _this.result = value;
                _this.status = "succeeded";

            } else if (type == "failure") {

                _this.error = value;
                _this.status = "failed";

            } else if (type == "cancel") {

                _this.status = "canceled";

            } else {
                throw ("Unsupported type: " + type);
            }
            
            _this._notify();
        });
    },

    cancel: function () {
        if (this.status != "running") {
            throw 'Task can only be canceled in "running" status';
        }

        var onCancel = this._delegate["onCancel"];
        if (onCancel) onCancel();

        this._notify();
    },

    _notify: function () {
        var handlers = this._handlers;
        delete this._handlers;
        
        for (var i = 0; i < handlers.length; i++) {
            handlers[i](this);
        }
    },

    addListener: function (handler) {
        if (!this._handlers) {
            throw ('Listeners can only be added in "ready" or "running" status.');
        }

        this._handlers.push(handler);
    }
};

(function () {

    var AsyncBuilder = function () { }

    AsyncBuilder.prototype = {
        "binder": "$await",

        "Start": function (_this, task) {

            var delegate = {
                "onStart": function (callback) {
                    task.next(_this, function (type, value, target) {
                        if (type == "normal" || type == "return") {
                            callback("success", value);
                        } else if (type == "throw") {
                            callback("failure", value);
                        } else {
                            throw "Unsupported type: " + type;
                        }
                    });
                }
            };

            return new Jscex.Async.Task(delegate);
        },

        "Bind": function (task, generator) {
            return {
                "next": function (_this, callback) {
                    
                    var onComplete = function (t) {
                        if (t.status == "succeeded") {
                            var nextTask;
                            try {
                                nextTask = generator.call(_this, task.result);
                            } catch (ex) {
                                callback("throw", ex);
                                return;
                            }

                            nextTask.next(_this, callback);
                        } else {
                            callback("throw", task.error);
                        }
                    }

                    if (task.status == "ready") {
                        task.addListener(onComplete);
                        task.start();
                    } else if (task.status == "running") {
                        task.addListener(onComplete);
                    } else {
                        onComplete(task);
                    }
                }
            };
        }
    }

    for (var m in Jscex.builderBase) {
        AsyncBuilder.prototype[m] = Jscex.builderBase[m];
    }

    Jscex.builders["async"] = new AsyncBuilder();

    var async = Jscex.Async;

    async.sleep = function (delay) {
        var id;
        var delegate = {
            "onStart": function (callback) {
                id = setTimeout(function () { callback("success"); }, delay);
            },

            "onCancel": function () {
                clearTimeout(id);
            }
        };

        return new Jscex.Async.Task(delegate);
    }

    async.onEvent = function (ele, ev) {
        var eventName = "on" + ev;

        var delegate = {
            "onStart": function (callback) {
                var handler = function (ev) {
                    ele[eventName] = null;
                    callback("success", ev);
                }

                ele[eventName] = handler;
            },

            "onCancel": function () {
                ele[eventName] = null;
            }
        };

        return new Jscex.Async.Task(delegate);
    }

    async.parallel = function (tasks) {
        
        var delegate = {
            "onStart": function (callback) {

                var tasksClone = [];
                for (var i = 0; i < tasks.length; i++) {
                    var t = tasks[i];
                    t._p_idx = i;

                    tasksClone.push(t);
                }

                var finished = false;
                var runningNumber = tasksClone.length;
                var results = [];

                var taskCompleted = function (t) {
                    if (finished) return;

                    if (t.status == "failed") {
                        finished = true;
                        callback("failure", { task: t });
                    } else if (t.status == "succeeded") {
                        results[t._p_idx] = t.result;

                        runningNumber--;
                        if (runningNumber == 0) {
                            finished = true;
                            callback("success", results);
                        }
                    }
                }

                for (var i = 0; i < tasksClone.length; i++) {
                    var t = tasksClone[i];
                    switch (t.status) {
                        case "failed":
                        case "succeeded":
                            taskCompleted(t);
                            break;
                        case "running":
                            t.addListener(taskCompleted);
                            break;
                        case "ready":
                            t.addListener(taskCompleted);
                            t.start();
                            break;
                    }
                }
            }
        };

        return new Jscex.Async.Task(delegate);
    }
       
})();

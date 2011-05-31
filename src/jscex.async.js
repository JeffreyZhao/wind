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
            throw ("Cannot start in current status: " + this.status);
        }

        var _this = this;

        this.status = "running";
        this._delegate.start(function (type, value) {

            if (type == "success") {

                _this.result = value;
                _this.status = "succeeded";

            } else if (type == "failure") {

                _this.error = value;
                _this.status = "failed";

            } else {
                throw ("Unsupported type: " + type);
            }
            
            var handlers = _this._handlers;
            delete _this._handlers;
            
            for (var i = 0; i < handlers.length; i++) {
                try { handlers[i](_this); } catch (ex) { }
            }

        });
    },

    addListener: function (handler) {
        if (!this._handlers) {
            throw ("Cannot add listeners in current status: " + this.status);
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
                "start": function (callback) {
                    task.start(_this, function (type, value, target) {
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
                "start": function (_this, callback) {
                    
                    var onComplete = function (t) {
                        if (t.status == "succeeded") {
                            var nextTask;
                            try {
                                nextTask = generator.call(_this, task.result);
                            } catch (ex) {
                                callback("throw", ex);
                                return;
                            }

                            nextTask.start(_this, callback);
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
        var delegate = {
            "start": function (callback) {
                setTimeout(function () { callback("success"); }, delay);
            }
        };

        return new Jscex.Async.Task(delegate);
    }

    async.onEvent = function (ele, ev) {
        var delegate = {
            "start": function (callback) {
                var eventName = "on" + ev;

                var handler = function (ev) {
                    ele[eventName] = null;
                    callback("success", ev);
                }

                ele[eventName] = handler;
            }
        };

        return new Jscex.Async.Task(delegate);
    }

    async.parallel = function (tasks) {
        
        var delegate = {
            start: function (callback) {

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

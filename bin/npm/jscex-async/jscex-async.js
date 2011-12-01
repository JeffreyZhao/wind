(function () {

    var CanceledError = function () { }
    CanceledError.prototype.isCancellation = true;

    var CancellationToken = function () { }
    CancellationToken.prototype = {
        register: function (handler) {
            if (this.isCancellationRequested) {
                handler();
            }

            if (!this._handlers) {
                this._handlers = [];
            }

            this._handlers.push(handler);
        },
        
        cancel: function () {
            if (this.isCancellationRequested) {
                return;
            }

            this.isCancellationRequested = true;

            var handlers = this._handlers;
            delete this._handlers;

            for (var i = 0; i < handlers.length; i++) {
                try {
                    handlers[i]();
                } catch (ex) {
                    Jscex.log("Cancellation handler threw an error: " + ex);
                }
            }
        },

        throwIfCancellationRequested: function () {
            if (this.isCancellationRequested) {
                throw new CanceledError();
            }
        }
    };

    var taskIdSeed = 0;

    var Task = function (delegate) {
        this.id = (++taskIdSeed);
        this._delegate = delegate;
        this._listeners = [];
        this.status = "ready";
    }
    Task.prototype = {
        start: function () {
            if (this.status != "ready") {
                throw new Error('Task can only be started in "ready" status.');
            }

            var _this = this;

            this.status = "running";
            this._delegate.onStart(function (type, value) {

                if (_this.status != "running") {
                    throw new Error('Callback can only be used in "running" status.');
                }

                if (type == "success") {

                    _this.result = value;
                    _this.status = "succeeded";

                } else if (type == "failure") {

                    _this.error = value;

                    if (value.isCancellation) {
                        _this.status = "canceled";
                    } else {
                        _this.status = "failed";
                    }

                } else {
                    throw new Error("Unsupported type: " + type);
                }
                
                _this._notify();
            });
        },

        _notify: function () {
            var listeners = this._listeners;
            delete this._listeners;

            for (var i = 0; i < listeners.length; i++) {
                try {
                    listeners[i](this);
                } catch (ex) {
                    Jscex.log("Task listener threw an error: " + ex);
                }
            }
        },

        addListener: function (listener) {
            if (!this._listeners) {
                throw new Error('Listeners can only be added in "ready" or "running" status.');
            }

            this._listeners.push(listener);
        },

        removeListener: function (listener) {
            if (!this._listeners) {
                throw new Error('Listeners can only be removed in "ready" or "running" status.');
            }

            var index = this._listeners.indexOf(listener);
            if (index > 0) {
                this._listeners.splice(index, 1);
            }
        }
    };

    var Builder = function () { }
    Builder.prototype = {
        Start: function (_this, task) {

            var delegate = {
                onStart: function (callback) {
                    task.next(_this, function (type, value, target) {
                        if (type == "normal" || type == "return") {
                            callback("success", value);
                        } else if (type == "throw") {
                            callback("failure", value);
                        } else {
                            throw new Error("Unsupported type: " + type);
                        }
                    });
                }
            };

            return new Task(delegate);
        },

        Bind: function (task, generator) {
            return {
                next: function (_this, callback) {
                    
                    var onComplete = function (t) {
                        if (t.error) {
                            callback("throw", t.error);
                        } else {
                            var nextTask;
                            try {
                                nextTask = generator.call(_this, t.result);
                            } catch (ex) {
                                callback("throw", ex);
                                return;
                            }

                            nextTask.next(_this, callback);
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

    var init = function (scope, compiler) {
    
        if (!compiler) {
            compiler = scope;
        }
    
        if (!scope.Async) {
            scope.Async = { };
        };
        
        var async = scope.Async;
        async.CancellationToken = CancellationToken;
        async.CanceledError = CanceledError;
        async.Task = Task;
        async.Builder = Builder;
        
        if (!scope.builders) {
            scope.builders = [];
        }
        
        if (!scope.builders["async"]) {
            scope.builders["async"] = new Builder();
        }
        
        if (compiler.binders) {
            compiler.binders["async"] = "$await";
        }
    }
    
    var isCommonJS = (typeof require !== "undefined" && typeof module !== "undefined" && module.exports);
    
    if (isCommonJS) {
        require("./jscex-builderbase").standardizeBuilder(Builder.prototype);
        module.exports.init = init;
    } else {
        Jscex.standardizeBuilder(Builder.prototype);
        init(Jscex);
    }

})();

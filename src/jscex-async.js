(function () {

    var CanceledError = function () { }
    CanceledError.prototype.isCancellation = true;

    var taskIdSeed = 0;
    
    var isCommonJS = (typeof require !== "undefined" && typeof module !== "undefined" && module.exports);

    var init = function (root, compiler) {
    
        if (!compiler) {
            compiler = root;
        }
        
        if (compiler.binders) {
            compiler.binders["async"] = "$await";
        }
        
        if (!root.modules) {
            root.modules = { };
        }
        
        if (root.modules["async"]) {
            return;
        }
        
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
            
            unregister: function (handler) {
                if (!this._handlers) {
                    return;
                }
                
                var index = this._handlers.indexOf(handler);
                if (index >= 0) {
                    this._handlers.splice(index, 1);
                }
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
                        root.log("WARNING: Cancellation handler threw an error: " + ex);
                    }
                }
            },

            throwIfCancellationRequested: function () {
                if (this.isCancellationRequested) {
                    throw new CanceledError();
                }
            }
        };
    
        var Task = function (delegate) {
            this.id = (++taskIdSeed).toString();
            this._delegate = delegate;
            this._listeners = { };
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
                        _this._notify("success");

                    } else if (type == "failure") {

                        _this.error = value;

                        if (value.isCancellation) {
                            _this.status = "canceled";
                        } else {
                            _this.status = "failed";
                        }
                        
                        _this._notify("failure");

                    } else {
                        throw new Error("Unsupported type: " + type);
                    }
                    
                    _this._notify("complete");
                    delete _this._listeners;
                });
            },

            _notify: function (ev) {
                var listeners = this._listeners[ev];
                if (!listeners) {
                    return;
                }

                for (var i = 0; i < listeners.length; i++) {
                    try {
                        listeners[i](this);
                    } catch (ex) {
                        root.log("WARNING: the task's " + ev + " listener threw an error: " + ex);
                    }
                }
            },

            addEventListener: function (ev, listener) {
                if (!this._listeners) {
                    throw new Error('Listeners can only be added in "ready" or "running" status.');
                }

                if (!this._listeners[ev]) {
                    this._listeners[ev] = [];
                }
                
                this._listeners[ev].push(listener);
            },

            removeEventListener: function (ev, listener) {
                if (!this._listeners) {
                    throw new Error('Listeners can only be removed in "ready" or "running" status.');
                }

                var evListeners = this._listeners[ev];
                if (!evListeners) return;
                
                var index = evListeners.indexOf(listener);
                if (index >= 0) {
                    evListeners.splice(index, 1);
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
                            task.addEventListener("complete", onComplete);
                            task.start();
                        } else if (task.status == "running") {
                            task.addEventListener("complete", onComplete);
                        } else {
                            onComplete(task);
                        }
                    }
                };
            }
        }
        
        if (isCommonJS) {
            require("./jscex-builderbase").standardizeBuilder(Builder.prototype);
        } else {
            root.standardizeBuilder(Builder.prototype);
        }
    
        if (!root.Async) {
            root.Async = { };
        };
        
        var async = root.Async;
        async.CancellationToken = CancellationToken;
        async.CanceledError = CanceledError;
        async.Task = Task;
        async.Builder = Builder;
        
        if (!root.builders) {
            root.builders = [];
        }
        
        root.builders["async"] = new Builder();
        
        root.modules["async"] = true;
    }
    
    if (isCommonJS) {
        module.exports.init = init;
    } else {
        init(Jscex);
    }

})();
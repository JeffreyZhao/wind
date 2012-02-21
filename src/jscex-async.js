(function () {

    var CanceledError = function () { }
    CanceledError.prototype = {
        isCancellation: true,
        message: "The task has been cancelled."
    }

    // seed defined in global
    if (typeof __jscex__async__taskIdSeed === "undefined") {
        __jscex__async__taskIdSeed = 0;
    }

    var isTask = function (t) {
        return (typeof t.start === "function") && (typeof t.addEventListener) === "function" && (typeof t.removeEventListener) === "function" && (typeof t.complete) === "function";
    }
    
    var init = function (root) {
        
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
                        root.logger.warn("[WARNING] Cancellation handler threw an error: " + ex);
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
            this.id = (++__jscex__async__taskIdSeed);
            this._delegate = delegate;
            this._listeners = { };
            this.status = "ready";
        }
        Task.prototype = {
            start: function () {
                if (this.status != "ready") {
                    throw new Error('Task can only be started in "ready" status.');
                }

                this.status = "running";
                this._delegate(this);
                
                return this;
            },
            
            complete: function (type, value) {
                if (this.status != "running") {
                    throw new Error('The "complete" method can only be called in "running" status.');
                }

                var listeners = this._listeners;
                delete this._listeners;
                
                if (type == "success") {

                    this.result = value;
                    this.status = "succeeded";
                    this._notify("success", listeners["success"]);

                } else if (type == "failure") {

                    this.error = value;

                    if (value.isCancellation) {
                        this.status = "canceled";
                    } else {
                        this.status = "faulted";
                    }
                    
                    this._notify("failure", listeners["failure"]);

                } else {
                    throw new Error("Unsupported type: " + type);
                }
                
                this._notify("complete", listeners["complete"]);
                
                if (this.error && !listeners["failure"] && !listeners["complete"]) {
                    root.logger.warn("[WARNING] An unhandled error occurred: " + this.error);
                }
            },

            _notify: function (ev, listeners) {
                if (!listeners) {
                    return;
                }

                for (var i = 0; i < listeners.length; i++) {
                    try {
                        listeners[i].call(this);
                    } catch (ex) {
                        root.logger.warn("[WARNING] The task's " + ev + " listener threw an error: " + ex);
                    }
                }
            },

            addEventListener: function (ev, listener) {
                if (!this._listeners) {
                    return this;
                }

                if (!this._listeners[ev]) {
                    this._listeners[ev] = [];
                }
                
                this._listeners[ev].push(listener);
                return this;
            },

            removeEventListener: function (ev, listener) {
                if (!this._listeners) {
                    return this;
                }

                var evListeners = this._listeners[ev];
                if (!evListeners) return this;
                
                var index = evListeners.indexOf(listener);
                if (index >= 0) {
                    evListeners.splice(index, 1);
                }
                
                return this;
            }
        };
        
        Task.create = function (delegate) {
            return new Task(delegate);
        }
        
        Task.isTask = isTask;
        
        var AsyncBuilder = function () { }
        AsyncBuilder.prototype = {
            Start: function (_this, task) {
                return Task.create(function (t) {
                    task.next(_this, function (type, value, target) {
                        if (type == "normal" || type == "return") {
                            t.complete("success", value);
                        } else if (type == "throw") {
                            t.complete("failure", value);
                        } else {
                            throw new Error("Unsupported type: " + type);
                        }
                    });
                });
            },

            Bind: function (task, generator) {
                return {
                    next: function (_this, callback) {
                        
                        var onComplete = function (t) {
                            if (this.error) {
                                callback("throw", this.error);
                            } else {
                                var nextTask;
                                try {
                                    nextTask = generator.call(_this, this.result);
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
        
        for (var m in root.BuilderBase.prototype) {
            AsyncBuilder.prototype[m] = root.BuilderBase.prototype[m];
        }
    
        if (!root.Async) {
            root.Async = { };
        };
        
        var async = root.Async;
        async.CancellationToken = CancellationToken;
        async.CanceledError = CanceledError;
        async.Task = Task;
        async.AsyncBuilder = AsyncBuilder;
        
        if (!root.builders) {
            root.builders = { };
        }
        
        root.binders["async"] = "$await";
        root.builders["async"] = new AsyncBuilder();
        
        root.modules["async"] = true;
    }
    
    // CommonJS
    var isCommonJS = (typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommongJS Wrapping
    var isWrapping = (typeof define === "function" && !define.amd);
    // CommonJS AMD
    var isAmd = (typeof require === "function" && typeof define === "function" && define.amd);
    
    if (isCommonJS) {
        module.exports.init = function (root) {
            if (!root.modules["builderbase"]) {
                if (typeof __dirname === "string") {
                    try {
                        require.paths.unshift(__dirname);
                    } catch (_) {
                        try {
                            module.paths.unshift(__dirname);
                        } catch (_) {}
                    }
                }
            
                require("jscex-builderbase").init(root);
            }
            
            init(root);
        };
    } else if (isWrapping) {
        define("jscex-async", ["jscex-builderbase"], function (require, exports, module) {
            module.exports.init = function (root) {
                if (!root.modules["builderbase"]) {
                    require("jscex-builderbase").init(root);
                }
                
                init(root);
            };
        });
    } else if (isAmd) {
        define("jscex-async", ["jscex-builderbase"], function (builderBase) {
            return {
                init: function (root) {
                    if (!root.modules["builderbase"]) {
                        builderBase.init(root);
                    }
                    
                    init(root);
                }
            };
        });
    } else {
        if (typeof Jscex === "undefined") {
            throw new Error('Missing the root object, please load "jscex" module first.');
        }
    
        if (!Jscex.modules["builderbase"]) {
            throw new Error('Missing essential components, please initialize "builderbase" module first.');
        }
    
        init(Jscex);
    }

})();

(function () {
    "use strict";

    var Jscex;

    var CanceledErrorTypeID = "670a1076-712b-4edd-9b70-64b152fe1cd9";
    var isCanceledError = function (ex) { return ex._typeId == CanceledErrorTypeID; }
    var CanceledError = function () { }
    CanceledError.prototype = {
        isTypeOf: isCanceledError,
        _typeId: CanceledErrorTypeID,
        message: "The task has been cancelled."
    }

    var Fn = Function, global = Fn('return this')();
    
    // seed defined in global
    if (global.__jscex__async__taskIdSeed === undefined) {
        global.__jscex__async__taskIdSeed = 0;
    }

    var isTask = function (t) {
        return (typeof t.start === "function") && (typeof t.addEventListener) === "function" && (typeof t.removeEventListener) === "function" && (typeof t.complete) === "function";
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
                    Jscex.logger.warn("[WARNING] Cancellation handler threw an error: " + ex);
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

                if (isCanceledError(value)) {
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
                Jscex.logger.warn("[WARNING] An unhandled error occurred: " + this.error);
            }
        },

        _notify: function (ev, listeners) {
            if (!listeners) {
                return;
            }

            for (var i = 0; i < listeners.length; i++) {
                listeners[i].call(this);
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
    
    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommonJS AMD
    var isAmd = !!(typeof require === "function" && typeof define === "function" && define.amd);

    var defineModule = function () {
        Jscex.define({
            name: "async",
            version: "0.6.5",
            exports: isCommonJS && module.exports,
            require: isCommonJS && require,
            autoloads: [ "builderbase" ],
            dependencies: { builderbase: "~0.6.5" },
            init: function () {
                
                Jscex._.each(Jscex.BuilderBase.prototype, function (m, fn) {
                    AsyncBuilder.prototype[m] = fn;
                });
            
                if (!Jscex.Async) {
                    Jscex.Async = {};
                }
                
                var Async = Jscex.Async;
                Async.CancellationToken = CancellationToken;
                Async.CanceledError = CanceledError;
                Async.Task = Task;
                Async.AsyncBuilder = AsyncBuilder;
            
                Jscex.binders["async"] = "$await";
                Jscex.builders["async"] = new AsyncBuilder();
            }
        });
    }

    if (isCommonJS) {
        try {
            Jscex = require("./jscex");
        } catch (ex) {
            Jscex = require("jscex");
        }
        
        defineModule();
    } else if (isAmd) {
        require("jscex", function (jscex) {
            Jscex = jscex;
            defineModule();
        });
    } else {
        if (!global.Jscex) {
            throw new Error('Missing the root object, please load "jscex" component first.');
        }
        
        Jscex = global.Jscex;
        defineModule();
    }
})();

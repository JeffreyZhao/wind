(function () {
    "use strict";

    var Wind, _;
    
    var Async = { };
    
    /***********************************************************************
      Errors
     ***********************************************************************/

    var CanceledErrorTypeID = "670a1076-712b-4edd-9b70-64b152fe1cd9";
    var isCanceledError = function (ex) { return ex._typeId == CanceledErrorTypeID; }
    var CanceledError = Async.CanceledError = function () { }
    CanceledError.prototype = {
        isTypeOf: isCanceledError,
        _typeId: CanceledErrorTypeID,
        message: "The task has been cancelled."
    }
    
    var AggregateErrorTypeID = "4a73efb8-c2e2-4305-a05c-72385288650a";
    var AggregateError = Async.AggregateError = function (errors) {
        this.children = [];
        
        if (errors) {
            for (var i = 0; i < errors.length; i++) {
                this.children.push(errors[i]);
            }
        }
    }
    AggregateError.prototype = {
        _typeId: AggregateErrorTypeID,
        message: "This is an error contains sub-errors, please check the 'children' collection for more details.",
        isTypeOf: function (ex) {
            return ex._typeId == AggregateErrorTypeID;
        }
    }

    /***********************************************************************
      CancellationToken
     ***********************************************************************/
    
    var CancellationToken = Async.CancellationToken = function () { }
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
                    Wind.logger.warn("[WARNING] Cancellation handler threw an error: " + ex);
                }
            }
        },

        throwIfCancellationRequested: function () {
            if (this.isCancellationRequested) {
                throw new CanceledError();
            }
        }
    };

    /***********************************************************************
      Task when helpers
     ***********************************************************************/
    
    var Task = Async.Task = function (delegate) {
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
                Wind.logger.warn("[WARNING] An unhandled error occurred: " + this.error);
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
        },
        
        then: function (nextGenerator) {
            var firstTask = this;
            
            return Task.create(function (t) {
                
                var nextOnComplete = function () {
                    if (this.error) {
                        t.complete("failure", this.error);
                    } else {
                        t.complete("success", this.result);
                    }
                };
                
                var processNext = function (nextTask) {
                    if (nextTask.status == "ready") {
                        nextTask.start();
                    }
                
                    if (nextTask.status == "running") {
                        nextTask.addEventListener("complete", nextOnComplete);
                    } else {
                        nextOnComplete.call(nextTask);
                    }
                };
                
                var firstOnComplete = function () {
                    if (this.error) {
                        return t.complete("failure", this.error);
                    }
                    
                    var nextTask;
                    try {
                        nextTask = nextGenerator(this.result);
                    } catch (ex) {
                        return t.complete("failure", ex);
                    }
                    
                    processNext(nextTask);
                };
                
                if (firstTask.status == "ready") {
                    firstTask.start();
                }
                
                if (firstTask.status == "running") {
                    firstTask.addEventListener("complete", firstOnComplete);
                } else {
                    firstOnComplete.call(firstTask);
                }
            });
        }
    };
    
    var isTask = Task.isTask = function (t) {
        return t && (typeof t.start === "function") && (typeof t.addEventListener) === "function" && (typeof t.removeEventListener) === "function" && (typeof t.complete) === "function";
    };
    
    var create = Task.create = function (delegate) {
        return new Task(delegate);
    }
    
    var whenAll = Task.whenAll = function () {
        var inputTasks;

        if (arguments.length == 1) {
            var arg = arguments[0];
            if (isTask(arg)) { // a single task
                inputTasks = [arg];
            } else {
                inputTasks = arg;
            }
        } else {
            inputTasks = new Array(arguments.length);
            for (var i = 0; i < arguments.length; i++) {
                inputTasks[i] = arguments[i];
            }
        }
    
        return create(function (taskWhenAll) {

            var done = function () {
                var results = _.isArray(inputTasks) ? new Array(inputTasks.length) : { };
                var errors = [];

                _.each(inputTasks, function (key, task) {
                    if (task.error) {
                        errors.push(task.error);
                    } else {
                        results[key] = task.result;
                    }
                });

                if (errors.length > 0) {
                    taskWhenAll.complete("failure", new AggregateError(errors));
                } else {
                    taskWhenAll.complete("success", results);
                }
            }

            var runningNumber = 0;

            _.each(inputTasks, function (key, task) {
                if (!task) return;
                
                if (!isTask(task)) {
                    inputTasks[key] = task = whenAll(task);
                }
                
                if (task.status === "ready") {
                    task.start();
                }
                
                if (task.status === "running") {
                    runningNumber++;
                    task.addEventListener("complete", function () {
                        if (--runningNumber == 0) {
                            done();
                        }
                    });
                }
            });

            if (runningNumber == 0) {
                done();
            }
        });
    };
    
    var whenAny = Task.whenAny = function () {

        var inputTasks = { };
        var isArray = true;

        if (arguments.length == 1) {
            var arg = arguments[0];
            if (isTask(arg)) {
                inputTasks[0] = arg;
            } else {
                isArray = _.isArray(arg);
                _.each(arg, function (key, task) {
                    if (isTask(task)) {
                        inputTasks[key] = task;
                    }
                });
            }
        } else {
            for (var i = 0; i < arguments.length; i++) {
                var task = arguments[i];
                if (isTask(task)) {
                    inputTasks[i] = task;
                }
            }
        }
        
        var processKey = isArray
            ? function (key) { return parseInt(key, 10); }
            : function (key) { return key; }
        
        return create(function (taskWhenAny) {
            if (_.isEmpty(inputTasks)) {
                return taskWhenAny.complete("failure", "There's no valid input tasks.");
            }
            
            _.each(inputTasks, function (key, task) {
                if (task.status == "ready") {
                    task.start();
                }
            });
            
            var result = _.each(inputTasks, function (key, task) {
                if (task.status !== "running") {
                    return { key: processKey(key), task: task };
                }
            });
            
            if (result) {
                return taskWhenAny.complete("success", result);
            }
            
            var onComplete = function () {
                var taskCompleted = this;
                _.each(inputTasks, function (key, task) {
                    if (task == taskCompleted) {
                        taskWhenAny.complete("success", { key: processKey(key), task: task });
                    } else {
                        task.removeEventListener("complete", onComplete);
                    }
                });
            }
            
            _.each(inputTasks, function (task) {
                task.addEventListener("complete", onComplete);
            });
        });
    }

    /***********************************************************************
      Async helpers
     ***********************************************************************/
    
    var sleep = Async.sleep = function (delay, /* CancellationToken */ ct) {
        return Task.create(function (t) {
            if (ct && ct.isCancellationRequested) {
                t.complete("failure", new CanceledError());
            }

            var seed;
            var cancelHandler;
            
            if (ct) {
                cancelHandler = function () {
                    clearTimeout(seed);
                    t.complete("failure", new CanceledError());
                }
            }
            
            var seed = setTimeout(function () {
                if (ct) {
                    ct.unregister(cancelHandler);
                }
                
                t.complete("success");
            }, delay);
            
            if (ct) {
                ct.register(cancelHandler);
            }
        });
    }
    
    var onEvent = Async.onEvent = function (target, eventName, /* CancellationToken*/ ct) {
        return Task.create(function (t) {
            if (ct && ct.isCancellationRequested) {
                t.complete("failure", new CanceledError());
            }

            var cleanUp = function () {
                if (target.removeEventListener) {
                    target.removeEventListener(eventName, eventHandler);
                } else if (target.removeListener) {
                    target.removeListener(eventName, eventHandler);
                } else {
                    target.detachEvent(eventName, eventHandler);
                }
            }
            
            var eventHandler;
            var cancelHandler;

            if (ct) {
                cancelHandler = function () {
                    cleanUp();
                    t.complete("failure", new CanceledError());
                }
            }
            
            var eventHandler = function (ev) {
                if (ct) {
                    ct.unregister(cancelHandler);
                }
                
                cleanUp();
                t.complete("success", ev);
            }
            
            if (target.addEventListener) {
                target.addEventListener(eventName, eventHandler);
            } else if (target.addListener) {
                target.addListener(eventName, eventHandler);
            } else {
                target.attachEvent(eventName, eventHandler);
            }
            
            if (ct) {
                ct.register(cancelHandler);
            }
        });
    }
    
    /***********************************************************************
      AsyncBuilder
     ***********************************************************************/
    
    var AsyncBuilder = Async.AsyncBuilder = function () { }
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
    
    var Binding = Async.Binding = { };
    
    var collectArgs = function (args, requiredArgs) {
        var result = [];
        for (var i = 0; i < args.length; i++) {
            result.push(args[i]);
        }

        while (result.length < requiredArgs) {
            result.push(undefined);
        }

        return result;
    }
    
    var collectCallbackArgNames = function (args) {
        if (args.length <= 1) return null;
        
        var result = [];
        for (var i = 1; i < args.length; i++) {
            result.push(args[i]);
        }
        
        return result;
    }
    
    var fromStandard = Binding.fromStandard = function (fn) {
        var callbackArgNames = collectCallbackArgNames(arguments);
    
        return function () {
            var _this = this;
            var args = collectArgs(arguments, fn.length - 1);

            return Task.create(function (t) {
                args.push(function (error, result) {
                    if (error) {
                        t.complete("failure", error);
                    } else if (!callbackArgNames) {
                        t.complete("success", result);
                    } else {
                        var data = {};
                        for (var i = 0; i < callbackArgNames.length; i++) {
                            data[callbackArgNames[i]] = arguments[i + 1];
                        }
                        
                        return t.complete("success", data);
                    }
                });
                
                fn.apply(_this, args);
            });
        };
    };
    
    var fromCallback = Binding.fromCallback = function (fn) {
        var callbackArgNames = collectCallbackArgNames(arguments);
    
        return function () {
            var _this = this;
            var args = collectArgs(arguments, fn.length - 1);

            return Task.create(function (t) {
                args.push(function (result) {
                    if (callbackArgNames) {
                        var data = {};
                        for (var i = 0; i < callbackArgNames.length; i++) {
                            data[callbackArgNames[i]] = arguments[i];
                        }
                        
                        t.complete("success", data);
                    } else {
                        t.complete("success", result);
                    }
                });
                
                fn.apply(_this, args);
            });
        };
    };
    
    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommonJS AMD
    var isAmd = !!(typeof require === "function" && typeof define === "function" && define.amd);

    var defineModule = function () {
        Wind.define({
            name: "async",
            version: "0.7.0",
            require: isCommonJS && require,
            autoloads: [ "builderbase" ],
            dependencies: { builderbase: "~0.7.0" },
            init: function () {
                
                _ = Wind._;
                
                _.each(Wind.BuilderBase.prototype, function (m, fn) {
                    AsyncBuilder.prototype[m] = fn;
                });
                
                Wind.Async = Async;
            
                Wind.binders["async"] = "$await";
                Wind.builders["async"] = new AsyncBuilder();
            }
        });
    }

    if (isCommonJS) {
        try {
            Wind = require("./wind-core");
        } catch (ex) {
            Wind = require("wind-core");
        }
        
        defineModule();
    } else if (isAmd) {
        require(["wind-core"], function (wind) {
            Wind = wind;
            defineModule();
        });
    } else {
        var Fn = Function, global = Fn('return this')();
    
        if (!global.Wind) {
            throw new Error('Missing the root object, please load "wind" component first.');
        }
        
        Wind = global.Wind;
        defineModule();
    }
})();

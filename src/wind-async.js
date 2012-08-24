(function () {
    "use strict";

    var supportDefineProperty = (function () {
        var i = 0;
        var getter = function () {
            if (i === 0) {
                throw new Error("Execute too soon.");
            }
            
            return i;
        };

        var obj = {};
        
        try {
            Object.defineProperty(obj, "value", { get: getter });
            
            i = 1;
            return obj.value === 1;
        } catch (ex) {
            return false;
        }
    })();
    
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
                    Wind.logger.warn("Cancellation handler threw an error: " + ex);
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
      Task
     ***********************************************************************/
    
    var EventManager = function () {
        this._listeners = {};
        this._firing = null;
    }
    EventManager.prototype = {
        add: function (name, listener) {
            if (this._firing === name) {
                var self = this;
                setTimeout(function () {
                    self.add(name, listener);
                }, 0);
                
                return;
            }
        
            var eventListeners = this._listeners[name];
            if (!eventListeners) {
                eventListeners = this._listeners[name] = [];
            }

            eventListeners.push(listener);
        },
        
        remove: function (name, listener) {
            if (this._firing === name) {
                var self = this;
                setTimeout(function () {
                    self.remove(name, listener);
                }, 0);
                
                return;
            }
        
            var eventListeners = this._listeners[name];
            if (!eventListeners) return;
            
            var index = eventListeners.indexOf(listener);
            if (index >= 0) {
                eventListeners.splice(index, 1);
            }
        },
        
        fire: function (name, self, args) {
            var listeners = this._listeners[name];
            if (!listeners) return;
            
            this._firing = name;

            for (var i = 0; i < listeners.length; i++) {
                try {
                    listeners[i].call(self, args);
                } catch (ex) {
                    Wind.logger.warn('An error occurred in "' + name + ' listener": ' + ex);
                }
            }
            
            this._firing = null;
        }
    };
    
    var taskEventManager = new EventManager();
    
    var Task = Async.Task = function (delegate) {
        this._delegate = delegate;
        this._eventManager = new EventManager();
        this.status = "ready";
    }
    Task.prototype = {
        start: function () {
            if (this.status != "ready") {
                throw new Error('Task can only be started in "ready" status.');
            }

            this.status = "running";
            
            try {
                this._delegate(this);
            } catch (ex) {
                if (this.status == "running") {
                    this.complete("failure", ex);
                } else {
                    Wind.logger.warn("An unexpected error occurred after the task is completed: " + ex);
                }
            }
            
            return this;
        },
        
        complete: function (type, value) {
            if (type !== "success" && type !== "failure") {
                throw new Error("Unsupported type: " + type);
            }
            
            if (this.status != "running") {
                throw new Error('The "complete" method can only be called in "running" status.');
            }

            var eventManager = this._eventManager;
            this._eventManager = null;
            
            if (type === "success") {
                this.status = "succeeded";
                
                if (supportDefineProperty) {
                    this._result = value;
                } else {
                    this.result = value;
                }

                eventManager.fire("success", this);
            } else {
                if (isCanceledError(value)) {
                    this.status = "canceled";
                } else {
                    this.status = "faulted";
                }
                
                if (supportDefineProperty) {
                    this._error = value;
                } else {
                    this.error = value;
                }
                
                eventManager.fire("failure", this);
            }
            
            eventManager.fire("complete", this);
            
            if (type !== "failure") return;
            if (!supportDefineProperty) return;
            if (this._errorObserved) return;
            
            var self = this;
            this._unobservedTimeoutToken = setTimeout(function () {
                self._handleUnobservedError(value);
            }, Task.unobservedTimeout);
        },
        
        observeError: function () {
            if (!supportDefineProperty) return this.error;
        
            var token = this._unobservedTimeoutToken;
            if (token) {
                clearTimeout(token);
                this._unobservedTimeoutToken = null;
            }
            
            this._errorObserved = true;
            return this._error;
        },
        
        _handleUnobservedError: function (error) {
            this._unobservedTimeoutToken = null;

            var args = {
                task: this,
                error: error,
                observed: false
            };
            
            taskEventManager.fire("unobservedError", Task, args);
            
            if (!args.observed) {
                throw error;
            }
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
                        nextTask.on("complete", nextOnComplete);
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
                    firstTask.on("complete", firstOnComplete);
                } else {
                    firstOnComplete.call(firstTask);
                }
            });
        }
    };
    
    Task.prototype.on = Task.prototype.addEventListener = function () {
        var eventManager = this._eventManager;
        if (!eventManager) {
            throw new Error("Cannot add event listeners when the task is complete.");
        }
        
        eventManager.add.apply(eventManager, arguments);
    };
    
    Task.prototype.off = Task.prototype.removeEventListener = function () {
        var eventManager = this._eventManager;
        if (!eventManager) {
            throw new Error("All the event listeners have been removed when the task was complete.");
        }
        
        eventManager.remove.apply(eventManager, arguments);
    };
    
    if (supportDefineProperty) {
        Object.defineProperty(Task.prototype, "error", {
            get: function () {
                return this.observeError();
            }
        });
        
        Object.defineProperty(Task.prototype, "result", {
            get: function () {
                var error = this.observeError();
                if (error) throw error;
                
                return this._result;
            }
        });
    }
    
    var observeErrorListener = function () { this.observeError(); };
    
    Task.on = Task.addEventListener = function () {
        taskEventManager.add.apply(taskEventManager, arguments);
    }
    
    Task.off = Task.removeEventListener = function (name, listener) {
        taskEventManager.remove.apply(taskEventManager, arguments);
    }
    
    Task.unobservedTimeout = 10 * 1000;
    
    var isTask = Task.isTask = function (t) {
        return t && (typeof t.start === "function") && (typeof t.addEventListener) === "function" && (typeof t.removeEventListener) === "function" && (typeof t.complete) === "function";
    };
    
    var create = Task.create = function (delegate) {
        return new Task(delegate);
    }
    
    /***********************************************************************
      Task helpers
     ***********************************************************************/
    
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

            var errors;
            
            var done = function () {
                if (errors) {
                    taskWhenAll.complete("failure", new AggregateError(errors));
                } else {
                    var results = _.map(inputTasks, function (t) {
                        return t.result;
                    });
                    
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
                        if (this.status !== "succeeded") {
                            if (!errors) errors = [];
                            errors.push(this.error);
                        }

                        if (--runningNumber == 0) {
                            done();
                        }
                    });
                } else if (task.status === "faulted" || task.status === "canceled") {
                    if (!errors) errors = [];
                    errors.push(task.error);
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
            
            var result;
            
            _.each(inputTasks, function (key, task) {
                if (task.status === "ready") {
                    task.start();
                }
                
                if (task.status !== "running") {
                    task.observeError();
                    
                    if (!result) {
                        result = { key: processKey(key), task: task };
                    }
                }
            });
            
            if (result) {
                _.each(inputTasks, function (key, task) {
                    if (task.status === "running") {
                        task.on("failure", observeErrorListener);
                    }
                });

                return taskWhenAny.complete("success", result);
            }
            
            var onComplete = function () {
                this.observeError();
                
                var taskCompleted = this;
                var keyCompleted;
                
                _.each(inputTasks, function (key, task) {
                    if (taskCompleted === task) {
                        keyCompleted = key;
                        return;
                    }

                    task.off("complete", onComplete);
                    task.on("failure", observeErrorListener);
                });

                taskWhenAny.complete("success", { key: processKey(keyCompleted), task: this });
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
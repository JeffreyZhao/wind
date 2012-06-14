(function () {
    "use strict";

    var Jscex;
    var Task;
    var CanceledError;

    var isArray = function (array) {
        return Object.prototype.toString.call(array) === '[object Array]';
    };
    
    var collectCallbackArgNames = function (args) {
        if (args.length <= 1) return null;
        
        var result = [];
        for (var i = 1; i < args.length; i++) {
            result.push(args[i]);
        }
        
        return result;
    }

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
    
    // Async members

    var AggregateErrorTypeID = "4a73efb8-c2e2-4305-a05c-72385288650a";
    var AggregateError = function (errors) {
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

    var sleep = function (delay, /* CancellationToken */ ct) {
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
    
    var onEvent = function (target, eventName, /* CancellationToken*/ ct) {
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

    // Task members
    
    var whenAll = function () {
        var inputTasks;

        if (arguments.length == 1) {
            var arg = arguments[0];

        if (Task.isTask(arg)) { // a single task
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
    
        return Task.create(function (taskWhenAll) {
            var taskKeys = {};
    
            for (var key in inputTasks) {
                if (!inputTasks.hasOwnProperty(key)) continue;
    
                var t = inputTasks[key];
                if (!t) continue;
    
                if (!Task.isTask(t)) {
                    inputTasks[key] = t = Task.whenAll(t);
                }

                taskKeys[t.id] = key;
            }

            // start all the tasks
            for (var id in taskKeys) {
                if (!taskKeys.hasOwnProperty(id)) continue;

                var t = inputTasks[taskKeys[id]];
                if (t.status == "ready") {
                    t.start();
                }
            }

            var done = function () {

                var results = isArray(inputTasks) ? new Array(inputTasks.length) : { };
                var errors = [];

                for (var id in taskKeys) {
                    if (!taskKeys.hasOwnProperty(id)) continue;

                    var key = taskKeys[id];
                    var t = inputTasks[key];

                    if (t.error) {
                        errors.push(t.error);
                    } else {
                        results[key] = t.result;
                    }
                }

                if (errors.length > 0) {
                    taskWhenAll.complete("failure", new AggregateError(errors));
                } else {
                    taskWhenAll.complete("success", results);
                }
            }

            var runningNumber = 0;
            
            for (var id in taskKeys) {
                if (!taskKeys.hasOwnProperty(id)) continue;

                var key = taskKeys[id]
                var t = inputTasks[key];

                if (t.status == "running") {
                    runningNumber++;

                    t.addEventListener("complete", function () {
                        if (--runningNumber == 0) {
                            done();
                        }
                    });
                }
            }

            if (runningNumber == 0) {
                done();
            }
        });
    };
    
    var whenAny = function () {
    
        var tasks = { };

        if (arguments.length == 1) {
            var arg = arguments[0];
            if (Task.isTask(arg)) {
                tasks[0] = arg;
            } else {
                tasks = arg;
            }
        } else {
            for (var i = 0; i < arguments.length; i++)
                tasks[i] = arguments[i];
        }
        
        return Task.create(function (taskWhenAny) {
            var taskKeys = {};
            for (var key in tasks) {
                if (tasks.hasOwnProperty(key)) {
                    var t = tasks[key];
                    if (Task.isTask(t)) {
                        taskKeys[t.id] = key;
                    }
                }
            }
        
            // start all the tasks
            for (var id in taskKeys) {
                var t = tasks[taskKeys[id]];
                if (t.status == "ready") {
                    t.start();
                }
            }
            
            // if there's a task already failed/succeeded, then return
            for (var id in taskKeys) {
                var key = taskKeys[id];
                var t = tasks[key];
                if (t.error || t.status == "succeeded") {
                    taskWhenAny.complete("success", { key: key, task: t });
                    return;
                }
            }
            
            var onComplete = function (t) {
                for (var id in taskKeys) {
                    tasks[taskKeys[id]].removeEventListener("complete", onComplete);
                }
            
                taskWhenAny.complete("success", { key: taskKeys[this.id], task: this });
            }
            
            // now all the tasks are in "running" status.
            for (var id in taskKeys) {
                tasks[taskKeys[id]].addEventListener("complete", onComplete);
            }
        });
    }
    
    var then = function (nextGenerator) {
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
    };
    
    // Binding members
    
    var fromStandard = function (fn) {
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
    
    var fromCallback = function (fn) {
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
        Jscex.define({
            name: "async-powerpack",
            version: "0.6.5",
            exports: isCommonJS && module.exports,
            require: isCommonJS && require,
            dependencies: { async: "~0.6.5" },
            init: function () {
                
                Task = Jscex.Async.Task;
                CanceledError = Jscex.Async.CanceledError;
                
                var Async = Jscex.Async;
                Async.sleep = sleep;
                Async.onEvent = onEvent;
                Async.AggregateError = AggregateError;
            
                Task.whenAll = whenAll;
                Task.whenAny = whenAny;
                Task.prototype.then = Task.prototype.continueWith = then;
            
                if (!Async.Binding) {
                    Async.Binding = {};
                }
                
                var Binding = Async.Binding;
                Async.Jscexify = Binding;
                
                Binding.fromStandard = fromStandard;
                Binding.fromCallback = fromCallback;
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
        var Fn = Function, global = Fn('return this')();
        if (!global.Jscex) {
            throw new Error('Missing the root object, please load "jscex" component first.');
        }
        
        Jscex = global.Jscex;
        defineModule();
    }
})();
(function () {

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

    var init = function (root) {
        if (root.modules["async-powerpack"]) {
            return;
        }
        
        if (!root.modules["async"]) {
            throw new Error('Missing essential components, please initialize "jscex-async" module first.');
        }
        
        var Async = root.Async;
        var Task = Async.Task;
        var CanceledError = Async.CanceledError;
        
        // Async members
        Async.sleep = function (delay, /* CancellationToken */ ct) {
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
        
        Async.onEvent = function (target, eventName, /* CancellationToken*/ ct) {
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
        Task.whenAll = function () {
            
            var tasks = { };
            var isTaskArray;

            if (arguments.length == 1) {
                var arg = arguments[0];
                if (Task.isTask(arg)) {
                    tasks[0] = arg;
                    isTaskArray = true;
                } else {
                    tasks = arg;
                    isTaskArray = isArray(tasks);
                }
            } else {
                for (var i = 0; i < arguments.length; i++)
                    tasks[i] = arguments[i];
                isTaskArray = true;
            }
            
            return Task.create(function (taskWhenAll) {
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
                
                // if there's a task already failed, then failed
                for (var id in taskKeys) {
                    var t = tasks[taskKeys[id]];
                    if (t.error) {
                        taskWhenAll.complete("failure", t.error);
                        return;
                    }
                }
                
                var results = isTaskArray ? [] : {};

                var onComplete = function () {
                    if (this.error) {
                        for (var id in taskKeys) {
                            tasks[taskKeys[id]].removeEventListener("complete", onComplete);
                        }

                        taskWhenAll.complete("failure", this.error);
                    } else {
                        var key = taskKeys[this.id];
                        results[key] = this.result;
                        
                        delete taskKeys[this.id];
                        
                        runningNumber--;

                        if (runningNumber == 0) {
                            taskWhenAll.complete("success", results);
                        }
                    }
                }
                
                var runningNumber = 0;
                
                // now all the tasks should be "succeeded" or "running"
                for (var id in taskKeys) {
                    var key = taskKeys[id]
                    var t = tasks[key];
                    if (t.status == "succeeded") {
                        results[key] = t.result;
                        delete taskKeys[t.id];
                    } else { // running
                        runningNumber++;
                        t.addEventListener("complete", onComplete);
                    }
                }
                
                if (runningNumber == 0) {
                    taskWhenAll.complete("success", results);
                }
            });
        }
        
        Task.whenAny = function () {
        
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
        
        // Jscexify members
        if (!Async.Jscexify) {
            Async.Jscexify = { };
        }
        
        var Jscexify = Async.Jscexify;
        
        // for the methods return error and results
        Jscexify.fromStandard = function (fn) {
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
        
        Task.prototype.then = Task.prototype.continueWith = function (nextGenerator) {
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
        
        // for the methods always success
        Jscexify.fromCallback = function (fn) {
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
        
        root.modules["async-powerpack"] = true;
    }
    
    // CommonJS
    var isCommonJS = (typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommongJS Wrapping
    var isWrapping = (typeof define === "function" && !define.amd);
    // CommonJS AMD
    var isAmd = (typeof require === "function" && typeof define === "function" && define.amd);
    
    if (isCommonJS) {
        module.exports.init = init;
    } else if (isWrapping) {
        define("jscex-async-powerpack", ["jscex-async"], function (require, exports, module) {
            module.exports.init = init;
        });
    } else if (isAmd) {
        define("jscex-async-powerpack", ["jscex-async"], function () {
            return { init: init };
        });
    } else {
        if (typeof Jscex === "undefined") {
            throw new Error('Missing the root object, please load "jscex" module first.');
        }
    
        init(Jscex);
    }
})();

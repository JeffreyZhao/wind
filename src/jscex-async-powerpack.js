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
        if (root.modules && root.modules["async-powerpack"]) {
            return;
        }
        
        if (!root.modules || !root.modules["async"]) {
            throw new Error('Missing essential component, please initialize "jscex-async" module first.');
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
            
            var tasks;
            var isTaskArray = false;

            if (arguments.length == 1) {
                var arg = arguments[0];
                if (Task.isTask(arg)) {
                    return arg;
                } else {
                    tasks = arg;
                    isTaskArray = isArray(tasks);
                }
            } else {
                tasks = [];
                for (var i = 0; i < arguments.length; i++)
                    tasks.push(arguments[i]);
                isTaskArray = true;
            }
            
            return Task.create(function (taskWhenAll) {
                var taskKeys = {};
                if (isTaskArray) {
                    for (var i = 0; i < tasks.length; i++) {
                        taskKeys[tasks[i].id] = i;
                    }
                } else {
                    for (var key in tasks) {
                        taskKeys[tasks[key].id] = key;
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

                var onComplete = function (t) {
                    if (t.error) {
                        for (var id in taskKeys) {
                            tasks[taskKeys[id]].removeEventListener("complete", onComplete);
                        }

                        taskWhenAll.complete("failure", t.error);
                    } else {
                        results[taskKeys[t.id]] = t.result;
                        delete taskKeys[t.id];
                        
                        runningNumber--;

                        if (runningNumber == 0) {
                            taskWhenAll.complete("success", results);
                        }
                    }
                }
                
                var runningNumber = 0;
                
                // now all the tasks should be "succeeded" or "running"
                for (var id in taskKeys) {
                    var t = tasks[taskKeys[id]];
                    if (t.status == "succeeded") {
                        results[taskKeys[id]] = t.result;
                        delete taskKeys[id];
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
        
            var tasks;
            var isTaskArray = false;

            if (arguments.length == 1) {
                var arg = arguments[0];
                if (Task.isTask(arg)) {
                    return arg;
                } else {
                    tasks = arg;
                    isTaskArray = isArray(tasks);
                }
            } else {
                tasks = [];
                for (var i = 0; i < arguments.length; i++)
                    tasks.push(arguments[i]);
                isTaskArray = true;
            }
            
            return Task.create(function (taskWhenAny) {
                var taskKeys = {};
                if (isTaskArray) {
                    for (var i = 0; i < tasks.length; i++) {
                        taskKeys[tasks[i].id] = i;
                    }
                } else {
                    for (var key in tasks) {
                        taskKeys[tasks[key].id] = key;
                    }
                }
                
                var onComplete = function (t) {
                    for (var id in taskKeys) {
                        tasks[taskKeys[id]].removeEventListener("complete", onComplete);
                    }
                
                    if (isTaskArray) {
                        taskWhenAny.complete("success", { index: taskKeys[t.id], task: t });
                    } else {
                        taskWhenAny.complete("success", { key: taskKeys[t.id], task: t });
                    }
                }
                
                for (var id in taskKeys) {
                    var t = tasks[taskKeys[id]];
                    switch (t.status) {
                        case "ready":
                            t.addEventListener("complete", onComplete);
                            t.start();
                            break;
                        case "running":
                            t.addEventListener("complete", onComplete);
                            break;
                        default:
                            onComplete(t);
                            break;
                    }
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
    
    var isCommonJS = (typeof require !== "undefined" && typeof module !== "undefined" && module.exports);
    
    if (isCommonJS) {
        module.exports.init = init;
    } else {
        init(Jscex);
    }
})();

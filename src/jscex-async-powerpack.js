(function () {

    var isArray = function (array) {
        return Object.prototype.toString.call(array) === '[object Array]';
    };

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

                var eventHandler;
                var cancelHandler;

                if (ct) {
                    cancelHandler = function () {
                        if (target.removeEventListener) {
                            target.removeEventListener(eventName, eventHandler);
                        } else if (target.removeListener) {
                            target.removeListener(eventName, eventHandler);
                        } else {
                            target.detachEvent(eventName, eventHandler);
                        }

                        t.complete("failure", new CanceledError());
                    }
                }
                
                var eventHandler = function (ev) {
                    if (ct) {
                        ct.unregister(cancelHandler);
                    }

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
                
                // if there's a task already failed
                for (var id in taskKeys) {
                    var t = tasks[taskKeys[id]];
                    if (t.error) {
                        taskWhenAll.complete("failure", t.error);
                        return;
                    }
                }

                var results = isTaskArray ? [] : {};
                var runningNumber = 1; // set the original as 1

                var onComplete = function (t) {
                    if (t.error) {
                        for (var id in taskKeys) {
                            tasks[taskKeys[id]].removeEventListener("complete", onComplete);
                        }

                        taskWhenAll.complete("failure", t.error);
                    } else {
                        results[taskKeys[t.id]] = t.result;
                        runningNumber--;

                        if (runningNumber == 0) {
                            taskWhenAll.complete("success", results);
                        }
                    }
                }

                for (var id in taskKeys) {
                    runningNumber++;
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
                
                // all completed
                if (runningNumber == 1) {
                    taskWhenAll.complete("success", results);
                } else {
                    runningNumber--;
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
                        taskWhenAny.complete("success", { name: taskKeys[t.id], task: t });
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
        
        root.modules["async-powerpack"] = true;
    }
    
    var isCommonJS = (typeof require !== "undefined" && typeof module !== "undefined" && module.exports);
    
    if (isCommonJS) {
        module.exports.init = init;
    } else {
        init(Jscex);
    }
})();

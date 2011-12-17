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
                } else {
                    target.attachEvent(eventName, eventHandler);
                }
                
                if (ct) {
                    ct.register(cancelHandler);
                }
            });
        }
        
        Task.whenAll = function (tasks) {
            
            if (!isArray(tasks)) {
                tasks = arguments;
            }
            
            return Task.create(function (taskWhenAll) {
                var taskIndexes = { };
                var runningTasks = [];
                for (var i = 0; i < tasks.length; i++) {
                    taskIndexes[tasks[i].id] = i;
                    runningTasks.push(t);
                }

                var results = [];

                var taskCompleted = function (t) {
                    if (t.error) {
                        for (var i = 0; i < runningTasks.length; i++) {
                            runningTasks[i].removeEventListener("complete", taskCompleted);
                        }

                        taskWhenAll.complete("failure", t.error);
                    } else {
                        results[taskIndexes[t.id]] = t.result;

                        var index = runningTasks.indexOf(t);
                        runningTasks.splice(index, 1);

                        if (runningTasks.length == 0) {
                            finished = true;
                            taskWhenAll.complete("success", results);
                        }
                    }
                }

                for (var i = 0; i < tasks.length; i++) {
                    var t = tasks[i];
                    switch (t.status) {
                        case "ready":
                            t.addEventListener("complete", taskCompleted);
                            t.start();
                            break;
                        case "running":
                            t.addEventListener("complete", taskCompleted);
                            break;
                        default:
                            taskCompleted(t);
                            break;
                    }
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
                tasks = arguments;
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

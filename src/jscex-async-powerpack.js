(function () {

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
				if (ct) {
                    ct.throwIfCancellationRequested();
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
            
			if (Object.prototype.toString.call(tasks) !== '[object Array]') {
				tasks = arguments;
			}
			
			return Task.create(function (taskWhenAll) {
				var taskIds = { };
                var runningTasks = [];
                for (var i = 0; i < tasks.length; i++) {
                    taskIds[tasks[i].id] = i;
                    runningTasks.push(t);
                }

                var results = [];

                var taskCompleted = function (t) {
                    if (t.error) {
                        for (var i = 0; i < tasksClone.length; i++) {
                            runningTasks[i].removeListener(taskCompleted);
                        }

                        taskWhenAll.complete("failure", t.error);
                    } else {
                        results[taskIds[t.id]] = t.result;

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
        
        root.modules["async-powerpack"] = true;
    }
    
    var isCommonJS = (typeof require !== "undefined" && typeof module !== "undefined" && module.exports);
    
    if (isCommonJS) {
        module.exports.init = init;
    } else {
        init(Jscex);
    }
})();

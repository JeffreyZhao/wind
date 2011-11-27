(function () {

    var Async = Jscex.Async;
    var Task = Async.Task;
    var CanceledError = Async.CanceledError;

    Async.sleep = function (delay, /* CancellationToken */ ct) {
        var delegate = {
            onStart: function (callback) {
                if (ct) {
                    ct.throwIfCancellationRequested();
                }

                var seed = setTimeout(function () { callback("success"); }, delay);
                if (ct) {
                    ct.register(function () {
                        clearTimeout(seed);
                        callback("failure", new CanceledError());
                    });
                }
            }
        };

        return new Task(delegate);
    }

    Async.onEvent = function (ele, ev) {
        var eventName = "on" + ev;

        var delegate = {
            onStart: function (callback) {
                var handler = function (ev) {
                    ele[eventName] = null;
                    callback("success", ev);
                }

                ele[eventName] = handler;
            }
        };

        return new Task(delegate);
    }
    
    Task.waitAll = function (tasks) {
        
        var delegate = {
            onStart: function (callback) {

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

                        callback("failure", t.error);
                    } else {
                        results[taskIds[t.id]] = t.result;

                        var index = tasksClone.indexOf(t);
                        runningTasks.splice(index, 1);

                        if (runningTasks.length == 0) {
                            finished = true;
                            callback("success", results);
                        }
                    }
                }

                for (var i = 0; i < tasks.length; i++) {
                    var t = tasks[i];
                    switch (t.status) {
                        case "ready":
                            t.addListener(taskCompleted);
                            t.start();
                            break;
                        case "running":
                            t.addListener(taskCompleted);
                            break;
                        default:
                            taskCompleted(t);
                            break;
                    }
                }
            }
        };

        return new Task(delegate);
    }
})();

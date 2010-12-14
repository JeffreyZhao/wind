/****************************
 * type Async = {
 *     start: function(function (type, value, target) { ... }) { ... }
 *     cancel: function() { ... }
 * }
 ****************************/

Jscex.AsyncBuilder = function () { }

Jscex.AsyncBuilder.prototype.Bind = function (task, onNormal) {
    return {
        start: function (callback) {
            task.start(function (type, value, target) {
                if (type == "normal") {
                    try {
                        var nextTask = onNormal(value);
                        nextTask.start(callback);
                    } catch (ex) {
                        callback("throw", ex);
                    }
                } else {
                    callback(type, value, target);
                }
            });
        }
    };
};

Jscex.AsyncBuilder.prototype.Loop = function (condition, update, body) {
    return {
        start: function (callback) {
            var loop = function (result, skipUpdate) {
                try {
                    if (update && !skipUpdate) {
                        update();
                    }

                    if (condition()) {
                        body.start(function (type, value, target) {
                            if (type == "throw") {
                                callback("throw", value);
                            } else {
                                loop();
                            }
                        });
                    } else {
                        callback("normal", result);
                    }

                } catch (ex) {
                    callback("throw", ex);
                }
            }
            
            loop(null, true);
        }
    };
}

Jscex.AsyncBuilder.prototype.Delay = function (generator) {
    return {
        start: function (callback) {
            try {
                var task = generator();
                task.start(callback);
            } catch (ex) {
                callback("throw", ex);
            }
        }
    };
};

Jscex.AsyncBuilder.prototype.Combine = function (t1, t2) {
    return {
        start: function (callback) {
            t1.start(function (type, value, target) {
                if (type == "normal") {
                    try {
                        t2.start(callback);
                    } catch (ex) {
                        callback("throw", ex);
                    }
                } else {
                    callback(type, value, target);
                }
            });
        }
    };
}

Jscex.AsyncBuilder.prototype.Return = function (result) {
    return {
        start: function (callback) {
            callback("normal", result);
        }
    };
};

Jscex.AsyncBuilder.prototype.binder = "$await";

var $async = new Jscex.AsyncBuilder();

Jscex.Async = {
    sleep: function (delay) {
        return {
            start: function (callback) {
                setTimeout(
                    function () { callback("normal"); },
                    delay);
            }
        };
    },
    
    startImmediately: function (task) {
        task.start(function () {});
    },
    
    start: function(task) {
        setTimeout(function() {
            Jscex.Async.startImmediately(task);
        }, 0);
    },
    
    // only support "normal"
    parallel: function(tasks) {
        var tasksClone = [];
        for (var i = 0; i < tasks.length; i++) {
            tasksClone.push(tasks[i]);
        }
        
        return {
            start: function (callback) {
                var done = 1;
                var results = [];
                
                var checkFinished = function (index, r) {
                    if (arguments.length > 0) {
                        results[index] = r;
                    }

                    done--;
                    if (done <= 0) {
                        callback("normal", results);
                    }
                }
                
                var callbackFactory = function (index) {
                    return function (type, value, target) {
                        checkFinished(index, value);
                    };
                }
                
                for (var i = 0; i < tasksClone.length; i++) {
                    done++;
                    tasksClone[i].start(callbackFactory(i));
                }
                
                checkFinished();
            }
        };
    },

    onEventAsync: function (ele, ev) {
        return {
            start: function (callback) {
                var eventName = "on" + ev;
                var handler = function(ev) {
                    ele[eventName] = null;
                    callback("normal");
                }

                ele[eventName] = handler;
            }
        };
    }
};


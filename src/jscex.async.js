/****************************
 * type Async = {
 *     start: function(function (type, value, target) { ... }) { ... }
 *     cancel: function() { ... }
 * }
 ****************************/

Jscex.AsyncBuilder = function () { }

Jscex.AsyncBuilder.prototype.Bind = function (task, generator) {
    return {
        start: function (callback) {
            var _this = this;
            task.start.call(_this, function (type, value, target) {
                if (type == "normal" || type == "return") {
                    try {
                        var nextTask = generator.call(_this, value);
                        nextTask.start.call(_this, callback);
                    } catch (ex) {
                        callback("throw", ex);
                    }
                } else if (type == "throw") {
                    callback("throw", value, target);
                } else {
                    throw 'Invalid type for "Bind": ' + type;
                }
            });
        }
    };
};

Jscex.AsyncBuilder.prototype.Loop = function (condition, update, body) {
    return {
        start: function (callback) {
            var _this = this;
            var loop = function (skipUpdate) {
                try {
                    if (update && !skipUpdate) {
                        update.call(_this);
                    }

                    if (condition.call(_this)) {
                        body.start.call(_this, function (type, value, target) {
                            if (type == "normal" || type == "continue") {
                                loop(false);
                            } else if (type == "throw" || type == "return") {
                                callback(type, value);
                            } else if (type == "break") {
                                callback("normal");
                            } else {
                                throw 'Invalid type for "Loop": ' + type;
                            }
                        });
                    } else {
                        callback("normal");
                    }

                } catch (ex) {
                    callback("throw", ex);
                }
            }
            
            loop(true);
        }
    };
}

Jscex.AsyncBuilder.prototype.Start = function (_this, generator) {
    return {
        start: function (callback) {
            try {
                var task = generator.call(_this);
                task.start.call(_this, function (type, value, target) {
                    if (type == "break" || type == "continue") {
                        throw 'Invalid type for "Start": ' + type;
                    } else {
                        callback(type, value, target);
                    }
                });
            } catch (ex) {
                callback("throw", ex);
            }
        }
    };
};

Jscex.AsyncBuilder.prototype.Delay = function (generator) {
    return {
        start: function (callback) {
            var _this = this;
            try {
                var task = generator.call(_this);
                task.start.call(_this, callback);
            } catch (ex) {
                callback("throw", ex);
            }
        }
    };
};

Jscex.AsyncBuilder.prototype.Combine = function (t1, t2) {
    return {
        start: function (callback) {
            var _this = this;
            t1.start.call(_this, function (type, value, target) {
                if (type == "normal") {
                    try {
                        t2.start.call(_this, callback);
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
            callback("return", result);
        }
    };
};

Jscex.AsyncBuilder.prototype.Normal = function () {
    return {
        start: function (callback) {
            callback("normal");
        }
    }
}

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
                        callback("return", results);
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
                    callback("return", ev);
                }

                ele[eventName] = handler;
            }
        };
    }
};


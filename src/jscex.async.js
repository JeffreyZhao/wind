/****************************
 * type Async = {
 *     start: function(function (type, value, target) { ... }) { ... }
 *     cancel: function() { ... }
 * }
 ****************************/

Jscex.AsyncBuilder = function () { }

Jscex.AsyncBuilder.prototype.Bind = function (task, generator) {
    return {
        start: function (_this, callback) {
            task.start(function (type, value, target) {
                if (type == "normal" || type == "return") {
                    try {
                        var nextTask = generator.call(_this, value);
                        nextTask.start(_this, callback);
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

Jscex.AsyncBuilder.prototype.Loop = function (condition, update, body, bodyFirst) {
    return {
        start: function (_this, callback) {
            
            var startBody = function (skipUpdate) {
                body.start(_this, function (type, value, target) {
                    if (type == "normal" || type == "continue") {
                        loop(skipUpdate);
                    } else if (type == "throw" || type == "return") {
                        callback(type, value);
                    } else if (type == "break") {
                        callback("normal");
                    } else {
                        throw 'Invalid type for "Loop": ' + type;
                    }
                });
            }
        
            var loop = function (skipUpdate) {
                try {
                    if (update && !skipUpdate) {
                        update.call(_this);
                    }

                    if (!condition || condition.call(_this)) {
                        startBody(false);
                    } else {
                        callback("normal");
                    }

                } catch (ex) {
                    callback("throw", ex);
                }
            }
            
            if (bodyFirst) {
                startBody(true);
            } else {
                loop(true);
            }
        }
    };
}

Jscex.AsyncBuilder.prototype.Start = function (_this, generator) {
    return {
        start: function (callback) {
            try {
                var task = generator.call(_this);
                task.start(_this, function (type, value, target) {
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
        start: function (_this, callback) {
            try {
                var task = generator.call(_this);
                task.start(_this, callback);
            } catch (ex) {
                callback("throw", ex);
            }
        }
    };
};

Jscex.AsyncBuilder.prototype.Combine = function (t1, t2) {
    return {
        start: function (_this, callback) {
            t1.start(_this, function (type, value, target) {
                if (type == "normal") {
                    try {
                        t2.start(_this, callback);
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
        start: function (_this, callback) {
            callback("return", result);
        }
    };
};

Jscex.AsyncBuilder.prototype.Normal = function () {
    return {
        start: function (_this, callback) {
            callback("normal");
        }
    };
}

Jscex.AsyncBuilder.prototype.Break = function () {
    return {
        start: function (_this, callback) {
            callback("break");
        }
    };
}

Jscex.AsyncBuilder.prototype.Continue = function () {
    return {
        start: function (_this, callback) {
            callback("continue");
        }
    };
}

Jscex.AsyncBuilder.prototype.Throw = function (ex) {
    return {
        start: function (_this, callback) {
            callback("throw", ex);
        }
    };
}

Jscex.AsyncBuilder.prototype.Try = function (tryBlock, catchGenerator) {
    return {
        start: function (_this, callback) {
            try {
                tryBlock.start(_this, function (type, value, target) {
                    if (type == "throw") {
                        try {
                            var task = catchGenerator.call(_this, value);
                            task.start(_this, callback);
                        } catch (ex) {
                            callback(type, ex);
                        }
                    } else {
                        callback(type, value, target);
                    }
                });
            } catch (ex) {
                callback("throw", ex);
            }
        }
    }
}

Jscex.AsyncBuilder.prototype.binder = "$await";
Jscex.builders["async"] = new Jscex.AsyncBuilder();

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
    
    startImmediately: function (task, onSuccess, onError) {
        task.start(function (type, value, target) {
            if (onSuccess && (type == "normal" || type == "return")) {
                onSuccess(value);
            } else if (onError && type == "throw") {
                onError(value);
            }
        });
    },
    
    start: function(task, onSuccess, onError) {
        setTimeout(function() {
            Jscex.Async.startImmediately(task, onSuccess, onError);
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

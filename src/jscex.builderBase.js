if ((typeof Jscex) == "undefined") {
    Jscex = { "builders": { } };
}

Jscex.builderBase = {

    "Loop": function (condition, update, body, bodyFirst) {
        return {
            "start": function (_this, callback) {
                
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
    },
    
    "Delay": function (generator) {
        return {
            "start": function (_this, callback) {
                try {
                    var task = generator.call(_this);
                    task.start(_this, callback);
                } catch (ex) {
                    callback("throw", ex);
                }
            }
        };
    },

    "Combine": function (t1, t2) {
        return {
            "start": function (_this, callback) {
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
    },

    "Return": function (result) {
        return {
            "start": function (_this, callback) {
                callback("return", result);
            }
        };
    },

    "Normal": function () {
        return {
            "start": function (_this, callback) {
                callback("normal");
            }
        };
    },

    "Break": function () {
        return {
            "start": function (_this, callback) {
                callback("break");
            }
        };
    },

    "Continue": function () {
        return {
            "start": function (_this, callback) {
                callback("continue");
            }
        };
    },

    "Throw": function (ex) {
        return {
            "start": function (_this, callback) {
                callback("throw", ex);
            }
        };
    },

    "Try": function (tryTask, catchGenerator, finallyTask) {
        return {
            "start": function (_this, callback) {
                tryTask.start(_this, function (type, value, target) {
                    if (type != "throw" || !catchGenerator) {
                        if (!finallyTask) {
                            callback(type, value, target);
                        } else {
                            finallyTask.start(_this, function (finallyType, finallyValue, finallyTarget) {
                                if (finallyType == "normal") {
                                    callback(type, value, target);
                                } else {
                                    callback(finallyType, finallyValue, finallyTarget);
                                }
                            });
                        }
                    } else {

                        if (catchGenerator) {

                            var catchTask;
                            try {
                                catchTask = catchGenerator.call(_this, value);
                            } catch (ex) {
                                if (finallyTask) {
                                    finallyTask.start(_this, function (finallyType, finallyValue, finallyTarget) {
                                        if (finallyType == "normal") {
                                            callback("throw", ex);
                                        } else {
                                            callback(finallyType, finallyValue, finallyTarget);
                                        }
                                    });
                                } else {
                                    callback("throw", ex);
                                }
                            }
                            
                            if (catchTask) {
                                catchTask.start(_this, function (catchType, catchValue, catchTarget) {
                                    if (catchType == "throw") {
                                        if (finallyTask) {
                                            finallyTask.start(_this, function (finallyType, finallyValue, finallyTarget) {
                                                if (finallyType == "normal") {
                                                    callback(catchType, catchValue, catchTarget);
                                                } else {
                                                    callback(finallyType, finallyValue, finallyTarget);
                                                }
                                            });
                                        } else {
                                            callback(catchType, catchValue, catchTarget);
                                        }
                                    } else {
                                        if (finallyTask) {
                                            finallyTask.start(_this, function (finallyType, finallyValue, finallyTarget) {
                                                if (finallyType == "normal") {
                                                    callback(catchType, catchValue, catchTarget);
                                                } else {
                                                    callback(finallyType, finallyValue, finallyTarget);
                                                }
                                            });
                                        } else {
                                            callback(catchType, catchValue, catchTarget);
                                        }
                                    }  
                                });
                            }
                        } else {
                            finallyTask.start(_this, function (finallyType, finallyValue, finallyTarget) {
                                if (finallyType == "normal") {
                                    callback(type, value, target);
                                } else {
                                    callback(finallyType, finallyValue, finallyTarget);
                                }
                            });
                        }
                    }
                });
            }
        };
    }
};

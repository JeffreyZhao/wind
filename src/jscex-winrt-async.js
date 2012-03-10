(function () {
    
    var init = function (root) {
        
        if (root.modules["winrt-async"]) {
            return;
        }
        
        var AsyncBuilder = function () { }
        AsyncBuilder.prototype = {
            Start: function (_this, task) {
                return new WinJS.Promise(function (complete, error) {
                    task.next(_this, function (type, value, target) {
                        if (type == "normal" || type == "return") {
                            complete(value);
                        } else if (type == "throw") {
                            error(value);
                        } else {
                            throw new Error("Unsupported type: " + type);
                        }
                    });
                });
            },

            Bind: function (promise, generator) {
                return {
                    next: function (_this, callback) {
                        
                        promise.done(function (result) {
                            var nextTask;
                            try {
                                nextTask = generator.call(_this, result);
                            } catch (ex) {
                                return callback("throw", ex);
                            }

                            nextTask.next(_this, callback);

                        }, function (error) {
                            callback("throw", error);
                        });
                    }
                };
            }
        }
        
        for (var m in root.BuilderBase.prototype) {
            AsyncBuilder.prototype[m] = root.BuilderBase.prototype[m];
        }
    
        if (!root.WinJS) {
            root.WinJS = { };
        };

        if (!root.WinJS.Async) {
            root.WinJS.Async = { };
        }
        
        var async = root.WinJS.Async;
        async.AsyncBuilder = AsyncBuilder;
        
        if (!root.builders) {
            root.builders = { };
        }
        
        root.binders["winrt-async"] = "$await";
        root.builders["winrt-async"] = new AsyncBuilder();
        
        root.modules["winrt-async"] = true;
    }
    
    // CommonJS
    var isCommonJS = (typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommongJS Wrapping
    var isWrapping = (typeof define === "function" && !define.amd);
    // CommonJS AMD
    var isAmd = (typeof require === "function" && typeof define === "function" && define.amd);
    
    if (isCommonJS) {
        module.exports.init = function (root) {
            if (!root.modules["builderbase"]) {
                if (typeof __dirname === "string") {
                    try {
                        require.paths.unshift(__dirname);
                    } catch (_) {
                        try {
                            module.paths.unshift(__dirname);
                        } catch (_) {}
                    }
                }
            
                require("jscex-builderbase").init(root);
            }
            
            init(root);
        };
    } else if (isWrapping) {
        define("jscex-async", ["jscex-builderbase"], function (require, exports, module) {
            module.exports.init = function (root) {
                if (!root.modules["builderbase"]) {
                    require("jscex-builderbase").init(root);
                }
                
                init(root);
            };
        });
    } else if (isAmd) {
        define("jscex-async", ["jscex-builderbase"], function (builderBase) {
            return {
                init: function (root) {
                    if (!root.modules["builderbase"]) {
                        builderBase.init(root);
                    }
                    
                    init(root);
                }
            };
        });
    } else {
        if (typeof Jscex === "undefined") {
            throw new Error('Missing the root object, please load "jscex" module first.');
        }
    
        if (!Jscex.modules["builderbase"]) {
            throw new Error('Missing essential components, please initialize "builderbase" module first.');
        }
    
        init(Jscex);
    }

})();
(function () {
    "use strict";

    var Jscex;
    
    var defaultCreate = function () {
        throw new Error('Please set "Jscex.Promise.create" to provide a factory method for creating a promise object.');
    }
    
    var PromiseBuilder = function () { }
    PromiseBuilder.prototype = {
        Start: function (_this, task) {
            return Jscex.Promise.create(function (complete, error) {
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
                    promise.then(function (result) {
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
    
    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommonJS AMD
    var isAmd = !!(typeof require === "function" && typeof define === "function" && define.amd);

    var defineModule = function () {
        Jscex.define({
            name: "promise",
            version: "0.6.5",
            exports: isCommonJS && module.exports,
            require: isCommonJS && require,
            autoloads: [ "builderbase" ],
            dependencies: { builderbase: "~0.6.5" },
            init: function () {
                Jscex._.each(Jscex.BuilderBase.prototype, function (m, fn) {
                    PromiseBuilder.prototype[m] = fn;
                });
            
                if (!Jscex.Promise) {
                    Jscex.Promise = {};
                }
                
                Jscex.Promise.create = defaultCreate;
            
                Jscex.binders["promise"] = "$await";
                Jscex.builders["promise"] = new PromiseBuilder();
            }
        });
    }

    if (isCommonJS) {
        try {
            Jscex = require("./jscex");
        } catch (ex) {
            Jscex = require("jscex");
        }
        
        defineModule();
    } else if (isAmd) {
        require(["jscex"], function (jscex) {
            Jscex = jscex;
            defineModule();
        });
    } else {
        var Fn = Function, global = Fn('return this')();

        if (!global.Jscex) {
            throw new Error('Missing the root object, please load "jscex" component first.');
        }
        
        Jscex = global.Jscex;
        defineModule();
    }
})();
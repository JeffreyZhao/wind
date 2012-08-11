(function () {
    "use strict";

    var Wind;
    
    var defaultCreate = function () {
        throw new Error('Please set "Wind.Promise.create" to provide a factory method for creating a promise object.');
    }
    
    var PromiseBuilder = function () { }
    PromiseBuilder.prototype = {
        Start: function (_this, task) {
            return Wind.Promise.create(function (complete, error) {
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
        Wind.define({
            name: "promise",
            version: "0.6.5",
            exports: isCommonJS && module.exports,
            require: isCommonJS && require,
            autoloads: [ "builderbase" ],
            dependencies: { builderbase: "~0.6.5" },
            init: function () {
                Wind._.each(Wind.BuilderBase.prototype, function (m, fn) {
                    PromiseBuilder.prototype[m] = fn;
                });
            
                if (!Wind.Promise) {
                    Wind.Promise = {};
                }
                
                Wind.Promise.create = defaultCreate;
            
                Wind.binders["promise"] = "$await";
                Wind.builders["promise"] = new PromiseBuilder();
            }
        });
    }

    if (isCommonJS) {
        try {
            Wind = require("./wind-core");
        } catch (ex) {
            Wind = require("wind-core");
        }
        
        defineModule();
    } else if (isAmd) {
        require(["wind-core"], function (wind) {
            Wind = wind;
            defineModule();
        });
    } else {
        var Fn = Function, global = Fn('return this')();

        if (!global.Wind) {
            throw new Error('Missing the root object, please load "wind" component first.');
        }
        
        Wind = global.Wind;
        defineModule();
    }
})();
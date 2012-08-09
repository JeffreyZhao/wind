(function () {
    var init = function (root) {
        
        if (!root.modules || !root.modules["async"]) {
            throw new Error('Missing essential component, please initialize "async" module first.');
        }
        
        if (root.modules["async-agent"]) {
            return;
        }
        
        var Task = root.Async.Task;
        
        var Agent = function () {
            this._messages = [];
            this._tasks = [];
        }
        Agent.prototype = {
            receive: function () {
                var _this = this;

                return Task.create(function (t) {
                    if (_this._messages.length > 0) {
                        var msg = _this._messages.shift();
                        t.complete("success", msg);
                    } else {
                        _this._tasks.push(t);
                    }
                });
            },

            post: function (msg) {
                if (this._tasks.length > 0) {
                    var t = this._tasks.shift();
                    t.complete("success", msg);
                } else {
                    this._messages.push(msg);
                }
            },
            
            currentQueueLength: function () {
                return this._messages.length;
            }
        };
        
        root.Async.Agent = Agent;
        
        root.modules["async-agent"] = true;
    }
    
    // CommonJS
    var isCommonJS = (typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommongJS Wrapping
    var isWrapping = (typeof define === "function" && !define.amd);
    // CommonJS AMD
    var isAmd = (typeof require === "function" && typeof define === "function" && define.amd);

    if (isCommonJS) {
        module.exports.init = init;
    } else if (isWrapping) {
        define("wind-async-agent", ["wind-async"], function (require, exports, module) {
            module.exports.init = init;
        });
    } else if (isAmd) {
        define("wind-async-agent", ["wind-async"], function () {
            return { init: init };
        });
    } else {
        if (typeof Wind === "undefined") {
            throw new Error('Missing the root object, please load "wind" module first.');
        }
    
        init(Wind);
    }
})();

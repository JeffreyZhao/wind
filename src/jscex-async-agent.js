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
    
    var isCommonJS = (typeof require !== "undefined") && (typeof module !== "undefined") && module.exports;

    if (isCommonJS) {
        module.exports.init = init;
    } else {
        init(Jscex);
    }
})();

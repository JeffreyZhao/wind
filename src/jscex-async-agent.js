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
            this._queue = [];
        }
        Agent.prototype = {
            receive: function () {
                var _this = this;

                return Task.create(function (t) {
                    if (_this._queue.length > 0) {
                        var message = _this._queue.shift();
                        t.complete("success", message);
                    } else {
                        _this._task = t;
                    }
                });
            },

            send: function (message) {
                if (this._task) {
                    var t = this._task;
                    delete this._task;
                    t.complete("success", message);
                } else {
                    this._queue.push(message);
                }
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

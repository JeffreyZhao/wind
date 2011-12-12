(function () {

    var collectCallbackArgNames = function (args) {
        if (args.length <= 1) return null;
        
        var result = [];
        for (var i = 1; i < args.length; i++) {
            result.push(args[i]);
        }
        
        return result;
    }

    var collectArgs = function (args, requiredArgs) {
        var result = [];
        for (var i = 0; i < args.length; i++) {
            result.push(args[i]);
        }

        while (result.length < requiredArgs) {
            result.push(undefined);
        }

        return result;
    }

    exports.getJscexify = function (root) {
        if (!root.modules || !root.modules["async"]) {
            throw new Error('Missing essential components, please initialize the "jscex-async" module first.');
        }
        
        var Task = root.Async.Task;

        // for the methods return error or result
        var fromStandard = function (fn) {
            var callbackArgNames = collectCallbackArgNames(arguments);
        
            return function () {
                var _this = this;
                var args = collectArgs(arguments, fn.length - 1);

                return Task.create(function (t) {
                    args.push(function (error, result) {
                        if (error) {
                            t.complete("failure", error);
                        } else if (!callbackArgNames) {
                            t.complete("success", result);
                        } else {
                            var data = {};
                            for (var i = 0; i < callbackArgNames.length; i++) {
                                data[callbackArgNames[i]] = arguments[i + 1];
                            }
                            
                            return t.complete("success", data);
                        }
                    });
                    
                    fn.apply(_this, args);
                });
            };
        };
        
        // for the methods always success
        var fromCallback = function (fn) {
            var callbackArgNames = collectCallbackArgNames(arguments);
        
            return function () {
                var _this = this;
                var args = collectArgs(arguments, fn.length - 1);

                return Task.create(function (t) {
                    args.push(function (result) {
                        if (callbackArgNames) {
                            var data = {};
                            for (var i = 0; i < callbackArgNames.length; i++) {
                                data[callbackArgNames[i]] = arguments[i];
                            }
                            
                            t.complete("success", data);
                        } else {
                            t.complete("success", result);
                        }
                    });
                    
                    fn.apply(_this, args);
                });
            };
        };

        return {
            fromStandard: fromStandard,
            fromCallback: fromCallback
        };
    };

})();

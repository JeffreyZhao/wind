(function () {

    var collectArgs = function (args, requiredArgs) {
        var result = [];
        for (var i = 0; i < args.length; i++) {
            result.push(args[i]);
        }

        while (result.length < requiredArgs) {
            result.push(null);
        }

        return result;
    }

    exports.getJscexify = function (root) {
        if (!root.Async || !root.Async.Task) {
            throw new Error('Missing essential components, please initialize the "jscex-async" module first.');
        }
        
        var Task = root.Async.Task;

        // for the methods return error or result
        var fromStandard = function (fn, requiredArgs) {
            return function () {
                var _this = this;
                var args = collectArgs(arguments, requiredArgs || 0);

                var delegate = {
                    onStart: function (callback) {

                        args.push(function (error, result) {
                            if (error) {
                                callback("failure", error);
                            } else {
                                callback("success", result);
                            }
                        });

                        fn.apply(_this, args);
                    }
                };
                
                return new Task(delegate);
            };
        };
        
        // for the methods always success
        var fromCallback = function (fn, requiredArgs) {
            return function () {
                var _this = this;
                var args = collectArgs(arguments, requiredArgs || 0);

                var delegate = {
                    onStart: function (callback) {

                        args.push(function (result) {
                            callback("success", result);
                        });

                        fn.apply(_this, args);
                    }
                };
                
                return new Task(delegate);
            };
        };

        return {
            fromStandard: fromStandard,
            fromCallback: fromCallback
        };
    };

})();

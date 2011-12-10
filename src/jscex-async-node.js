(function () {

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
        if (!root.Async || !root.Async.Task) {
            throw new Error('Missing essential components, please initialize the "jscex-async" module first.');
        }
        
        var Task = root.Async.Task;

        // for the methods return error or result
        var fromStandard = function (fn) {
            return function () {
                var _this = this;
                var args = collectArgs(arguments, fn.length - 1);

				return Task.create(function (t) {
					args.push(function (error, result) {
					    if (error) {
					        t.complete("failure", error);
					    } else {
					        t.complete("success", result);
					    }
					});
					
					fn.apply(_this, args);
				});
            };
        };
        
        // for the methods always success
        var fromCallback = function (fn) {
            return function () {
                var _this = this;
                var args = collectArgs(arguments, fn.length - 1);

				return Task.create(function (t) {
					args.push(function (result) {
					    t.complete("success", result);
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
